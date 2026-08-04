"""
Attention modules for the Hydra Diffusion Transformer.

Provides:
- MultiHeadAttention: Core MHA with RoPE3D support and F.scaled_dot_product_attention
- SpatialSelfAttention: Per-frame spatial attention (B*T, H*W, D)
- TemporalSelfAttention: Per-position temporal attention (B*H*W, T, D)
- CrossAttention: Cross-attention with separate Q and KV sources
- FactorizedAttention: Sequential spatial → temporal for efficiency
"""

from typing import Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from hydra.transformer.embeddings import RoPE3D


class RMSNorm(nn.Module):
    """
    Root Mean Square Layer Normalization.

    Faster than LayerNorm since it skips the mean subtraction step.
    Used for QK normalization to stabilize attention logits.

    Args:
        dim: Feature dimension to normalize over.
        eps: Epsilon for numerical stability.
    """

    def __init__(self, dim: int, eps: float = 1e-6) -> None:
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input tensor.  Shape: (..., dim)

        Returns:
            Normalized tensor.  Shape: (..., dim)
        """
        # RMS norm: x / sqrt(mean(x^2) + eps) * weight
        rms = torch.rsqrt(x.float().pow(2).mean(dim=-1, keepdim=True) + self.eps)
        return (x.float() * rms).to(x.dtype) * self.weight


class MultiHeadAttention(nn.Module):
    """
    Multi-Head Attention with support for RoPE3D and QK normalization.

    Uses PyTorch 2.0+ F.scaled_dot_product_attention which auto-selects
    the optimal backend (FlashAttention, Memory-Efficient, or Math).

    Args:
        dim: Model hidden dimension.
        num_heads: Number of attention heads.
        qkv_bias: Whether to use bias in QKV projections.
        qk_norm: Whether to apply RMSNorm to Q and K before attention.
        dropout: Attention dropout probability.
        rope: Optional RoPE3D module for positional encoding.
    """

    def __init__(
        self,
        dim: int,
        num_heads: int,
        qkv_bias: bool = True,
        qk_norm: bool = True,
        dropout: float = 0.0,
        rope: Optional[RoPE3D] = None,
    ) -> None:
        super().__init__()
        assert dim % num_heads == 0, f"dim={dim} not divisible by num_heads={num_heads}"

        self.dim = dim
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.dropout = dropout
        self.rope = rope

        # Fused QKV projection for efficiency
        self.qkv = nn.Linear(dim, 3 * dim, bias=qkv_bias)
        self.out_proj = nn.Linear(dim, dim)

        # Optional QK normalization for stable attention logits
        self.qk_norm = qk_norm
        if qk_norm:
            self.q_norm = RMSNorm(self.head_dim)
            self.k_norm = RMSNorm(self.head_dim)

        self._init_weights()

    def _init_weights(self) -> None:
        """Kaiming init for QKV, zero init for output projection."""
        nn.init.kaiming_normal_(self.qkv.weight, nonlinearity="linear")
        if self.qkv.bias is not None:
            nn.init.zeros_(self.qkv.bias)
        # Output projection starts at zero → block starts as identity (adaLN-Zero)
        nn.init.zeros_(self.out_proj.weight)
        nn.init.zeros_(self.out_proj.bias)

    def forward(
        self,
        x: torch.Tensor,
        attn_mask: Optional[torch.Tensor] = None,
        rope_grids: Optional[Tuple[torch.Tensor, torch.Tensor, torch.Tensor]] = None,
    ) -> torch.Tensor:
        """
        Args:
            x: Input tokens.  Shape: (B, N, D)
            attn_mask: Optional attention mask.  Shape: (B, N, N) or (B, 1, N, N)
                       True = attend, False = mask out.
            rope_grids: Optional tuple (grid_t, grid_h, grid_w) each of shape (N,)
                        for 3D rotary positional encoding.

        Returns:
            Output tokens.  Shape: (B, N, D)
        """
        B, N, D = x.shape

        # Fused QKV: (B, N, D) → (B, N, 3*D) → (B, N, 3, H, head_dim)
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim)
        # → 3 × (B, H, N, head_dim) via permute and unbind
        qkv = qkv.permute(2, 0, 3, 1, 4)  # (3, B, H, N, head_dim)
        q, k, v = qkv.unbind(0)  # each: (B, H, N, head_dim)

        # Optional QK normalization (stabilizes attention with large head dims)
        if self.qk_norm:
            q = self.q_norm(q)  # (B, H, N, head_dim)
            k = self.k_norm(k)  # (B, H, N, head_dim)

        # Apply RoPE3D if provided
        if self.rope is not None and rope_grids is not None:
            grid_t, grid_h, grid_w = rope_grids
            q, k = self.rope(q, k, grid_t, grid_h, grid_w)

        # F.scaled_dot_product_attention auto-selects FlashAttention when possible
        # (B, H, N, head_dim) → (B, H, N, head_dim)
        attn_out = F.scaled_dot_product_attention(
            q, k, v,
            attn_mask=attn_mask,
            dropout_p=self.dropout if self.training else 0.0,
        )

        # (B, H, N, head_dim) → (B, N, H, head_dim) → (B, N, D)
        attn_out = attn_out.transpose(1, 2).reshape(B, N, D)

        # Output projection
        return self.out_proj(attn_out)  # Shape: (B, N, D)


class SpatialSelfAttention(nn.Module):
    """
    Self-attention within each spatial frame.

    Reshapes from video token layout (B, T*H*W, D) to per-frame
    (B*T, H*W, D), runs MHA within each frame independently, then
    reshapes back. This captures intra-frame spatial relationships.

    Args:
        dim: Model hidden dimension.
        num_heads: Number of attention heads.
        qk_norm: Whether to apply QK normalization.
        dropout: Attention dropout probability.
        rope: Optional RoPE3D module.
    """

    def __init__(
        self,
        dim: int,
        num_heads: int,
        qk_norm: bool = True,
        dropout: float = 0.0,
        rope: Optional[RoPE3D] = None,
    ) -> None:
        super().__init__()
        self.attn = MultiHeadAttention(
            dim=dim,
            num_heads=num_heads,
            qk_norm=qk_norm,
            dropout=dropout,
            rope=rope,
        )

    def forward(
        self,
        x: torch.Tensor,
        grid_t: int,
        grid_h: int,
        grid_w: int,
        rope_grids: Optional[Tuple[torch.Tensor, torch.Tensor, torch.Tensor]] = None,
    ) -> torch.Tensor:
        """
        Args:
            x: Video tokens.  Shape: (B, T*H*W, D)
            grid_t: Number of temporal positions.
            grid_h: Number of height positions.
            grid_w: Number of width positions.
            rope_grids: Optional (grid_t_idx, grid_h_idx, grid_w_idx) for RoPE3D.

        Returns:
            Output tokens.  Shape: (B, T*H*W, D)
        """
        B, N, D = x.shape
        assert N == grid_t * grid_h * grid_w, (
            f"Token count N={N} != grid_t*grid_h*grid_w={grid_t * grid_h * grid_w}"
        )

        # Reshape: (B, T*H*W, D) → (B, T, H*W, D) → (B*T, H*W, D)
        x = x.reshape(B, grid_t, grid_h * grid_w, D)
        x = x.reshape(B * grid_t, grid_h * grid_w, D)

        # Build spatial-only RoPE grids if full grids provided
        spatial_rope = None
        if rope_grids is not None:
            gt, gh, gw = rope_grids
            # The grids have shape (T*H*W,). We need to extract the spatial part
            # for a single frame. Since tokens are ordered as T, H, W:
            # positions repeat every H*W tokens.
            hw = grid_h * grid_w
            # Take the spatial grid from the first frame (positions repeat)
            spatial_rope = (
                gt[:hw],  # temporal positions (constant within frame)
                gh[:hw],  # height positions
                gw[:hw],  # width positions
            )

        # (B*T, H*W, D) → (B*T, H*W, D)
        x = self.attn(x, rope_grids=spatial_rope)

        # Reshape back: (B*T, H*W, D) → (B, T, H*W, D) → (B, T*H*W, D)
        x = x.reshape(B, grid_t, grid_h * grid_w, D)
        x = x.reshape(B, N, D)

        return x


class TemporalSelfAttention(nn.Module):
    """
    Self-attention across frames at each spatial position.

    Reshapes from (B, T*H*W, D) to (B*H*W, T, D) so that each spatial
    position attends across all frames. This captures temporal dynamics
    and motion patterns.

    Args:
        dim: Model hidden dimension.
        num_heads: Number of attention heads.
        qk_norm: Whether to apply QK normalization.
        dropout: Attention dropout probability.
        rope: Optional RoPE3D module.
    """

    def __init__(
        self,
        dim: int,
        num_heads: int,
        qk_norm: bool = True,
        dropout: float = 0.0,
        rope: Optional[RoPE3D] = None,
    ) -> None:
        super().__init__()
        self.attn = MultiHeadAttention(
            dim=dim,
            num_heads=num_heads,
            qk_norm=qk_norm,
            dropout=dropout,
            rope=rope,
        )

    def forward(
        self,
        x: torch.Tensor,
        grid_t: int,
        grid_h: int,
        grid_w: int,
        rope_grids: Optional[Tuple[torch.Tensor, torch.Tensor, torch.Tensor]] = None,
    ) -> torch.Tensor:
        """
        Args:
            x: Video tokens.  Shape: (B, T*H*W, D)
            grid_t: Number of temporal positions.
            grid_h: Number of height positions.
            grid_w: Number of width positions.
            rope_grids: Optional (grid_t_idx, grid_h_idx, grid_w_idx) for RoPE3D.

        Returns:
            Output tokens.  Shape: (B, T*H*W, D)
        """
        B, N, D = x.shape
        hw = grid_h * grid_w

        # Reshape: (B, T*H*W, D) → (B, T, H*W, D) → (B, H*W, T, D) → (B*H*W, T, D)
        x = x.reshape(B, grid_t, hw, D)
        x = x.permute(0, 2, 1, 3).contiguous()  # (B, H*W, T, D)
        x = x.reshape(B * hw, grid_t, D)         # (B*H*W, T, D)

        # Build temporal-only RoPE grids if full grids provided
        temporal_rope = None
        if rope_grids is not None:
            gt, gh, gw = rope_grids
            # For temporal attention at a single spatial position,
            # extract temporal indices (one per frame).
            # Tokens are ordered [t0_h0_w0, t0_h0_w1, ..., t1_h0_w0, ...]
            # so temporal index repeats every H*W tokens.
            temporal_rope = (
                gt[::hw][:grid_t],  # one temporal pos per frame
                gh[::hw][:grid_t],  # spatial pos (constant across frames at same position)
                gw[::hw][:grid_t],
            )

        # (B*H*W, T, D) → (B*H*W, T, D)
        x = self.attn(x, rope_grids=temporal_rope)

        # Reshape back: (B*H*W, T, D) → (B, H*W, T, D) → (B, T, H*W, D) → (B, T*H*W, D)
        x = x.reshape(B, hw, grid_t, D)
        x = x.permute(0, 2, 1, 3).contiguous()  # (B, T, H*W, D)
        x = x.reshape(B, N, D)

        return x


class CrossAttention(nn.Module):
    """
    Cross-attention module: Q from main tokens, KV from conditioning tokens.

    Used for text-to-video conditioning and for the attention bridge
    between visual and audio branches.

    Args:
        dim: Query dimension.
        cond_dim: Conditioning dimension (K/V source). If None, defaults to dim.
        num_heads: Number of attention heads.
        qk_norm: Whether to apply QK normalization.
        dropout: Attention dropout probability.
    """

    def __init__(
        self,
        dim: int,
        cond_dim: Optional[int] = None,
        num_heads: int = 8,
        qk_norm: bool = True,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        cond_dim = cond_dim or dim
        assert dim % num_heads == 0, f"dim={dim} not divisible by num_heads={num_heads}"

        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.dropout = dropout

        # Separate Q and KV projections (dimensions may differ)
        self.q_proj = nn.Linear(dim, dim)
        self.kv_proj = nn.Linear(cond_dim, 2 * dim)
        self.out_proj = nn.Linear(dim, dim)

        # Optional QK normalization
        self.qk_norm = qk_norm
        if qk_norm:
            self.q_norm = RMSNorm(self.head_dim)
            self.k_norm = RMSNorm(self.head_dim)

        self._init_weights()

    def _init_weights(self) -> None:
        """Kaiming init for projections, zero init for output."""
        nn.init.kaiming_normal_(self.q_proj.weight, nonlinearity="linear")
        nn.init.zeros_(self.q_proj.bias)
        nn.init.kaiming_normal_(self.kv_proj.weight, nonlinearity="linear")
        nn.init.zeros_(self.kv_proj.bias)
        nn.init.zeros_(self.out_proj.weight)
        nn.init.zeros_(self.out_proj.bias)

    def forward(
        self,
        x: torch.Tensor,
        cond: torch.Tensor,
        attn_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """
        Args:
            x: Query tokens.         Shape: (B, N_q, D)
            cond: Conditioning tokens. Shape: (B, N_kv, D_cond)
            attn_mask: Optional mask.  Shape: (B, N_q, N_kv) or (B, 1, N_q, N_kv)

        Returns:
            Output tokens.  Shape: (B, N_q, D)
        """
        B, N_q, D = x.shape
        N_kv = cond.shape[1]

        # Q from main tokens: (B, N_q, D) → (B, H, N_q, head_dim)
        q = self.q_proj(x).reshape(B, N_q, self.num_heads, self.head_dim)
        q = q.permute(0, 2, 1, 3)  # (B, H, N_q, head_dim)

        # KV from conditioning: (B, N_kv, D_cond) → (B, N_kv, 2, H, head_dim)
        kv = self.kv_proj(cond).reshape(B, N_kv, 2, self.num_heads, self.head_dim)
        kv = kv.permute(2, 0, 3, 1, 4)  # (2, B, H, N_kv, head_dim)
        k, v = kv.unbind(0)  # each: (B, H, N_kv, head_dim)

        # Optional QK normalization
        if self.qk_norm:
            q = self.q_norm(q)
            k = self.k_norm(k)

        # Scaled dot-product attention with auto flash-attention selection
        attn_out = F.scaled_dot_product_attention(
            q, k, v,
            attn_mask=attn_mask,
            dropout_p=self.dropout if self.training else 0.0,
        )  # Shape: (B, H, N_q, head_dim)

        # (B, H, N_q, head_dim) → (B, N_q, D)
        attn_out = attn_out.transpose(1, 2).reshape(B, N_q, D)

        return self.out_proj(attn_out)  # Shape: (B, N_q, D)


class FactorizedAttention(nn.Module):
    """
    Factorized spatiotemporal attention: spatial → temporal in sequence.

    Instead of full 3D self-attention with O((T*H*W)^2) cost, this
    factorizes into spatial attention O(T * (H*W)^2) followed by
    temporal attention O(H*W * T^2), yielding significant memory savings
    for high-resolution video.

    Args:
        dim: Model hidden dimension.
        num_heads: Number of attention heads.
        qk_norm: Whether to apply QK normalization.
        dropout: Attention dropout probability.
        use_rope: Whether to use RoPE3D positional encoding.
        head_dim: Head dimension for RoPE3D (used only if use_rope=True).
    """

    def __init__(
        self,
        dim: int,
        num_heads: int,
        qk_norm: bool = True,
        dropout: float = 0.0,
        use_rope: bool = True,
        head_dim: Optional[int] = None,
    ) -> None:
        super().__init__()
        _head_dim = head_dim or (dim // num_heads)
        rope = RoPE3D(head_dim=_head_dim) if use_rope else None

        self.spatial_attn = SpatialSelfAttention(
            dim=dim, num_heads=num_heads, qk_norm=qk_norm,
            dropout=dropout, rope=rope,
        )
        self.temporal_attn = TemporalSelfAttention(
            dim=dim, num_heads=num_heads, qk_norm=qk_norm,
            dropout=dropout, rope=rope,
        )

    def forward(
        self,
        x: torch.Tensor,
        grid_t: int,
        grid_h: int,
        grid_w: int,
        rope_grids: Optional[Tuple[torch.Tensor, torch.Tensor, torch.Tensor]] = None,
    ) -> torch.Tensor:
        """
        Apply factorized spatial then temporal self-attention.

        Args:
            x: Video tokens.  Shape: (B, T*H*W, D)
            grid_t: Number of temporal positions.
            grid_h: Number of height positions.
            grid_w: Number of width positions.
            rope_grids: Optional (grid_t_idx, grid_h_idx, grid_w_idx) for RoPE3D.

        Returns:
            Output tokens.  Shape: (B, T*H*W, D)
        """
        # Step 1: Spatial attention within each frame
        x = self.spatial_attn(x, grid_t, grid_h, grid_w, rope_grids=rope_grids)

        # Step 2: Temporal attention across frames at each spatial position
        x = self.temporal_attn(x, grid_t, grid_h, grid_w, rope_grids=rope_grids)

        return x  # Shape: (B, T*H*W, D)
