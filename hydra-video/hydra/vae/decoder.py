"""
Video decoder for the Causal 3D VAE.

Reconstructs video from latent space back to pixel space:
    (B, latent_dim, T//4, H//8, W//8) → (B, 3, T, H, W)

Architecture mirrors the encoder:
    from_latent → Mid Block → [Upsample Stage × 3] → out_conv

Uses CausalConvTranspose3d for upsampling to maintain temporal causality.
"""

from typing import List, Optional

import torch
import torch.nn as nn
import torch.nn.functional as F

from hydra.vae.causal_conv3d import CausalConv3d, CausalConvTranspose3d


class ResBlock3DDecoder(nn.Module):
    """Residual block for the decoder with causal 3D convolutions.

    Identical structure to the encoder ResBlock3D:
        GroupNorm → SiLU → CausalConv3d → GroupNorm → SiLU → Dropout → CausalConv3d + skip

    Uses standard CausalConv3d (not transposed) since the convolutions within a
    residual block operate at a fixed resolution — upsampling is handled separately
    by the Upsample3D module.

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


class Upsample3D(nn.Module):
    """Spatial or spatiotemporal upsampling using causal transposed convolution.

    Uses interpolation + convolution approach for better stability than pure
    transposed convolution. Nearest-neighbor upsample followed by a causal conv
    avoids checkerboard artifacts common in transposed convolutions.

    Args:
        channels: Number of channels (preserved through upsampling).
        spatial_only: If True, only upsample spatial dims (2× H and W).
                      If False, upsample spatiotemporally (2× T, H, and W).
    """

    def __init__(self, channels: int, spatial_only: bool = True) -> None:
        super().__init__()
        self.spatial_only = spatial_only

        # Use interpolation + conv for stability (avoids checkerboard artifacts)
        # The conv smooths out the nearest-neighbor interpolation artifacts
        self.conv = CausalConv3d(channels, channels, kernel_size=3, stride=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Upsample input.

        Args:
            x: Input tensor of shape (B, C, T, H, W).

        Returns:
            Upsampled tensor of shape:
                (B, C, T, H*2, W*2)         if spatial_only
                (B, C, T*2, H*2, W*2)       if spatiotemporal
        """
        B, C, T, H, W = x.shape

        if self.spatial_only:
            # Upsample spatial dimensions only by 2×
            x = F.interpolate(
                x, size=(T, H * 2, W * 2), mode="nearest"
            )
            # x: (B, C, T, H*2, W*2)
        else:
            # Upsample all dimensions by 2×
            x = F.interpolate(
                x, size=(T * 2, H * 2, W * 2), mode="nearest"
            )
            # x: (B, C, T*2, H*2, W*2)

        # Smooth with causal conv (preserves temporal causality)
        x = self.conv(x)
        # spatial_only:     (B, C, T, H*2, W*2)
        # spatiotemporal:   (B, C, T*2, H*2, W*2)

        return x


class SpatialAttention3DDecoder(nn.Module):
    """Self-attention on flattened spatial dims per frame (decoder variant).

    Identical to the encoder's SpatialAttention3D. Kept as a separate class
    for clarity and to allow future decoder-specific modifications (e.g.,
    cross-attention to conditioning signals).

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
        self.to_qkv = nn.Linear(channels, 3 * channels, bias=False)
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
            Output tensor of shape (B, C, T, H, W).
        """
        B, C, T, H, W = x.shape
        residual = x

        h = self.norm(x)
        # h: (B, C, T, H, W)

        # Reshape to per-frame sequences
        h = h.permute(0, 2, 3, 4, 1).reshape(B * T, H * W, C)
        # h: (B*T, H*W, C)

        qkv = self.to_qkv(h)
        # qkv: (B*T, H*W, 3*C)

        qkv = qkv.reshape(B * T, H * W, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)
        # qkv: (3, B*T, num_heads, H*W, head_dim)
        q, k, v = qkv.unbind(0)
        # q, k, v: (B*T, num_heads, H*W, head_dim)

        # Scaled dot-product attention (Flash Attention when available)
        attn_out = F.scaled_dot_product_attention(q, k, v, scale=self.scale)
        # attn_out: (B*T, num_heads, H*W, head_dim)

        attn_out = attn_out.transpose(1, 2).reshape(B * T, H * W, C)
        # attn_out: (B*T, H*W, C)

        out = self.to_out(attn_out)
        # out: (B*T, H*W, C)

        out = out.reshape(B, T, H, W, C).permute(0, 4, 1, 2, 3)
        # out: (B, C, T, H, W)

        return out + residual
        # output: (B, C, T, H, W)


