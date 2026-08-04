"""
DiT Block — Single transformer block with adaLN-Zero modulation.

Implements the core building block of the Hydra Diffusion Transformer:
  x → adaLN → FactorizedAttention → gated residual
    → adaLN → CrossAttention → gated residual
    → adaLN → FeedForward(GEGLU) → gated residual

adaLN-Zero: The modulation MLP predicts shift, scale, and gate parameters
from the timestep embedding. Gates are initialized to zero so the block
starts as an identity function, enabling stable deep training.
"""

from typing import Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from hydra.transformer.attention import FactorizedAttention, CrossAttention


class GEGLU(nn.Module):
    """
    Gated variant of GELU activation for feed-forward networks.

    Splits the input in half along the last dimension. One half becomes the
    value, the other half passes through GELU and acts as a gate. This
    consistently outperforms standard GELU in transformer FFNs.
    """

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input tensor.  Shape: (..., 2 * inner_dim)

        Returns:
            Gated output.  Shape: (..., inner_dim)
        """
        # Split along last dimension into value and gate
        value, gate = x.chunk(2, dim=-1)  # each: (..., inner_dim)
        return value * F.gelu(gate)


class FeedForward(nn.Module):
    """
    Feed-forward network with GEGLU activation.

    Architecture: Linear(D → 4D*2) → GEGLU → Dropout → Linear(4D → D)
    The input linear produces 2× the inner dim because GEGLU splits it.

    Args:
        dim: Input/output dimension.
        mlp_ratio: Expansion ratio for the inner dimension.
        dropout: Dropout probability.
    """

    def __init__(
        self,
        dim: int,
        mlp_ratio: float = 4.0,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        inner_dim = int(dim * mlp_ratio)

        self.net = nn.Sequential(
            # Projects to 2 * inner_dim because GEGLU will split and gate
            nn.Linear(dim, inner_dim * 2),
            GEGLU(),
            nn.Dropout(dropout),
            nn.Linear(inner_dim, dim),
        )

        self._init_weights()

    def _init_weights(self) -> None:
        """Kaiming init for input, zero init for output (adaLN-Zero compatible)."""
        nn.init.kaiming_normal_(self.net[0].weight, nonlinearity="relu")
        nn.init.zeros_(self.net[0].bias)
        nn.init.zeros_(self.net[3].weight)
        nn.init.zeros_(self.net[3].bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input tensor.  Shape: (B, N, D)

        Returns:
            Output tensor.  Shape: (B, N, D)
        """
        return self.net(x)


class AdaLNModulation(nn.Module):
    """
    Adaptive Layer Normalization modulation parameter predictor.

    Takes a conditioning vector (timestep embedding) and predicts the
    shift, scale, and gate parameters for all three sub-blocks of a DiT block.

    For each sub-block, predicts 2 parameters (shift, scale) for the pre-norm
    and 1 parameter (gate) for the gated residual, totaling 3 × 3 = 9 values.
    However, following the DiT convention, we predict 6 modulation params
    (shift1, scale1, shift2, scale2, shift3, scale3) plus 3 gates = 9 total.

    We follow the original DiT paper which groups as 6*D for two sub-blocks
    but here we extend to 3 sub-blocks (self-attn, cross-attn, ffn) = 9*D.

    Args:
        dim: Model hidden dimension.
        num_modulations: Number of modulation outputs (default 9 = 3 sub-blocks × 3 params each).
    """

    def __init__(self, dim: int, num_modulations: int = 9) -> None:
        super().__init__()
        self.num_modulations = num_modulations
        self.mlp = nn.Sequential(
            nn.SiLU(),
            nn.Linear(dim, num_modulations * dim),
        )
        self._init_weights()

    def _init_weights(self) -> None:
        """Zero-init so gates start at zero → block starts as identity."""
        nn.init.zeros_(self.mlp[1].weight)
        nn.init.zeros_(self.mlp[1].bias)

    def forward(self, c: torch.Tensor) -> Tuple[torch.Tensor, ...]:
        """
        Args:
            c: Conditioning vector (timestep embedding).  Shape: (B, D)

        Returns:
            Tuple of num_modulations tensors, each of shape (B, 1, D).
            Order: (shift1, scale1, gate1, shift2, scale2, gate2, shift3, scale3, gate3)
        """
        # (B, D) → (B, num_modulations * D)
        modulations = self.mlp(c)
        # (B, num_modulations * D) → num_modulations × (B, 1, D)
        return tuple(
            m.unsqueeze(1)  # (B, D) → (B, 1, D) for broadcasting over N tokens
            for m in modulations.chunk(self.num_modulations, dim=-1)
        )


def modulate(x: torch.Tensor, shift: torch.Tensor, scale: torch.Tensor) -> torch.Tensor:
    """
    Apply adaptive layer norm modulation: x * (1 + scale) + shift.

    Args:
        x: Normalized input.  Shape: (B, N, D)
        shift: Shift parameter.  Shape: (B, 1, D)
        scale: Scale parameter.  Shape: (B, 1, D)

    Returns:
        Modulated output.  Shape: (B, N, D)
    """
    return x * (1.0 + scale) + shift


