"""
Text conditioning encoder for Project Hydra.

Wraps a frozen HuggingFace T5 encoder model to produce token-level and
pooled text embeddings for cross-attention and adaLN conditioning in the
dual-branch DiT.

Supports arbitrary T5 variants (t5-small 512d, t5-base 768d, t5-large 1024d,
google/t5-v1_1-xxl 4096d, etc.) and projects to target dimension if needed.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

import torch
import torch.nn as nn
from transformers import T5EncoderModel, T5Tokenizer

logger = logging.getLogger(__name__)


# ─── Data Container ────────────────────────────────────────────────────────────


@dataclass
class TextCondition:
    """Output container for text conditioning signals.

    Attributes:
        hidden_states: Token-level embeddings for cross-attention.
            Shape: (B, seq_len, dim)
        pooled: Mean-pooled embedding for global conditioning (adaLN).
            Shape: (B, dim)
        mask: Attention mask indicating real vs. padding tokens.
            Shape: (B, seq_len)
    """
    hidden_states: torch.Tensor  # (B, seq_len, dim)
    pooled: torch.Tensor         # (B, dim)
    mask: torch.Tensor           # (B, seq_len)


# ─── Text Encoder ──────────────────────────────────────────────────────────────


class TextEncoder(nn.Module):
    """Frozen T5 encoder with optional projection to a target dimension.

    The T5 encoder produces contextual token embeddings that are used for
    cross-attention in both the visual and audio DiT branches.  A mean-pooled
    vector (masked to ignore padding) serves as the global conditioning
    signal for adaLN-Zero modulation.

    Args:
        model_name: HuggingFace T5 model identifier
            (e.g. 't5-small', 't5-base', 'google/t5-v1_1-xxl').
        max_length: Maximum number of tokens per prompt.
        target_dim: If provided, project encoder hidden states to this
            dimension via a learned linear layer.  When ``None``, hidden
            states are returned at the native T5 dimension.
        device: Device to place the frozen model on.

    Example::

        encoder = TextEncoder("t5-small", max_length=128, target_dim=512)
        cond = encoder(["A sunset over the ocean"])
        # cond.hidden_states.shape == (1, 128, 512)
    """

    def __init__(
        self,
        model_name: str = "t5-small",
        max_length: int = 128,
        target_dim: Optional[int] = None,
        device: Optional[torch.device] = None,
    ) -> None:
        super().__init__()

        self.max_length = max_length
        self.device = device or torch.device("cpu")

        # ── Load and freeze the T5 encoder ──────────────────────────────
        logger.info("Loading T5 encoder: %s", model_name)
        self.tokenizer = T5Tokenizer.from_pretrained(model_name)
        self.encoder = T5EncoderModel.from_pretrained(model_name)
        self.encoder.eval()

        # Freeze all parameters — we never fine-tune the text encoder
        for param in self.encoder.parameters():
            param.requires_grad = False

        # Determine the native hidden size from the model config
        self.native_dim: int = self.encoder.config.d_model  # type: ignore[attr-defined]
        logger.info("T5 native dim: %d", self.native_dim)

        # ── Optional projection to target_dim ───────────────────────────
        self.target_dim = target_dim if target_dim is not None else self.native_dim
        if target_dim is not None and target_dim != self.native_dim:
            self.proj = nn.Linear(self.native_dim, target_dim, bias=False)
            # Xavier-uniform keeps output variance stable at init
            nn.init.xavier_uniform_(self.proj.weight)
        else:
            self.proj = nn.Identity()

        self.to(self.device)

    # ── Forward ─────────────────────────────────────────────────────────────

    @torch.no_grad()
    def forward(self, texts: List[str]) -> TextCondition:
        """Encode a batch of text prompts into conditioning tensors.

        Args:
            texts: List of B text strings.

        Returns:
            TextCondition with hidden_states, pooled, and mask.
        """
        # Tokenize — returns dict with input_ids and attention_mask
        tok_out = self.tokenizer(
            texts,
            max_length=self.max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        input_ids = tok_out["input_ids"].to(self.device)          # (B, seq_len)
        attention_mask = tok_out["attention_mask"].to(self.device)  # (B, seq_len)

        # Run through frozen T5 encoder
        encoder_out = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        hidden_states = encoder_out.last_hidden_state  # (B, seq_len, native_dim)

        # Project to target dimension (identity if dims match)
        hidden_states = self.proj(hidden_states)  # (B, seq_len, target_dim)

        # Mean-pool over non-padding tokens for the global conditioning vector
        # mask: (B, seq_len) → (B, seq_len, 1) for broadcasting
        mask_expanded = attention_mask.unsqueeze(-1).float()  # (B, seq_len, 1)
        sum_hidden = (hidden_states * mask_expanded).sum(dim=1)  # (B, target_dim)
        token_counts = mask_expanded.sum(dim=1).clamp(min=1.0)   # (B, 1)
        pooled = sum_hidden / token_counts                       # (B, target_dim)

        return TextCondition(
            hidden_states=hidden_states,  # (B, seq_len, target_dim)
            pooled=pooled,                # (B, target_dim)
            mask=attention_mask,          # (B, seq_len)
        )

    # ── Null encoding for classifier-free guidance ──────────────────────────

    def encode_null(self, batch_size: int = 1) -> TextCondition:
        """Produce the unconditional (null) text embedding.

        Used during classifier-free guidance: the model is run once with
        the real prompt and once with this null embedding, then the two
        predictions are linearly combined.

        Args:
            batch_size: Number of null embeddings to produce.

        Returns:
            TextCondition encoding an empty string, replicated B times.
        """
        return self.forward([""] * batch_size)

    # ── Utility ─────────────────────────────────────────────────────────────

    @property
    def output_dim(self) -> int:
        """Effective output dimension after projection."""
        return self.target_dim

    def extra_repr(self) -> str:
        return (
            f"native_dim={self.native_dim}, "
            f"target_dim={self.target_dim}, "
            f"max_length={self.max_length}"
        )
