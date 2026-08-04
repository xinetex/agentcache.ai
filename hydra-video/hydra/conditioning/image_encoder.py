"""
Image conditioning encoder for Project Hydra.

Uses a frozen CLIP Vision Transformer to encode reference images into
patch-level tokens (for cross-attention) and a CLS pooled embedding
(for global adaLN conditioning).

Supports concatenating tokens from multiple reference images and provides
learned null tokens for classifier-free guidance when no image is provided.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

import torch
import torch.nn as nn
from transformers import CLIPVisionModel, CLIPImageProcessor

logger = logging.getLogger(__name__)


# ─── Data Container ────────────────────────────────────────────────────────────


@dataclass
class ImageCondition:
    """Output container for image conditioning signals.

    Attributes:
        hidden_states: Patch-level embeddings for cross-attention.
            If N reference images are provided their patch tokens are
            concatenated along the sequence dimension.
            Shape: (B, N * num_patches, dim)
        pooled: CLS-token embedding (mean over N images if multiple).
            Shape: (B, dim)
    """
    hidden_states: torch.Tensor  # (B, N * num_patches, dim)
    pooled: torch.Tensor         # (B, dim)


# ─── Image Encoder ─────────────────────────────────────────────────────────────


# Map short aliases used in ConditioningConfig to HF model IDs
_CLIP_MODEL_MAP = {
    "clip-vit-base": "openai/clip-vit-base-patch16",
    "clip-vit-large": "openai/clip-vit-large-patch14",
}


class ImageEncoder(nn.Module):
    """Frozen CLIP ViT encoder for reference-image conditioning.

    The encoder extracts patch embeddings from each reference image.  When
    multiple images are provided per sample the patch tokens are concatenated
    along the sequence dimension so the DiT cross-attention can attend to
    all reference patches jointly.

    A learned set of *null tokens* is used for the unconditional case
    (no reference image) during classifier-free guidance.

    Args:
        model_name: CLIP model identifier — either a short alias
            (``'clip-vit-base'``, ``'clip-vit-large'``) or a full HF id.
        target_dim: If provided, project CLIP hidden states to this dim.
        num_null_tokens: Number of learned null tokens used when no image
            is supplied (matches the typical single-image patch count).
        device: Device for the frozen model.

    Example::

        enc = ImageEncoder("clip-vit-base", target_dim=512)
        # Single image per sample
        cond = enc([img_tensor])
    """

    def __init__(
        self,
        model_name: str = "clip-vit-base",
        target_dim: Optional[int] = None,
        num_null_tokens: int = 197,  # ViT-B/16: 14×14 patches + 1 CLS = 197
        device: Optional[torch.device] = None,
    ) -> None:
        super().__init__()

        self.device = device or torch.device("cpu")
        hf_name = _CLIP_MODEL_MAP.get(model_name, model_name)

        # ── Load and freeze CLIP vision encoder ─────────────────────────
        logger.info("Loading CLIP vision encoder: %s", hf_name)
        self.processor = CLIPImageProcessor.from_pretrained(hf_name)
        self.vision_model = CLIPVisionModel.from_pretrained(hf_name)
        self.vision_model.eval()

        for param in self.vision_model.parameters():
            param.requires_grad = False

        self.native_dim: int = self.vision_model.config.hidden_size
        logger.info("CLIP native dim: %d", self.native_dim)

        # ── Optional projection ─────────────────────────────────────────
        self.target_dim = target_dim if target_dim is not None else self.native_dim
        if target_dim is not None and target_dim != self.native_dim:
            self.proj = nn.Linear(self.native_dim, target_dim, bias=False)
            nn.init.xavier_uniform_(self.proj.weight)
        else:
            self.proj = nn.Identity()

        # ── Learned null tokens for unconditional generation ────────────
        # Shape: (1, num_null_tokens, target_dim) — broadcast over batch
        self.null_tokens = nn.Parameter(
            torch.randn(1, num_null_tokens, self.target_dim) * 0.02
        )
        # Null pooled vector — same dim as pooled output
        self.null_pooled = nn.Parameter(
            torch.zeros(1, self.target_dim)
        )

        self.num_null_tokens = num_null_tokens
        self.to(self.device)

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _encode_single_image(self, pixel_values: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Encode a batch of single images through the frozen CLIP ViT.

        Args:
            pixel_values: Pre-processed pixel tensor of shape
                (B, C, H, W) in the format expected by CLIP.

        Returns:
            Tuple of (patch_tokens, cls_token):
                patch_tokens: (B, num_patches, native_dim) — excludes CLS
                cls_token:    (B, native_dim)
        """
        with torch.no_grad():
            out = self.vision_model(pixel_values=pixel_values)

        # last_hidden_state includes [CLS] at position 0 followed by patches
        all_tokens = out.last_hidden_state   # (B, 1 + num_patches, native_dim)
        cls_token = all_tokens[:, 0, :]      # (B, native_dim)
        patch_tokens = all_tokens[:, 1:, :]  # (B, num_patches, native_dim)

        return patch_tokens, cls_token

    def _preprocess_images(
        self,
        images: List[torch.Tensor],
    ) -> torch.Tensor:
        """Convert a list of image tensors to CLIP-compatible pixel values.

        Accepts images as float tensors in [0, 1] with shape (C, H, W) or
        (B, C, H, W).  Uses the CLIP processor for resizing / normalisation.

        Args:
            images: List of image tensors. Each tensor is either (C, H, W)
                for a single image or (B, C, H, W) for a batch.  All tensors
                in the list must share the same batch size B (or be single
                images that will be treated as B=1).

        Returns:
            pixel_values: (total_images, C, H_clip, W_clip)
        """
        # Collect all images into a flat list of PIL-compatible tensors
        # The processor expects PIL images or numpy arrays or tensors in
        # 0-255 uint8.  We'll convert [0,1] float → [0,255] uint8 numpy.
        import numpy as np

        np_images: list[object] = []
        for img in images:
            if img.ndim == 3:
                img = img.unsqueeze(0)  # (1, C, H, W)
            for i in range(img.shape[0]):
                # (C, H, W) → (H, W, C), float [0,1] → uint8 [0,255]
                single = img[i].clamp(0.0, 1.0).cpu()
                single_np = (single.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
                np_images.append(single_np)

        processed = self.processor(
            images=np_images,
            return_tensors="pt",
        )
        return processed["pixel_values"].to(self.device)  # (N_total, C, H, W)

    # ── Forward ─────────────────────────────────────────────────────────────

    def forward(
        self,
        images: List[torch.Tensor],
        batch_size: Optional[int] = None,
    ) -> ImageCondition:
        """Encode one or more reference images per sample.

        When multiple images are provided (len(images) > 1) and all share
        the same batch dimension B, their patch tokens are concatenated
        along the sequence axis so the DiT can cross-attend to all
        reference patches jointly.

        Args:
            images: List of N image tensors, each (B, C, H, W) or (C, H, W).
                All must share the same B when >3-D.
            batch_size: Explicit batch size override.  Inferred from images
                when ``None``.

        Returns:
            ImageCondition with concatenated hidden_states and mean-pooled CLS.
        """
        if len(images) == 0:
            if batch_size is None:
                raise ValueError(
                    "batch_size must be specified when images list is empty"
                )
            return self.encode_null(batch_size)

        # Pre-process all images together
        pixel_values = self._preprocess_images(images)  # (N_total, C, H, W)

        # Determine per-image batch size
        first = images[0]
        B = first.shape[0] if first.ndim == 4 else 1
        N = len(images)
        # pixel_values should be (N * B, C, H, W) — N images per sample,
        # B samples.  We need to interleave correctly: images are appended
        # sample-by-sample within _preprocess_images.

        # Encode through CLIP
        patch_tokens, cls_tokens = self._encode_single_image(pixel_values)
        # patch_tokens: (N * B, num_patches, native_dim)
        # cls_tokens:   (N * B, native_dim)

        # Project
        patch_tokens = self.proj(patch_tokens)  # (N*B, num_patches, target_dim)
        cls_tokens = self.proj(cls_tokens)      # (N*B, target_dim)

        num_patches = patch_tokens.shape[1]

        # Reshape to (B, N, num_patches, target_dim) then flatten N*patches
        patch_tokens = patch_tokens.view(B, N, num_patches, self.target_dim)
        patch_tokens = patch_tokens.view(B, N * num_patches, self.target_dim)
        # (B, N * num_patches, target_dim)

        # Mean-pool CLS tokens across reference images
        cls_tokens = cls_tokens.view(B, N, self.target_dim)  # (B, N, target_dim)
        pooled = cls_tokens.mean(dim=1)                       # (B, target_dim)

        return ImageCondition(
            hidden_states=patch_tokens,  # (B, N * num_patches, target_dim)
            pooled=pooled,               # (B, target_dim)
        )

    # ── Null encoding ───────────────────────────────────────────────────────

    def encode_null(self, batch_size: int = 1) -> ImageCondition:
        """Produce learned null image conditioning for CFG.

        Returns learned null tokens that replace real image patch tokens
        when no reference image is available.

        Args:
            batch_size: Number of null embeddings to produce.

        Returns:
            ImageCondition with learned null tokens.
        """
        hidden_states = self.null_tokens.expand(
            batch_size, -1, -1
        )  # (B, num_null_tokens, target_dim)

        pooled = self.null_pooled.expand(
            batch_size, -1
        )  # (B, target_dim)

        return ImageCondition(
            hidden_states=hidden_states,
            pooled=pooled,
        )

    # ── Utility ─────────────────────────────────────────────────────────────

    @property
    def output_dim(self) -> int:
        """Effective output dimension after projection."""
        return self.target_dim

    def extra_repr(self) -> str:
        return (
            f"native_dim={self.native_dim}, "
            f"target_dim={self.target_dim}, "
            f"num_null_tokens={self.num_null_tokens}"
        )
