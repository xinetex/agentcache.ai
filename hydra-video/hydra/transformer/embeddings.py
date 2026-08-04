"""
Embedding modules for the Hydra Diffusion Transformer.

Provides:
- PatchEmbed3D: 3D patchification of video latents into token sequences
- TimestepEmbedding: Sinusoidal + MLP timestep conditioning
- RoPE3D: Factorized 3D Rotary Positional Encoding across (T, H, W) axes
"""

import math
from typing import Tuple, Optional

import torch
import torch.nn as nn
import torch.nn.functional as F


class PatchEmbed3D(nn.Module):
    """
    Converts video latent tensors into a flat token sequence via 3D convolution.

    The latent tensor (B, C, T, H, W) is divided into non-overlapping 3D patches
    of size (pt, ph, pw) and linearly projected to the model hidden dimension.

    Args:
        in_channels: Number of input latent channels.
        hidden_dim: Model hidden dimension (token embedding size).
        patch_size: Tuple (pt, ph, pw) — patch extent along time, height, width.
    """

    def __init__(
        self,
        in_channels: int = 4,
        hidden_dim: int = 512,
        patch_size: Tuple[int, int, int] = (1, 2, 2),
    ) -> None:
        super().__init__()
        self.patch_size = patch_size  # (pt, ph, pw)
        self.hidden_dim = hidden_dim

        # 3D conv acts as linear projection per patch — kernel and stride equal patch_size
        self.proj = nn.Conv3d(
            in_channels,
            hidden_dim,
            kernel_size=patch_size,
            stride=patch_size,
            bias=True,
        )

        self._init_weights()

    def _init_weights(self) -> None:
        """Xavier uniform for the projection, zero bias."""
        nn.init.xavier_uniform_(self.proj.weight)
        if self.proj.bias is not None:
            nn.init.zeros_(self.proj.bias)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, int, int, int]:
        """
        Args:
            x: Video latent tensor.  Shape: (B, C, T, H, W)

        Returns:
            tokens: Flattened token sequence.  Shape: (B, N, D)
                    where N = (T/pt) * (H/ph) * (W/pw), D = hidden_dim
            grid_t: Number of temporal tokens (T / pt)
            grid_h: Number of height tokens   (H / ph)
            grid_w: Number of width tokens     (W / pw)
        """
        B, C, T, H, W = x.shape
        pt, ph, pw = self.patch_size

        assert T % pt == 0, f"T={T} not divisible by pt={pt}"
        assert H % ph == 0, f"H={H} not divisible by ph={ph}"
        assert W % pw == 0, f"W={W} not divisible by pw={pw}"

        # (B, C, T, H, W) → (B, D, T/pt, H/ph, W/pw)
        x = self.proj(x)

        grid_t = T // pt
        grid_h = H // ph
        grid_w = W // pw

        # (B, D, Gt, Gh, Gw) → (B, D, N) → (B, N, D)
        x = x.flatten(2).transpose(1, 2)  # Shape: (B, N, D)

        return x, grid_t, grid_h, grid_w


