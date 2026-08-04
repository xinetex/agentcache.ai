"""
Video encoder for the Causal 3D VAE.

Compresses video from pixel space to a low-dimensional latent space:
    (B, 3, T, H, W) → (B, 2*latent_dim, T//4, H//8, W//8)

Architecture:
    in_conv → [Downsample Stage × 3] → Mid Block → to_latent

Each downsample stage contains ResBlock3D units and optional SpatialAttention3D.
Outputs mean and log-variance for reparameterized sampling.
"""

import math
from typing import List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from hydra.vae.causal_conv3d import CausalConv3d


class ResBlock3D(nn.Module):
    """Residual block with two causal 3D convolutions.

    Structure: GroupNorm → SiLU → CausalConv3d → GroupNorm → SiLU → Dropout → CausalConv3d + skip
    If in_channels != out_channels, a 1×1×1 conv projects the skip connection.

    Args:
        in_channels: Number of input channels.
        out_channels: Number of output channels.
        dropout: Dropout probability.
        num_groups: Number of groups for GroupNorm.
    """

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        dropout: float = 0.0,
        num_groups: int = 32,
    ) -> None:
        super().__init__()

        # Clamp num_groups to not exceed channel count
        num_groups_1 = min(num_groups, in_channels)
        num_groups_2 = min(num_groups, out_channels)

        self.norm1 = nn.GroupNorm(num_groups_1, in_channels)
        self.act1 = nn.SiLU(inplace=False)
        self.conv1 = CausalConv3d(in_channels, out_channels, kernel_size=3, stride=1)

        self.norm2 = nn.GroupNorm(num_groups_2, out_channels)
        self.act2 = nn.SiLU(inplace=False)
        self.dropout = nn.Dropout(dropout) if dropout > 0.0 else nn.Identity()
        self.conv2 = CausalConv3d(out_channels, out_channels, kernel_size=3, stride=1)

        # Skip connection: identity if channels match, else 1×1×1 projection
        if in_channels != out_channels:
            self.skip_proj = CausalConv3d(in_channels, out_channels, kernel_size=1, stride=1)
        else:
            self.skip_proj = nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Apply residual block.

        Args:
            x: Input tensor of shape (B, C_in, T, H, W).

        Returns:
            Output tensor of shape (B, C_out, T, H, W).
        """
        # x: (B, C_in, T, H, W)
        residual = self.skip_proj(x)
        # residual: (B, C_out, T, H, W)

        h = self.norm1(x)        # (B, C_in, T, H, W)
        h = self.act1(h)         # (B, C_in, T, H, W)
        h = self.conv1(h)        # (B, C_out, T, H, W)

        h = self.norm2(h)        # (B, C_out, T, H, W)
        h = self.act2(h)         # (B, C_out, T, H, W)
        h = self.dropout(h)      # (B, C_out, T, H, W)
        h = self.conv2(h)        # (B, C_out, T, H, W)

        return h + residual
        # output: (B, C_out, T, H, W)


class Downsample3D(nn.Module):
    """Spatial or spatiotemporal downsampling via strided causal convolution.

    Args:
        channels: Number of channels (preserved through downsampling).
        spatial_only: If True, only downsample spatial dims (stride=(1,2,2)).
                      If False, downsample spatiotemporally (stride=(2,2,2)).
    """

    def __init__(self, channels: int, spatial_only: bool = True) -> None:
        super().__init__()
        self.spatial_only = spatial_only

        if spatial_only:
            stride = (1, 2, 2)
        else:
            stride = (2, 2, 2)

        # 3×3×3 strided causal conv for downsampling
        self.conv = CausalConv3d(
            channels, channels, kernel_size=3, stride=stride
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Downsample input.

        Args:
            x: Input tensor of shape (B, C, T, H, W).

        Returns:
            Downsampled tensor of shape:
                (B, C, T, H//2, W//2)       if spatial_only
                (B, C, T//2, H//2, W//2)    if spatiotemporal
        """
        # x: (B, C, T, H, W)
        return self.conv(x)
        # spatial_only:     (B, C, T, H//2, W//2)
        # spatiotemporal:   (B, C, T//2, H//2, W//2)