class VideoDecoder(nn.Module):
    """Full video decoder for the Causal 3D VAE.

    Reconstructs video from latent space, mirroring the encoder architecture.

    Architecture:
        from_latent(latent_dim → ch[-1]) →
        Mid: ResBlock + SpatialAttention + ResBlock →
        Stage 1: ch[-1] → ch[-1], spatiotemporal 2× upsample →
        Stage 2: ch[-1] → ch[-2], spatiotemporal 2× upsample →
        Stage 3: ch[-2] → ch[-3], spatial 2× upsample →
        out_conv: ch[-3] → 3

    Input:  (B, latent_dim, T//4, H//8, W//8)
    Output: (B, 3, T, H, W)

    Args:
        out_channels: Output image channels (usually 3 for RGB).
        latent_dim: Dimension of the latent space per spatial position.
        channels: List of channel counts, same as encoder (reversed internally).
        num_res_blocks: Number of residual blocks per stage.
        dropout: Dropout probability.
    """

    def __init__(
        self,
        out_channels: int = 3,
        latent_dim: int = 4,
        channels: Optional[List[int]] = None,
        num_res_blocks: int = 2,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()

        if channels is None:
            channels = [64, 128, 256]

        self.out_channels = out_channels
        self.latent_dim = latent_dim
        self.channels = channels

        # Reverse channel list for decoder (encoder goes 64→128→256, decoder goes 256→128→64)
        dec_channels = list(reversed(channels))
        # dec_channels: e.g., [256, 128, 64]

        mid_ch = dec_channels[0]  # Bottleneck channels

        # ── From latent space ──
        self.from_latent = CausalConv3d(latent_dim, mid_ch, kernel_size=1, stride=1)

        # ── Mid block ──
        self.norm_in = nn.GroupNorm(min(32, mid_ch), mid_ch)
        self.act_in = nn.SiLU(inplace=False)
        self.mid_block = nn.ModuleDict({
            "res1": ResBlock3DDecoder(mid_ch, mid_ch, dropout=dropout),
            "attn": SpatialAttention3DDecoder(mid_ch, num_heads=max(1, mid_ch // 64)),
            "res2": ResBlock3DDecoder(mid_ch, mid_ch, dropout=dropout),
        })

        # ── Upsample stages (mirror of encoder downsample stages) ──
        # Encoder stages (forward):
        #   Stage 1: ch[0]→ch[1], spatial 2× down
        #   Stage 2: ch[1]→ch[2], spatiotemporal 2× down
        #   Stage 3: ch[2]→ch[2], spatiotemporal 2× down
        #
        # Decoder stages (reverse):
        #   Stage 1: ch[2]→ch[2], spatiotemporal 2× up   (mirrors encoder stage 3)
        #   Stage 2: ch[2]→ch[1], spatiotemporal 2× up   (mirrors encoder stage 2)
        #   Stage 3: ch[1]→ch[0], spatial 2× up          (mirrors encoder stage 1)

        self.up_stages = nn.ModuleList()

        # Build stage configs: (in_ch, out_ch, spatial_only)
        stage_configs = []
        num_stages = len(channels)

        for i in range(num_stages):
            s_in = dec_channels[i]
            s_out = dec_channels[min(i + 1, num_stages - 1)]

            if i == 0:
                # First decoder stage: same channels, spatiotemporal upsample
                s_out = dec_channels[0]
                spatial_only = False
            elif i < num_stages - 1:
                # Middle stages: channel reduction + spatiotemporal upsample
                s_out = dec_channels[i + 1]
                spatial_only = False
            else:
                # Last stage: channel reduction + spatial-only upsample
                s_out = dec_channels[-1]
                spatial_only = True

            stage_configs.append((s_in, s_out, spatial_only))

        for stage_idx, (s_in, s_out, spatial_only) in enumerate(stage_configs):
            stage = nn.ModuleDict()

            # Residual blocks
            blocks = nn.ModuleList()
            for block_idx in range(num_res_blocks):
                block_in = s_in if block_idx == 0 else s_out
                blocks.append(ResBlock3DDecoder(block_in, s_out, dropout=dropout))
            stage["res_blocks"] = blocks

            # Optional attention at the first stage (highest-level features)
            if stage_idx == 0:
                stage["attention"] = SpatialAttention3DDecoder(
                    s_out, num_heads=max(1, s_out // 64)
                )
            else:
                stage["attention"] = nn.Identity()

            # Upsample
            stage["upsample"] = Upsample3D(s_out, spatial_only=spatial_only)

            self.up_stages.append(stage)

        # ── Output convolution ──
        final_ch = dec_channels[-1]
        self.norm_out = nn.GroupNorm(min(32, final_ch), final_ch)
        self.act_out = nn.SiLU(inplace=False)
        self.out_conv = CausalConv3d(final_ch, out_channels, kernel_size=3, stride=1)

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        """Decode latent tensor back to video.

        Args:
            z: Latent tensor of shape (B, latent_dim, T', H', W') where
               T' = T//4, H' = H//8, W' = W//8.

        Returns:
            Reconstructed video of shape (B, 3, T, H, W).
        """
        # z: (B, latent_dim, T', H', W')

        # Project from latent space
        h = self.from_latent(z)
        # h: (B, mid_ch, T', H', W')

        h = self.norm_in(h)
        # h: (B, mid_ch, T', H', W')
        h = self.act_in(h)
        # h: (B, mid_ch, T', H', W')

        # Mid block
        h = self.mid_block["res1"](h)
        # h: (B, mid_ch, T', H', W')
        h = self.mid_block["attn"](h)
        # h: (B, mid_ch, T', H', W')
        h = self.mid_block["res2"](h)
        # h: (B, mid_ch, T', H', W')

        # Upsample stages
        for stage in self.up_stages:
            for res_block in stage["res_blocks"]:
                h = res_block(h)
            h = stage["attention"](h)
            h = stage["upsample"](h)
        # After 3 stages (spatiotemporal, spatiotemporal, spatial):
        # h: (B, channels[0], T'*4, H'*8, W'*8) = (B, channels[0], T, H, W)

        # Output projection
        h = self.norm_out(h)
        # h: (B, channels[0], T, H, W)
        h = self.act_out(h)
        # h: (B, channels[0], T, H, W)
        h = self.out_conv(h)
        # h: (B, 3, T, H, W)

        return h