class TimestepEmbedding(nn.Module):
    """
    Sinusoidal timestep encoding followed by a 2-layer MLP.

    Maps a scalar timestep in [0, 1] to a dense embedding vector suitable for
    conditioning the diffusion transformer via adaLN-Zero.

    Architecture:
        sinusoidal(t) → Linear(freq_dim, hidden_dim) → SiLU → Linear(hidden_dim, hidden_dim)

    Args:
        hidden_dim: Output embedding dimension.
        num_frequencies: Number of sinusoidal frequency bands (output dim = 2 * num_frequencies).
    """

    def __init__(
        self,
        hidden_dim: int = 512,
        num_frequencies: int = 256,
    ) -> None:
        super().__init__()
        self.num_frequencies = num_frequencies
        freq_dim = 2 * num_frequencies  # sin + cos for each frequency

        self.mlp = nn.Sequential(
            nn.Linear(freq_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, hidden_dim),
        )

        self._init_weights()

    def _init_weights(self) -> None:
        """Kaiming init for first layer, zero init for output layer."""
        nn.init.kaiming_normal_(self.mlp[0].weight, nonlinearity="relu")
        nn.init.zeros_(self.mlp[0].bias)
        nn.init.zeros_(self.mlp[2].weight)
        nn.init.zeros_(self.mlp[2].bias)

    def _sinusoidal_encoding(self, t: torch.Tensor) -> torch.Tensor:
        """
        Compute sinusoidal positional encoding for continuous timesteps.

        Args:
            t: Timestep values in [0, 1].  Shape: (B,)

        Returns:
            Sinusoidal features.  Shape: (B, 2 * num_frequencies)
        """
        # Frequency bands: exp-spaced from 1 to max_freq
        # Using the standard transformer frequency schedule
        half = self.num_frequencies
        freqs = torch.exp(
            -math.log(10000.0)
            * torch.arange(half, dtype=torch.float32, device=t.device)
            / half
        )  # Shape: (num_frequencies,)

        # Outer product: (B, 1) * (1, num_frequencies) → (B, num_frequencies)
        args = t.unsqueeze(-1).float() * freqs.unsqueeze(0) * 1000.0

        # Interleave sin and cos → (B, 2 * num_frequencies)
        encoding = torch.cat([torch.sin(args), torch.cos(args)], dim=-1)
        return encoding

    def forward(self, t: torch.Tensor) -> torch.Tensor:
        """
        Args:
            t: Diffusion timestep in [0, 1].  Shape: (B,)

        Returns:
            Timestep embedding.  Shape: (B, hidden_dim)
        """
        # (B,) → (B, 2 * num_frequencies) → (B, hidden_dim)
        sinusoidal = self._sinusoidal_encoding(t)
        return self.mlp(sinusoidal)