class SpatialAttention3D(nn.Module):
    """Self-attention operating on flattened spatial dims per frame.

    For each frame independently, flattens H×W into a sequence and applies
    multi-head self-attention. This is more memory-efficient than full 3D
    attention and is used at the bottleneck resolution.

    Args:
        channels: Number of input/output channels.
        num_heads: Number of attention heads.
        num_groups: Number of groups for GroupNorm.
    """

    def __init__(
        self,
        channels: int,
        num_heads: int = 4,
        num_groups: int = 32,
    ) -> None:
        super().__init__()

        self.channels = channels
        self.num_heads = num_heads
        self.head_dim = channels // num_heads
        assert channels % num_heads == 0, (
            f"channels ({channels}) must be divisible by num_heads ({num_heads})"
        )

        self.norm = nn.GroupNorm(min(num_groups, channels), channels)

        # QKV projection: single linear for efficiency
        self.to_qkv = nn.Linear(channels, 3 * channels, bias=False)

        # Output projection
        self.to_out = nn.Sequential(
            nn.Linear(channels, channels),
            nn.Dropout(0.0),
        )

        self.scale = self.head_dim ** -0.5

        self._init_weights()

    def _init_weights(self) -> None:
        """Initialize attention weights."""
        nn.init.xavier_uniform_(self.to_qkv.weight)
        nn.init.xavier_uniform_(self.to_out[0].weight)
        nn.init.zeros_(self.to_out[0].bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Apply spatial self-attention per frame.

        Args:
            x: Input tensor of shape (B, C, T, H, W).

        Returns:
            Output tensor of shape (B, C, T, H, W) — same shape, refined features.
        """
        B, C, T, H, W = x.shape
        residual = x

        # Normalize
        h = self.norm(x)
        # h: (B, C, T, H, W)

        # Reshape to (B*T, H*W, C) — treat each frame as an independent sequence
        h = h.permute(0, 2, 3, 4, 1).reshape(B * T, H * W, C)
        # h: (B*T, H*W, C)

        # QKV projection
        qkv = self.to_qkv(h)
        # qkv: (B*T, H*W, 3*C)

        qkv = qkv.reshape(B * T, H * W, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)
        # qkv: (3, B*T, num_heads, H*W, head_dim)
        q, k, v = qkv.unbind(0)
        # q, k, v: (B*T, num_heads, H*W, head_dim)

        # Scaled dot-product attention (uses Flash Attention when available)
        attn_out = F.scaled_dot_product_attention(q, k, v, scale=self.scale)
        # attn_out: (B*T, num_heads, H*W, head_dim)

        # Merge heads and project
        attn_out = attn_out.transpose(1, 2).reshape(B * T, H * W, C)
        # attn_out: (B*T, H*W, C)

        out = self.to_out(attn_out)
        # out: (B*T, H*W, C)

        # Reshape back to video tensor
        out = out.reshape(B, T, H, W, C).permute(0, 4, 1, 2, 3)
        # out: (B, C, T, H, W)

        return out + residual
        # output: (B, C, T, H, W)


class VideoEncoder(nn.Module):
    """Full video encoder for the Causal 3D VAE.

    Compresses input video to a latent distribution (mean, log_var).

    Architecture:
        in_conv(3 → ch[0]) →
        Stage 1: ch[0] → ch[1], spatial 2× downsample →
        Stage 2: ch[1] → ch[2], spatiotemporal 2× downsample →
        Stage 3: ch[2] → ch[2], spatiotemporal 2× downsample →
        Mid: ResBlock + SpatialAttention + ResBlock →
        to_latent: ch[2] → 2*latent_dim (1×1×1 conv)

    Input:  (B, 3, T, H, W)
    Output: (B, 2*latent_dim, T//4, H//8, W//8)

    The output encodes both mean and log-variance of the latent posterior,
    split along the channel dimension during reparameterization.

    Args:
        in_channels: Input image channels (usually 3 for RGB).
        latent_dim: Dimension of the latent space per spatial position.
        channels: List of channel counts for each stage.
        num_res_blocks: Number of residual blocks per stage.
        attention_resolutions: Resolutions at which to apply spatial attention
                               (relative to the current spatial size).
        dropout: Dropout probability.
    """

    def __init__(
        self,
        in_channels: int = 3,
        latent_dim: int = 4,
        channels: Optional[List[int]] = None,
        num_res_blocks: int = 2,
        attention_resolutions: Optional[List[int]] = None,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()

        if channels is None:
            channels = [64, 128, 256]
        if attention_resolutions is None:
            attention_resolutions = [32]

        self.in_channels = in_channels
        self.latent_dim = latent_dim
        self.channels = channels
        self.num_res_blocks = num_res_blocks

        # ── Input convolution ──
        self.in_conv = CausalConv3d(in_channels, channels[0], kernel_size=3, stride=1)

        # ── Downsample stages ──
        self.down_stages = nn.ModuleList()

        # Stage configs: (in_ch, out_ch, spatial_only)
        # Stage 1: spatial-only 2× downsample
        # Stage 2: spatiotemporal 2× downsample
        # Stage 3: spatiotemporal 2× downsample
        stage_configs = []
        # channels list defines the progression: e.g., [64, 128, 256]
        # Stage 1: channels[0] → channels[1], spatial only
        # Stage 2: channels[1] → channels[2], spatiotemporal
        # Stage 3: channels[2] → channels[2], spatiotemporal (if 3 stages)
        ch_in = channels[0]
        for i in range(len(channels)):
            ch_out = channels[i] if i >= len(channels) - 1 else channels[min(i + 1, len(channels) - 1)]
            # First stage: only spatial downsample; subsequent stages: spatiotemporal
            spatial_only = (i == 0)

            # For the channel transition: stage i goes from previous ch to channels[i+1]
            # We need to handle this carefully
            if i == 0:
                # Stage 1: channels[0] → channels[1], spatial only
                ch_out = channels[1] if len(channels) > 1 else channels[0]
            elif i < len(channels) - 1:
                # Stage i+1: channels[i] → channels[i+1]
                ch_out = channels[i + 1]
            else:
                # Last stage: channels[-1] → channels[-1]
                ch_out = channels[-1]

            stage_configs.append((ch_in, ch_out, spatial_only))
            ch_in = ch_out

        for stage_idx, (s_in, s_out, spatial_only) in enumerate(stage_configs):
            stage = nn.ModuleDict()

            # Residual blocks for this stage
            blocks = nn.ModuleList()
            for block_idx in range(num_res_blocks):
                block_in = s_in if block_idx == 0 else s_out
                blocks.append(ResBlock3D(block_in, s_out, dropout=dropout))
            stage["res_blocks"] = blocks

            # Optional attention at this resolution
            # We apply attention in the last stage (smallest spatial resolution)
            if stage_idx == len(stage_configs) - 1:
                stage["attention"] = SpatialAttention3D(s_out, num_heads=max(1, s_out // 64))
            else:
                stage["attention"] = nn.Identity()

            # Downsample
            stage["downsample"] = Downsample3D(s_out, spatial_only=spatial_only)

            self.down_stages.append(stage)

        # ── Mid block ──
        mid_ch = channels[-1]
        self.mid_block = nn.ModuleDict({
            "res1": ResBlock3D(mid_ch, mid_ch, dropout=dropout),
            "attn": SpatialAttention3D(mid_ch, num_heads=max(1, mid_ch // 64)),
            "res2": ResBlock3D(mid_ch, mid_ch, dropout=dropout),
        })

        # ── To latent space ──
        # 1×1×1 conv to project to 2*latent_dim (mean + log_var)
        self.norm_out = nn.GroupNorm(min(32, mid_ch), mid_ch)
        self.act_out = nn.SiLU(inplace=False)
        self.to_latent = CausalConv3d(mid_ch, 2 * latent_dim, kernel_size=1, stride=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Encode video to latent distribution parameters.

        Args:
            x: Input video tensor of shape (B, 3, T, H, W).

        Returns:
            Latent parameters of shape (B, 2*latent_dim, T//4, H//8, W//8).
            First `latent_dim` channels are mean, last `latent_dim` are log_var.
        """
        # x: (B, 3, T, H, W)

        h = self.in_conv(x)
        # h: (B, channels[0], T, H, W)

        # Downsample stages
        for stage in self.down_stages:
            for res_block in stage["res_blocks"]:
                h = res_block(h)
            h = stage["attention"](h)
            h = stage["downsample"](h)
        # After 3 stages with configs (spatial, spatiotemporal, spatiotemporal):
        # h: (B, channels[-1], T//4, H//8, W//8)

        # Mid block
        h = self.mid_block["res1"](h)
        # h: (B, channels[-1], T//4, H//8, W//8)
        h = self.mid_block["attn"](h)
        # h: (B, channels[-1], T//4, H//8, W//8)
        h = self.mid_block["res2"](h)
        # h: (B, channels[-1], T//4, H//8, W//8)

        # Project to latent
        h = self.norm_out(h)
        # h: (B, channels[-1], T//4, H//8, W//8)
        h = self.act_out(h)
        # h: (B, channels[-1], T//4, H//8, W//8)
        h = self.to_latent(h)
        # h: (B, 2*latent_dim, T//4, H//8, W//8)

        return h
