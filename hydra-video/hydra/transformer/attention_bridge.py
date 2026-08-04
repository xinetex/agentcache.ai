"""
Attention Bridge — Bidirectional cross-attention between visual and audio branches.

The key architectural innovation of Hydra: a gradient-gated bridge that enables
synchronized audio-visual generation without mode collapse.

Provides:
- AttentionBridge: Bidirectional cross-attention with gradient-gated information flow
- RhythmicAttentionHead: Beat-aligned temporal attention bias for motion-music sync
"""

from typing import Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from hydra.transformer.attention import CrossAttention


class RhythmicAttentionHead(nn.Module):
    """
    Specialized attention head that creates temporal attention bias
    aligning motion peaks in visual tokens with beat positions in audio.

    This is Hydra's mechanism for beat-synchronous motion generation:
    - Beat positions from audio analysis create a temporal saliency signal
    - A learned projection maps beat salience to attention bias
    - This bias is added to cross-attention logits, encouraging the visual
      branch to produce motion peaks at beat locations

    Args:
        visual_dim: Visual branch hidden dimension.
        audio_dim: Audio branch hidden dimension.
        num_heads: Number of rhythmic attention heads.
        max_beats: Maximum number of beat positions supported.
    """

    def __init__(
        self,
        visual_dim: int,
        audio_dim: int,
        num_heads: int = 2,
        max_beats: int = 512,
    ) -> None:
        super().__init__()
        self.num_heads = num_heads
        self.visual_dim = visual_dim
        self.audio_dim = audio_dim

        # Beat position → temporal attention bias
        # Projects beat feature to a per-head bias vector over visual temporal positions
        self.beat_to_bias = nn.Sequential(
            nn.Linear(1, visual_dim // 2),
            nn.SiLU(),
            nn.Linear(visual_dim // 2, num_heads),
        )

        # Motion-beat alignment projection: learns which visual temporal patterns
        # should align with beat patterns
        self.motion_proj = nn.Linear(visual_dim, num_heads)

        # Learnable scaling factor for the rhythmic bias (starts small)
        self.bias_scale = nn.Parameter(torch.tensor(0.1))

        self._init_weights()

    def _init_weights(self) -> None:
        """Small init so rhythmic bias starts subtle and grows during training."""
        for module in self.beat_to_bias:
            if isinstance(module, nn.Linear):
                nn.init.normal_(module.weight, std=0.02)
                nn.init.zeros_(module.bias)
        nn.init.normal_(self.motion_proj.weight, std=0.02)
        nn.init.zeros_(self.motion_proj.bias)

    def forward(
        self,
        visual_tokens: torch.Tensor,
        audio_tokens: torch.Tensor,
        beat_positions: torch.Tensor,
        visual_grid_t: int,
    ) -> torch.Tensor:
        """
        Compute rhythmic attention bias for visual→audio cross-attention.

        Args:
            visual_tokens: Visual branch tokens.  Shape: (B, N_vis, D_vis)
            audio_tokens: Audio branch tokens.     Shape: (B, N_aud, D_aud)
            beat_positions: Normalized beat positions in [0, 1].  Shape: (B, num_beats)
            visual_grid_t: Number of visual temporal positions.

        Returns:
            Attention bias to add to cross-attention logits.
            Shape: (B, num_heads, N_vis, N_aud)
        """
        B = visual_tokens.shape[0]
        N_vis = visual_tokens.shape[1]
        N_aud = audio_tokens.shape[1]

        # Step 1: Create beat saliency map over visual temporal positions
        # For each visual temporal position, compute how close it is to each beat
        visual_temporal_positions = torch.linspace(
            0, 1, visual_grid_t, device=visual_tokens.device, dtype=visual_tokens.dtype
        )  # Shape: (T_vis,)

        # beat_positions: (B, num_beats) → (B, num_beats, 1)
        # visual_temporal_positions: (T_vis,) → (1, 1, T_vis)
        # Gaussian proximity: exp(-((t_vis - t_beat)^2) / sigma^2)
        sigma = 1.0 / max(visual_grid_t, 1)
        distances = (
            visual_temporal_positions.unsqueeze(0).unsqueeze(0)
            - beat_positions.unsqueeze(-1)
        ).pow(2)  # Shape: (B, num_beats, T_vis)

        beat_saliency = torch.exp(-distances / (2 * sigma ** 2))  # (B, num_beats, T_vis)
        # Aggregate across beats (max saliency at each temporal position)
        beat_saliency = beat_saliency.max(dim=1).values  # (B, T_vis)

        # Step 2: Project beat saliency to per-head bias
        # (B, T_vis, 1) → (B, T_vis, num_heads)
        temporal_bias = self.beat_to_bias(beat_saliency.unsqueeze(-1))

        # Step 3: Expand temporal bias to full spatial-temporal token grid
        # Each spatial position within a frame shares the same temporal bias
        spatial_tokens_per_frame = N_vis // visual_grid_t
        # (B, T_vis, num_heads) → (B, T_vis, 1, num_heads) → (B, T_vis * S, num_heads)
        temporal_bias = temporal_bias.unsqueeze(2).expand(
            B, visual_grid_t, spatial_tokens_per_frame, self.num_heads
        ).reshape(B, N_vis, self.num_heads)  # (B, N_vis, num_heads)

        # Step 4: Create 2D bias map (N_vis × N_aud)
        # Outer product of visual temporal bias with uniform audio coverage
        # (B, N_vis, num_heads) → (B, num_heads, N_vis, 1)
        temporal_bias = temporal_bias.permute(0, 2, 1).unsqueeze(-1)

        # Uniform spread over audio tokens
        audio_uniform = torch.ones(
            B, self.num_heads, 1, N_aud,
            device=visual_tokens.device, dtype=visual_tokens.dtype,
        )

        # Final bias: (B, num_heads, N_vis, N_aud)
        bias = self.bias_scale * temporal_bias * audio_uniform

        return bias


class TemporalResampler(nn.Module):
    """
    Resamples audio tokens to match visual temporal resolution.

    Audio and visual branches may operate at different temporal resolutions.
    This module uses learned linear interpolation to resample audio tokens
    to the visual temporal grid.

    Args:
        audio_dim: Audio branch hidden dimension.
        visual_dim: Visual branch hidden dimension.
    """

    def __init__(self, audio_dim: int, visual_dim: int) -> None:
        super().__init__()
        # Project audio tokens to visual dimension if they differ
        self.proj = nn.Linear(audio_dim, visual_dim) if audio_dim != visual_dim else nn.Identity()
        if isinstance(self.proj, nn.Linear):
            nn.init.kaiming_normal_(self.proj.weight, nonlinearity="linear")
            nn.init.zeros_(self.proj.bias)

    def forward(
        self,
        audio_tokens: torch.Tensor,
        target_temporal_len: int,
        audio_temporal_len: int,
    ) -> torch.Tensor:
        """
        Resample audio tokens to match visual temporal resolution.

        Args:
            audio_tokens: Audio branch tokens.  Shape: (B, N_aud, D_aud)
                          where N_aud = T_aud * F_aud (time × frequency bins)
            target_temporal_len: Target temporal length (visual grid_t).
            audio_temporal_len: Current audio temporal length (T_aud).

        Returns:
            Resampled audio tokens.  Shape: (B, target_temporal_len * F_aud, D_vis)
        """
        B, N_aud, D_aud = audio_tokens.shape
        freq_bins = N_aud // audio_temporal_len

        # Project to visual dim
        audio_tokens = self.proj(audio_tokens)  # (B, N_aud, D_vis)
        D_vis = audio_tokens.shape[-1]

        # Reshape to separate temporal and frequency: (B, T_aud, F_aud, D)
        audio_tokens = audio_tokens.reshape(B, audio_temporal_len, freq_bins, D_vis)

        if audio_temporal_len != target_temporal_len:
            # Interpolate along temporal axis
            # (B, T_aud, F_aud, D) → (B, D, T_aud, F_aud) for F.interpolate
            audio_tokens = audio_tokens.permute(0, 3, 1, 2)
            audio_tokens = F.interpolate(
                audio_tokens,
                size=(target_temporal_len, freq_bins),
                mode="bilinear",
                align_corners=False,
            )  # (B, D, T_target, F_aud)
            # → (B, T_target, F_aud, D)
            audio_tokens = audio_tokens.permute(0, 2, 3, 1)

        # Flatten back: (B, T_target, F_aud, D) → (B, T_target * F_aud, D)
        audio_tokens = audio_tokens.reshape(B, -1, D_vis)

        return audio_tokens


class AttentionBridge(nn.Module):
    """
    Bidirectional attention bridge between visual and audio branches.

    Architecture:
    1. Temporal resampling: align audio temporal resolution to visual
    2. Visual → Audio: audio tokens attend to visual tokens
    3. Audio → Visual: visual tokens attend to audio tokens
    4. Gradient gating: learnable sigmoid gates control information flow

    Gradient-Gated Bridge (our innovation):
    - Learnable scalar gates initialized at gate_init (default 0.0)
    - sigmoid(0.0) = 0.5 → starts with moderate bidirectional flow
    - Prevents mode collapse where one branch dominates early in training
    - Gates learn to increase/decrease flow based on task requirements

    Args:
        visual_dim: Visual branch hidden dimension.
        audio_dim: Audio branch hidden dimension.
        num_heads: Number of attention heads for cross-attention.
        gate_init: Initial value for gradient gates (0.0 → sigmoid gives 0.5).
        use_rhythmic_attention: Whether to use beat-synchronized attention bias.
        rhythmic_heads: Number of rhythmic attention heads.
        dropout: Attention dropout probability.
    """

    def __init__(
        self,
        visual_dim: int,
        audio_dim: int,
        num_heads: int = 8,
        gate_init: float = 0.0,
        use_rhythmic_attention: bool = True,
        rhythmic_heads: int = 2,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        self.visual_dim = visual_dim
        self.audio_dim = audio_dim
        self.use_rhythmic_attention = use_rhythmic_attention

        # Temporal resampler: align audio to visual temporal resolution
        self.temporal_resampler = TemporalResampler(audio_dim, visual_dim)

        # Reverse projection: visual dim back to audio dim
        self.reverse_proj = nn.Linear(visual_dim, audio_dim) if visual_dim != audio_dim else nn.Identity()
        if isinstance(self.reverse_proj, nn.Linear):
            nn.init.kaiming_normal_(self.reverse_proj.weight, nonlinearity="linear")
            nn.init.zeros_(self.reverse_proj.bias)

        # Bidirectional cross-attention
        # Visual tokens attend to (resampled) audio tokens
        self.audio_to_visual_attn = CrossAttention(
            dim=visual_dim,
            cond_dim=visual_dim,  # After resampling, audio is projected to visual_dim
            num_heads=num_heads,
            qk_norm=True,
            dropout=dropout,
        )
        # Audio tokens attend to visual tokens (projected to audio dim)
        self.visual_to_audio_attn = CrossAttention(
            dim=audio_dim,
            cond_dim=audio_dim,  # Visual projected to audio_dim for KV
            num_heads=min(num_heads, audio_dim // 64) if audio_dim < num_heads * 64 else num_heads,
            qk_norm=True,
            dropout=dropout,
        )

        # Layer norms for pre-norm cross-attention
        self.vis_norm = nn.LayerNorm(visual_dim, eps=1e-6)
        self.aud_norm = nn.LayerNorm(audio_dim, eps=1e-6)

        # ── Gradient-Gated Bridge ──────────────────────────────────────────
        # Learnable gates control information flow between branches.
        # sigmoid(gate_init=0.0) = 0.5 → moderate initial flow
        self.visual_gate = nn.Parameter(torch.tensor(gate_init))
        self.audio_gate = nn.Parameter(torch.tensor(gate_init))

        # ── Rhythmic Attention ─────────────────────────────────────────────
        if use_rhythmic_attention:
            self.rhythmic_head = RhythmicAttentionHead(
                visual_dim=visual_dim,
                audio_dim=audio_dim,
                num_heads=rhythmic_heads,
            )
        else:
            self.rhythmic_head = None

    def forward(
        self,
        visual_tokens: torch.Tensor,
        audio_tokens: torch.Tensor,
        visual_grid_t: int,
        audio_temporal_len: int,
        beat_positions: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Bidirectional attention bridge with gradient gating.

        Args:
            visual_tokens: Visual branch tokens.   Shape: (B, N_vis, D_vis)
            audio_tokens: Audio branch tokens.      Shape: (B, N_aud, D_aud)
            visual_grid_t: Visual temporal grid size (number of visual frames after patching).
            audio_temporal_len: Audio temporal length (T_aud in audio token grid).
            beat_positions: Optional beat positions for rhythmic attention.
                           Shape: (B, num_beats) with values in [0, 1].

        Returns:
            visual_updated: Updated visual tokens.  Shape: (B, N_vis, D_vis)
            audio_updated: Updated audio tokens.     Shape: (B, N_aud, D_aud)
        """
        B = visual_tokens.shape[0]

        # ── Step 1: Temporal Resampling ────────────────────────────────────
        # Resample audio tokens to match visual temporal resolution and project to visual_dim
        audio_resampled = self.temporal_resampler(
            audio_tokens, visual_grid_t, audio_temporal_len,
        )  # Shape: (B, N_vis_temporal * F_aud, D_vis)

        # Project visual tokens to audio dimension for the reverse direction
        visual_for_audio = self.reverse_proj(visual_tokens)  # (B, N_vis, D_aud)

        # ── Step 2: Audio → Visual cross-attention ─────────────────────────
        # Visual tokens attend to resampled audio (Q=visual, KV=audio_resampled)
        vis_normed = self.vis_norm(visual_tokens)  # (B, N_vis, D_vis)
        a2v_output = self.audio_to_visual_attn(
            vis_normed, audio_resampled
        )  # (B, N_vis, D_vis)

        # ── Step 3: Visual → Audio cross-attention ─────────────────────────
        # Audio tokens attend to visual tokens (Q=audio, KV=visual)
        aud_normed = self.aud_norm(audio_tokens)  # (B, N_aud, D_aud)
        v2a_output = self.visual_to_audio_attn(
            aud_normed, visual_for_audio
        )  # (B, N_aud, D_aud)

        # ── Step 4: Gradient-Gated Residual ────────────────────────────────
        # sigmoid(gate) controls flow; gate=0.0 → sigmoid=0.5 → moderate flow
        visual_gate_value = torch.sigmoid(self.visual_gate)  # scalar
        audio_gate_value = torch.sigmoid(self.audio_gate)    # scalar

        visual_update = visual_gate_value * a2v_output  # (B, N_vis, D_vis)
        audio_update = audio_gate_value * v2a_output     # (B, N_aud, D_aud)

        # ── Step 5: Rhythmic Attention Bias (optional) ─────────────────────
        # If beat positions are provided and rhythmic attention is enabled,
        # add a beat-synchronized bias. This is applied as a residual additive
        # signal to the visual update, encouraging motion at beat positions.
        if self.rhythmic_head is not None and beat_positions is not None:
            rhythmic_bias = self.rhythmic_head(
                visual_tokens, audio_tokens, beat_positions, visual_grid_t
            )  # (B, num_heads, N_vis, N_aud)

            # Compute rhythmic-biased attention over audio_resampled
            # For efficiency, we use a simple projected summary rather than
            # full re-attention. The bias modulates the existing update.
            # Take mean over rhythmic heads → (B, N_vis, N_aud)
            rhythmic_weight = rhythmic_bias.mean(dim=1)
            # Softmax over audio tokens to get attention weights
            rhythmic_weight = F.softmax(rhythmic_weight, dim=-1)  # (B, N_vis, N_aud)
            # Weighted sum of resampled audio → (B, N_vis, D_vis)
            N_aud_resampled = audio_resampled.shape[1]
            if rhythmic_weight.shape[-1] != N_aud_resampled:
                # Adjust rhythmic weight size to match resampled audio
                rhythmic_weight = F.interpolate(
                    rhythmic_weight.unsqueeze(1),
                    size=(rhythmic_weight.shape[1], N_aud_resampled),
                    mode="bilinear",
                    align_corners=False,
                ).squeeze(1)
            rhythmic_context = torch.bmm(rhythmic_weight, audio_resampled)  # (B, N_vis, D_vis)
            visual_update = visual_update + 0.1 * rhythmic_context  # Small additive rhythmic signal

        # Apply gated updates as residuals
        visual_updated = visual_tokens + visual_update  # (B, N_vis, D_vis)
        audio_updated = audio_tokens + audio_update      # (B, N_aud, D_aud)

        return visual_updated, audio_updated