class DiTBlock(nn.Module):
    """
    Diffusion Transformer block with adaLN-Zero modulation.

    Structure:
        1. adaLN(x) → FactorizedAttention → gate1 * output + x  (self-attention residual)
        2. adaLN(x) → CrossAttention(x, cond) → gate2 * output + x  (cross-attention residual)
        3. adaLN(x) → FeedForward(GEGLU) → gate3 * output + x  (FFN residual)

    The adaLN-Zero mechanism predicts modulation parameters (shift, scale, gate)
    from the timestep embedding. Gates are initialized to zero, making the block
    an identity function at initialization — critical for stable deep training.

    Args:
        dim: Model hidden dimension.
        num_heads: Number of attention heads for self and cross attention.
        cond_dim: Conditioning dimension for cross-attention. None = dim.
        mlp_ratio: FFN expansion ratio.
        dropout: Dropout probability.
        use_rope: Whether to use RoPE3D in self-attention.
        qk_norm: Whether to apply QK normalization.
    """

    def __init__(
        self,
        dim: int,
        num_heads: int,
        cond_dim: Optional[int] = None,
        mlp_ratio: float = 4.0,
        dropout: float = 0.0,
        use_rope: bool = True,
        qk_norm: bool = True,
    ) -> None:
        super().__init__()
        self.dim = dim

        # Layer norms (pre-norm architecture)
        self.norm1 = nn.LayerNorm(dim, elementwise_affine=False, eps=1e-6)
        self.norm2 = nn.LayerNorm(dim, elementwise_affine=False, eps=1e-6)
        self.norm3 = nn.LayerNorm(dim, elementwise_affine=False, eps=1e-6)

        # Sub-block 1: Factorized spatiotemporal self-attention
        self.self_attn = FactorizedAttention(
            dim=dim,
            num_heads=num_heads,
            qk_norm=qk_norm,
            dropout=dropout,
            use_rope=use_rope,
        )

        # Sub-block 2: Cross-attention with conditioning (text/image)
        self.cross_attn = CrossAttention(
            dim=dim,
            cond_dim=cond_dim,
            num_heads=num_heads,
            qk_norm=qk_norm,
            dropout=dropout,
        )

        # Sub-block 3: GEGLU feed-forward
        self.ffn = FeedForward(dim=dim, mlp_ratio=mlp_ratio, dropout=dropout)

        # adaLN-Zero modulation: predicts 9 params (shift, scale, gate) × 3 sub-blocks
        self.adaln = AdaLNModulation(dim=dim, num_modulations=9)

    def forward(
        self,
        x: torch.Tensor,
        t_emb: torch.Tensor,
        cond: torch.Tensor,
        grid_t: int,
        grid_h: int,
        grid_w: int,
        rope_grids: Optional[Tuple[torch.Tensor, torch.Tensor, torch.Tensor]] = None,
    ) -> torch.Tensor:
        """
        Args:
            x: Input tokens.             Shape: (B, N, D)  where N = T*H*W
            t_emb: Timestep embedding.    Shape: (B, D)
            cond: Conditioning tokens.    Shape: (B, N_cond, D_cond)
            grid_t: Number of temporal positions.
            grid_h: Number of height positions.
            grid_w: Number of width positions.
            rope_grids: Optional (grid_t_idx, grid_h_idx, grid_w_idx) for RoPE3D.

        Returns:
            Output tokens.  Shape: (B, N, D)
        """
        # Predict all 9 modulation parameters from timestep embedding
        (
            shift1, scale1, gate1,  # self-attention modulation
            shift2, scale2, gate2,  # cross-attention modulation
            shift3, scale3, gate3,  # FFN modulation
        ) = self.adaln(t_emb)
        # Each: (B, 1, D)

        # ── Sub-block 1: Factorized Self-Attention ──────────────────────────
        residual = x
        x_mod = modulate(self.norm1(x), shift1, scale1)  # (B, N, D)
        x_attn = self.self_attn(x_mod, grid_t, grid_h, grid_w, rope_grids=rope_grids)
        x = residual + gate1 * x_attn  # Gated residual; gate1 starts at 0

        # ── Sub-block 2: Cross-Attention with conditioning ──────────────────
        residual = x
        x_mod = modulate(self.norm2(x), shift2, scale2)  # (B, N, D)
        x_cross = self.cross_attn(x_mod, cond)
        x = residual + gate2 * x_cross  # Gated residual

        # ── Sub-block 3: Feed-Forward (GEGLU) ──────────────────────────────
        residual = x
        x_mod = modulate(self.norm3(x), shift3, scale3)  # (B, N, D)
        x_ffn = self.ffn(x_mod)
        x = residual + gate3 * x_ffn  # Gated residual

        return x  # Shape: (B, N, D)