class RoPE3D(nn.Module):
    """
    3D Rotary Positional Encoding for video diffusion transformers.

    Factorizes the head dimension into three equal segments assigned to the
    temporal (T), height (H), and width (W) axes. Each segment receives
    independent rotary frequencies, enabling the model to learn separate
    positional structure along each axis while maintaining long-range
    temporal coherence.

    For head_dim not divisible by 3, the remainder dimensions are assigned
    to the temporal axis (most important for video coherence).

    Args:
        head_dim: Dimension per attention head (will be split ~evenly across 3 axes).
        max_seq_len: Maximum sequence length per axis for frequency precomputation.
        theta_base: Base for the geometric frequency schedule (default 10000).
    """

    def __init__(
        self,
        head_dim: int = 64,
        max_seq_len: int = 256,
        theta_base: float = 10000.0,
    ) -> None:
        super().__init__()
        self.head_dim = head_dim
        self.max_seq_len = max_seq_len
        self.theta_base = theta_base

        # Split head_dim across 3 axes. Remainder goes to temporal axis.
        dim_per_axis = head_dim // 3
        self.dim_t = dim_per_axis + (head_dim % 3)  # temporal gets remainder
        self.dim_h = dim_per_axis
        self.dim_w = dim_per_axis

        # Precompute inverse frequency vectors for each axis
        # Each uses half the axis dim for (sin, cos) pairs
        self.register_buffer(
            "inv_freq_t",
            self._compute_inv_freq(self.dim_t),
            persistent=False,
        )
        self.register_buffer(
            "inv_freq_h",
            self._compute_inv_freq(self.dim_h),
            persistent=False,
        )
        self.register_buffer(
            "inv_freq_w",
            self._compute_inv_freq(self.dim_w),
            persistent=False,
        )

    def _compute_inv_freq(self, dim: int) -> torch.Tensor:
        """
        Compute inverse frequencies for rotary encoding of a given dimension.

        Args:
            dim: Number of dimensions allocated to this axis (must be even).

        Returns:
            Inverse frequency vector.  Shape: (dim // 2,)
        """
        # Ensure even dimension for sin/cos pairing
        half_dim = dim // 2
        if half_dim == 0:
            return torch.zeros(1)
        inv_freq = 1.0 / (
            self.theta_base
            ** (torch.arange(0, half_dim, dtype=torch.float32) / half_dim)
        )  # Shape: (half_dim,)
        return inv_freq

    def _build_rotation_matrix(
        self, positions: torch.Tensor, inv_freq: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Build sin/cos rotation components for a set of positions.

        Args:
            positions: Position indices.  Shape: (N,)
            inv_freq: Inverse frequencies.  Shape: (half_dim,)

        Returns:
            cos_: Cosine rotation matrix.  Shape: (N, dim) where dim = 2 * half_dim
            sin_: Sine rotation matrix.    Shape: (N, dim)
        """
        # Outer product: (N, 1) × (1, half_dim) → (N, half_dim)
        freqs = positions.float().unsqueeze(-1) * inv_freq.unsqueeze(0)
        # Duplicate for (sin, cos) pairing → (N, dim)
        freqs = torch.cat([freqs, freqs], dim=-1)
        return freqs.cos(), freqs.sin()

    @staticmethod
    def _rotate_half(x: torch.Tensor) -> torch.Tensor:
        """
        Rotate the last dimension by swapping and negating halves.
        This implements the RoPE rotation pattern: [-x2, x1] for pairs.

        Args:
            x: Input tensor.  Shape: (..., dim)  where dim is even.

        Returns:
            Rotated tensor.  Shape: (..., dim)
        """
        x1, x2 = x.chunk(2, dim=-1)  # each: (..., dim // 2)
        return torch.cat([-x2, x1], dim=-1)  # Shape: (..., dim)

    def forward(
        self,
        q: torch.Tensor,
        k: torch.Tensor,
        grid_t: torch.Tensor,
        grid_h: torch.Tensor,
        grid_w: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Apply 3D factorized rotary positional encoding to Q and K.

        The head dimension is split into three segments. Each segment is rotated
        according to its axis-specific positional frequencies.

        Args:
            q: Query tensor.  Shape: (B, num_heads, N, head_dim)
            k: Key tensor.    Shape: (B, num_heads, N, head_dim)
            grid_t: Temporal position indices for each token.  Shape: (N,)
            grid_h: Height position indices for each token.    Shape: (N,)
            grid_w: Width position indices for each token.     Shape: (N,)

        Returns:
            q_rotated: Q with RoPE applied.  Shape: (B, num_heads, N, head_dim)
            k_rotated: K with RoPE applied.  Shape: (B, num_heads, N, head_dim)
        """
        device = q.device
        dtype = q.dtype

        # Move inv_freq to correct device (handles lazy buffer movement)
        inv_freq_t = self.inv_freq_t.to(device=device)
        inv_freq_h = self.inv_freq_h.to(device=device)
        inv_freq_w = self.inv_freq_w.to(device=device)

        # Build rotation matrices for each axis
        # Each returns (N, dim_axis) shaped cos/sin tensors
        cos_t, sin_t = self._build_rotation_matrix(grid_t, inv_freq_t)
        cos_h, sin_h = self._build_rotation_matrix(grid_h, inv_freq_h)
        cos_w, sin_w = self._build_rotation_matrix(grid_w, inv_freq_w)

        # Concatenate along the dim axis to cover full head_dim
        # cos/sin shapes: (N, dim_t + dim_h + dim_w) = (N, head_dim)
        # Note: dim_t + dim_h + dim_w may be < head_dim if dims are odd;
        # we handle this by ensuring dims sum correctly in __init__
        cos_full = torch.cat([cos_t, cos_h, cos_w], dim=-1).to(dtype)  # (N, head_dim)
        sin_full = torch.cat([sin_t, sin_h, sin_w], dim=-1).to(dtype)  # (N, head_dim)

        # Truncate or pad to exactly head_dim (handles rounding)
        actual_dim = cos_full.shape[-1]
        if actual_dim > self.head_dim:
            cos_full = cos_full[..., : self.head_dim]
            sin_full = sin_full[..., : self.head_dim]
        elif actual_dim < self.head_dim:
            # Pad remaining dims with identity rotation (cos=1, sin=0)
            pad = self.head_dim - actual_dim
            cos_full = F.pad(cos_full, (0, pad), value=1.0)
            sin_full = F.pad(sin_full, (0, pad), value=0.0)

        # Broadcast: (N, head_dim) → (1, 1, N, head_dim) for (B, H, N, D)
        cos_full = cos_full.unsqueeze(0).unsqueeze(0)
        sin_full = sin_full.unsqueeze(0).unsqueeze(0)

        # Apply rotary embedding: x * cos + rotate_half(x) * sin
        q_rotated = q * cos_full + self._rotate_half(q) * sin_full
        k_rotated = k * cos_full + self._rotate_half(k) * sin_full

        return q_rotated, k_rotated
