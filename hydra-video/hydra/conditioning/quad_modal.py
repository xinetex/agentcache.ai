"""
Quad-modal conditioning fusion for Project Hydra.

Fuses text, image, audio, and (future) video-reference conditioning into
unified cross-attention tokens and global embeddings for the dual-branch
Diffusion Transformer.

Routing logic:
    • Text  → projected to visual_dim AND audio_dim (both branches)
    • Image → visual branch only
    • Audio → both branches (primary for audio, supplementary for visual)
    • Video reference → visual branch only (future)

Each branch receives:
    • cross_tokens: concatenated conditioning tokens for cross-attention
    • global_embed: pooled conditioning vector for adaLN-Zero modulation
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

import torch
import torch.nn as nn

from hydra.config import ConditioningConfig
from hydra.conditioning.text_encoder import TextEncoder, TextCondition
from hydra.conditioning.image_encoder import ImageEncoder, ImageCondition
from hydra.conditioning.audio_encoder import AudioEncoder, AudioCondition

logger = logging.getLogger(__name__)


# ─── Data Containers ───────────────────────────────────────────────────────────


@dataclass
class HydraCondition:
    """Unified conditioning output consumed by the dual-branch DiT.

    All tensors are ready for direct use by the transformer — projections
    to the correct branch dimensions have already been applied.

    Attributes:
        visual_cross_tokens: Concatenated conditioning tokens (text + image
            + optional audio) for visual branch cross-attention.
            Shape: (B, N_vis, visual_dim)
        visual_global: Pooled global conditioning for visual branch adaLN.
            Shape: (B, visual_dim)
        audio_cross_tokens: Concatenated conditioning tokens (text + audio)
            for audio branch cross-attention.
            Shape: (B, N_aud, audio_dim)
        audio_global: Pooled global conditioning for audio branch adaLN.
            Shape: (B, audio_dim)
        beats: Optional detected beat positions for rhythmic attention.
            Shape: (B, max_beats) — padded with -1 where absent.
    """
    visual_cross_tokens: torch.Tensor   # (B, N_vis, visual_dim)
    visual_global: torch.Tensor         # (B, visual_dim)
    audio_cross_tokens: torch.Tensor    # (B, N_aud, audio_dim)
    audio_global: torch.Tensor          # (B, audio_dim)
    beats: Optional[torch.Tensor]       # (B, max_beats) or None


# ─── Projection Helper ─────────────────────────────────────────────────────────


def _make_projection(in_dim: int, out_dim: int) -> nn.Linear:
    """Create a linear projection with Xavier-uniform initialisation.

    Args:
        in_dim: Input feature dimension.
        out_dim: Output feature dimension.

    Returns:
        Initialised ``nn.Linear`` (no bias, to match conditioning convention).
    """
    proj = nn.Linear(in_dim, out_dim, bias=False)
    nn.init.xavier_uniform_(proj.weight)
    return proj


# ─── Quad-Modal Conditioner ────────────────────────────────────────────────────


class QuadModalConditioner(nn.Module):
    """Fuses text, image, audio, and video-reference conditioning.

    Instantiates the per-modality encoders (based on ``ConditioningConfig``)
    and learned projection layers that map each modality's features into
    the visual and audio branch dimensions.

    Any modality can be ``None`` at inference time — the conditioner will
    substitute learned null tokens or skip concatenation.  When *all*
    modalities are ``None`` the unconditional case is produced for
    classifier-free guidance.

    Args:
        config: Multi-modal conditioning configuration from HydraConfig.
        visual_dim: Hidden dimension of the visual DiT branch.
        audio_dim: Hidden dimension of the audio DiT branch.

    Example::

        cfg = ConditioningConfig()
        cond_module = QuadModalConditioner(cfg, visual_dim=512, audio_dim=256)
        hc = cond_module(text=["a dog jumping"], images=None, audio=None)
        # hc.visual_cross_tokens.shape == (1, 128, 512)
    """

    def __init__(
        self,
        config: ConditioningConfig,
        visual_dim: int,
        audio_dim: int,
    ) -> None:
        super().__init__()

        self.config = config
        self.visual_dim = visual_dim
        self.audio_dim = audio_dim

        # ── Text encoder ────────────────────────────────────────────────
        # The text encoder outputs at its own native (or projected) dim.
        # We project into both branch dims below.
        self.text_encoder = TextEncoder(
            model_name=config.text_encoder,
            max_length=config.text_max_length,
        )
        text_dim = self.text_encoder.output_dim  # native T5 dim

        # Text → visual branch projection
        self.text_to_visual_tokens = _make_projection(text_dim, visual_dim)
        self.text_to_visual_pool = _make_projection(text_dim, visual_dim)

        # Text → audio branch projection
        self.text_to_audio_tokens = _make_projection(text_dim, audio_dim)
        self.text_to_audio_pool = _make_projection(text_dim, audio_dim)

        # ── Image encoder (optional) ────────────────────────────────────
        if config.use_image_encoder:
            self.image_encoder = ImageEncoder(
                model_name=config.image_encoder,
            )
            img_dim = self.image_encoder.output_dim
            self.image_to_visual_tokens = _make_projection(img_dim, visual_dim)
            self.image_to_visual_pool = _make_projection(img_dim, visual_dim)
        else:
            self.image_encoder = None

        # ── Audio encoder (optional) ────────────────────────────────────
        if config.use_audio_encoder:
            self.audio_encoder = AudioEncoder(
                mel_channels=config.mel_channels,
                hidden_dim=audio_dim,  # encode directly at audio branch dim
                sample_rate=config.sample_rate,
                hop_length=config.mel_hop_length,
            )
            aud_enc_dim = self.audio_encoder.output_dim

            # Audio → audio branch: already at audio_dim, but use a
            # projection for a learned refinement
            self.audio_to_audio_tokens = _make_projection(aud_enc_dim, audio_dim)
            self.audio_to_audio_pool = _make_projection(aud_enc_dim, audio_dim)

            # Audio → visual branch: project to visual_dim for supplementary
            # cross-attention in the visual branch
            self.audio_to_visual_tokens = _make_projection(aud_enc_dim, visual_dim)
        else:
            self.audio_encoder = None

        # ── Null global embeddings ──────────────────────────────────────
        # Learned null vectors used when all modalities are absent (CFG).
        self.null_visual_global = nn.Parameter(
            torch.zeros(1, visual_dim)
        )
        self.null_audio_global = nn.Parameter(
            torch.zeros(1, audio_dim)
        )

        # Learned null cross-attention tokens (short fixed-length sequences)
        null_vis_len = config.text_max_length  # match text token count
        null_aud_len = 32  # compact null for audio branch
        self.null_visual_tokens = nn.Parameter(
            torch.randn(1, null_vis_len, visual_dim) * 0.02
        )
        self.null_audio_tokens = nn.Parameter(
            torch.randn(1, null_aud_len, audio_dim) * 0.02
        )

    # ── Forward ─────────────────────────────────────────────────────────────

    def forward(
        self,
        text: Optional[List[str]] = None,
        images: Optional[List[torch.Tensor]] = None,
        audio: Optional[torch.Tensor] = None,
        video_ref: Optional[torch.Tensor] = None,
    ) -> HydraCondition:
        """Fuse all available modalities into branch-specific conditioning.

        Each argument can be ``None`` to indicate that modality is absent.
        When **all** are ``None``, the unconditional null conditioning is
        returned (for classifier-free guidance).

        Args:
            text: List of B text prompts.
            images: List of reference image tensors, each (B, C, H, W) or
                (C, H, W).  Up to ``config.max_reference_images`` images.
            audio: Raw audio waveform tensor of shape (B, num_samples).
            video_ref: Reserved for future video-reference conditioning.
                Currently unused.

        Returns:
            HydraCondition with visual and audio branch conditioning.
        """
        all_none = text is None and images is None and audio is None and video_ref is None

        # Determine batch size from whichever modality is present
        batch_size = self._infer_batch_size(text, images, audio)

        # ── Unconditional (all-null) shortcut ───────────────────────────
        if all_none:
            return self._encode_unconditional(batch_size)

        # ── Encode each modality ────────────────────────────────────────
        text_cond = self._encode_text(text, batch_size)
        image_cond = self._encode_image(images, batch_size)
        audio_cond = self._encode_audio(audio, batch_size)

        # ── Assemble visual branch conditioning ─────────────────────────
        vis_token_parts: list[torch.Tensor] = []
        vis_pool_parts: list[torch.Tensor] = []

        if text_cond is not None:
            # Project text tokens → visual_dim
            text_vis_tokens = self.text_to_visual_tokens(
                text_cond.hidden_states
            )  # (B, seq_len, visual_dim)
            vis_token_parts.append(text_vis_tokens)

            text_vis_pool = self.text_to_visual_pool(
                text_cond.pooled
            )  # (B, visual_dim)
            vis_pool_parts.append(text_vis_pool)

        if image_cond is not None:
            img_vis_tokens = self.image_to_visual_tokens(
                image_cond.hidden_states
            )  # (B, N*num_patches, visual_dim)
            vis_token_parts.append(img_vis_tokens)

            img_vis_pool = self.image_to_visual_pool(
                image_cond.pooled
            )  # (B, visual_dim)
            vis_pool_parts.append(img_vis_pool)

        if audio_cond is not None:
            audio_vis_tokens = self.audio_to_visual_tokens(
                audio_cond.hidden_states
            )  # (B, T_audio, visual_dim)
            vis_token_parts.append(audio_vis_tokens)

        # Concatenate visual tokens along sequence dim
        if vis_token_parts:
            visual_cross_tokens = torch.cat(
                vis_token_parts, dim=1
            )  # (B, N_vis, visual_dim)
        else:
            visual_cross_tokens = self.null_visual_tokens.expand(
                batch_size, -1, -1
            )  # (B, null_vis_len, visual_dim)

        # Mean-pool all visual pool contributions
        if vis_pool_parts:
            visual_global = torch.stack(
                vis_pool_parts, dim=0
            ).mean(dim=0)  # (B, visual_dim)
        else:
            visual_global = self.null_visual_global.expand(
                batch_size, -1
            )  # (B, visual_dim)

        # ── Assemble audio branch conditioning ──────────────────────────
        aud_token_parts: list[torch.Tensor] = []
        aud_pool_parts: list[torch.Tensor] = []

        if text_cond is not None:
            text_aud_tokens = self.text_to_audio_tokens(
                text_cond.hidden_states
            )  # (B, seq_len, audio_dim)
            aud_token_parts.append(text_aud_tokens)

            text_aud_pool = self.text_to_audio_pool(
                text_cond.pooled
            )  # (B, audio_dim)
            aud_pool_parts.append(text_aud_pool)

        if audio_cond is not None:
            aud_tokens = self.audio_to_audio_tokens(
                audio_cond.hidden_states
            )  # (B, T_audio, audio_dim)
            aud_token_parts.append(aud_tokens)

            aud_pool = self.audio_to_audio_pool(
                audio_cond.hidden_states.mean(dim=1)
            )  # (B, audio_dim)
            aud_pool_parts.append(aud_pool)

        if aud_token_parts:
            audio_cross_tokens = torch.cat(
                aud_token_parts, dim=1
            )  # (B, N_aud, audio_dim)
        else:
            audio_cross_tokens = self.null_audio_tokens.expand(
                batch_size, -1, -1
            )  # (B, null_aud_len, audio_dim)

        if aud_pool_parts:
            audio_global = torch.stack(
                aud_pool_parts, dim=0
            ).mean(dim=0)  # (B, audio_dim)
        else:
            audio_global = self.null_audio_global.expand(
                batch_size, -1
            )  # (B, audio_dim)

        # ── Beat positions ──────────────────────────────────────────────
        beats = audio_cond.beats if audio_cond is not None else None

        return HydraCondition(
            visual_cross_tokens=visual_cross_tokens,
            visual_global=visual_global,
            audio_cross_tokens=audio_cross_tokens,
            audio_global=audio_global,
            beats=beats,
        )

    # ── Internal encoding helpers ───────────────────────────────────────────

    def _encode_text(
        self,
        text: Optional[List[str]],
        batch_size: int,
    ) -> Optional[TextCondition]:
        """Encode text if provided, or return None."""
        if text is None:
            return None
        return self.text_encoder(text)

    def _encode_image(
        self,
        images: Optional[List[torch.Tensor]],
        batch_size: int,
    ) -> Optional[ImageCondition]:
        """Encode images if provided and encoder is enabled."""
        if images is None or self.image_encoder is None:
            return None
        # Clamp to max_reference_images
        imgs = images[: self.config.max_reference_images]
        return self.image_encoder(imgs, batch_size=batch_size)

    def _encode_audio(
        self,
        audio: Optional[torch.Tensor],
        batch_size: int,
    ) -> Optional[AudioCondition]:
        """Encode audio if provided and encoder is enabled."""
        if audio is None or self.audio_encoder is None:
            return None
        return self.audio_encoder(audio)

    def _encode_unconditional(self, batch_size: int) -> HydraCondition:
        """Produce fully unconditional conditioning for classifier-free guidance.

        Uses learned null tokens and global embeddings for both branches.

        Args:
            batch_size: Number of samples in the batch.

        Returns:
            HydraCondition with all-null embeddings.
        """
        visual_cross = self.null_visual_tokens.expand(
            batch_size, -1, -1
        )  # (B, null_vis_len, visual_dim)
        visual_global = self.null_visual_global.expand(
            batch_size, -1
        )  # (B, visual_dim)
        audio_cross = self.null_audio_tokens.expand(
            batch_size, -1, -1
        )  # (B, null_aud_len, audio_dim)
        audio_global = self.null_audio_global.expand(
            batch_size, -1
        )  # (B, audio_dim)

        return HydraCondition(
            visual_cross_tokens=visual_cross,
            visual_global=visual_global,
            audio_cross_tokens=audio_cross,
            audio_global=audio_global,
            beats=None,
        )

    # ── Utility ─────────────────────────────────────────────────────────────

    @staticmethod
    def _infer_batch_size(
        text: Optional[List[str]],
        images: Optional[List[torch.Tensor]],
        audio: Optional[torch.Tensor],
    ) -> int:
        """Infer batch size from whichever modality is present.

        Falls back to 1 if nothing is provided.
        """
        if text is not None:
            return len(text)
        if images is not None and len(images) > 0:
            first = images[0]
            return first.shape[0] if first.ndim == 4 else 1
        if audio is not None:
            return audio.shape[0] if audio.ndim >= 2 else 1
        return 1  # fully unconditional

    def extra_repr(self) -> str:
        return (
            f"visual_dim={self.visual_dim}, "
            f"audio_dim={self.audio_dim}, "
            f"text_encoder={self.config.text_encoder}, "
            f"image_encoder={'enabled' if self.image_encoder else 'disabled'}, "
            f"audio_encoder={'enabled' if self.audio_encoder else 'disabled'}"
        )
