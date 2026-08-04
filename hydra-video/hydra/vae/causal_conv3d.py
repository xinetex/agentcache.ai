"""
Causal 3D convolution primitives for Project Hydra.

Three convolution variants with strict temporal causality guarantees:
- CausalConv3d: Standard 3D conv with causal temporal padding
- CausalConvTranspose3d: Transposed 3D conv for upsampling with causal constraint
- GroupCausalConv3d: Standard conv within frame groups, causal between groups

All modules guarantee that output frame t depends only on input frames ≤ t,
preventing future-frame leakage in the autoregressive generation pipeline.
"""

import math
from typing import Optional, Tuple, Union

import torch
import torch.nn as nn
import torch.nn.functional as F


class CausalConv3d(nn.Module):
    """3D convolution with causal (left-only) temporal padding.

    Pads the temporal dimension asymmetrically so that the convolution at time t
    can only attend to frames 0..t. Spatial dimensions use symmetric padding.

    Args:
        in_channels: Number of input channels.
        out_channels: Number of output channels.
        kernel_size: Kernel size as int or (T, H, W) tuple.
        stride: Stride as int or (T, H, W) tuple.
        dilation: Dilation as int or (T, H, W) tuple.
        groups: Number of blocked connections (for depthwise conv etc.).
        bias: Whether to add a learnable bias.
    """

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: Union[int, Tuple[int, int, int]] = 3,
        stride: Union[int, Tuple[int, int, int]] = 1,
        dilation: Union[int, Tuple[int, int, int]] = 1,
        groups: int = 1,
        bias: bool = True,
    ) -> None:
        super().__init__()

        # Normalize to 3-tuples: (T, H, W)
        if isinstance(kernel_size, int):
            kernel_size = (kernel_size, kernel_size, kernel_size)
        if isinstance(stride, int):
            stride = (stride, stride, stride)
        if isinstance(dilation, int):
            dilation = (dilation, dilation, dilation)

        self.kernel_size = kernel_size
        self.stride = stride
        self.dilation = dilation

        # Causal temporal padding: pad only at the start of time dimension
        # Effective temporal kernel span = dilation_t * (kernel_t - 1) + 1
        # We need (effective_span - 1) frames of history → all placed at start
        self.temporal_pad = dilation[0] * (kernel_size[0] - 1)

        # Symmetric spatial padding to preserve spatial dims (when stride=1)
        self.spatial_pad_h = dilation[1] * (kernel_size[1] - 1) // 2
        self.spatial_pad_w = dilation[2] * (kernel_size[2] - 1) // 2

        # Core conv with NO built-in padding — we handle it manually
        self.conv = nn.Conv3d(
            in_channels,
            out_channels,
            kernel_size=kernel_size,
            stride=stride,
            padding=0,  # We apply padding ourselves
            dilation=dilation,
            groups=groups,
            bias=bias,
        )

        self._init_weights()

    def _init_weights(self) -> None:
        """Initialize conv weights with Kaiming normal for ReLU-family activations."""
        nn.init.kaiming_normal_(self.conv.weight, mode="fan_out", nonlinearity="relu")
        if self.conv.bias is not None:
            nn.init.zeros_(self.conv.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Apply causal 3D convolution.

        Args:
            x: Input tensor of shape (B, C, T, H, W).

        Returns:
            Output tensor of shape (B, C_out, T_out, H_out, W_out) where
            T_out = ceil((T + temporal_pad - dilation_t*(kernel_t-1)) / stride_t).
            With stride=1 and appropriate padding, T_out = T.
        """
        # x: (B, C, T, H, W)

        # F.pad order: (W_left, W_right, H_left, H_right, T_left, T_right)
        # Causal: all temporal padding goes to T_left, none to T_right
        x = F.pad(
            x,
            (
                self.spatial_pad_w, self.spatial_pad_w,  # W: symmetric
                self.spatial_pad_h, self.spatial_pad_h,  # H: symmetric
                self.temporal_pad, 0,                     # T: causal (left-only)
            ),
        )
        # x: (B, C, T + temporal_pad, H + 2*spatial_pad_h, W + 2*spatial_pad_w)

        return self.conv(x)
        # output: (B, C_out, T_out, H_out, W_out)


class CausalConvTranspose3d(nn.Module):
    """Transposed 3D convolution with causal temporal constraint.

    Used for upsampling in the decoder. After the transpose convolution,
    extra temporal elements introduced by the transposition are trimmed
    from the end (future side) to maintain causality.

    Args:
        in_channels: Number of input channels.
        out_channels: Number of output channels.
        kernel_size: Kernel size as int or (T, H, W) tuple.
        stride: Stride as int or (T, H, W) tuple. Controls upsampling factor.
        output_padding: Additional size added to one side of the output.
        groups: Number of blocked connections.
        bias: Whether to add a learnable bias.
    """

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: Union[int, Tuple[int, int, int]] = 3,
        stride: Union[int, Tuple[int, int, int]] = (2, 2, 2),
        output_padding: Union[int, Tuple[int, int, int]] = (1, 1, 1),
        groups: int = 1,
        bias: bool = True,
    ) -> None:
        super().__init__()

        if isinstance(kernel_size, int):
            kernel_size = (kernel_size, kernel_size, kernel_size)
        if isinstance(stride, int):
            stride = (stride, stride, stride)
        if isinstance(output_padding, int):
            output_padding = (output_padding, output_padding, output_padding)

        self.kernel_size = kernel_size
        self.stride = stride

        # Spatial padding for ConvTranspose3d: ensures correct spatial output size
        # padding = (kernel - 1) // 2 keeps spatial dims = input_spatial * stride
        spatial_pad_h = (kernel_size[1] - 1) // 2
        spatial_pad_w = (kernel_size[2] - 1) // 2

        self.conv_t = nn.ConvTranspose3d(
            in_channels,
            out_channels,
            kernel_size=kernel_size,
            stride=stride,
            padding=(0, spatial_pad_h, spatial_pad_w),
            output_padding=(0, output_padding[1], output_padding[2]),
            groups=groups,
            bias=bias,
        )

        # After transpose conv with temporal stride s and kernel k (no temporal padding):
        # T_out = (T_in - 1) * s + k
        # We want T_out = T_in * s (exact upsampling)
        # So we need to trim: (T_in - 1) * s + k - T_in * s = k - s extra frames
        # These extra frames are at the end (future) — trim them to maintain causality
        self.temporal_trim = kernel_size[0] - stride[0]

        self._init_weights()

    def _init_weights(self) -> None:
        """Initialize with Kaiming normal."""
        nn.init.kaiming_normal_(self.conv_t.weight, mode="fan_in", nonlinearity="relu")
        if self.conv_t.bias is not None:
            nn.init.zeros_(self.conv_t.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Apply causal transposed 3D convolution.

        Args:
            x: Input tensor of shape (B, C, T, H, W).

        Returns:
            Upsampled tensor of shape (B, C_out, T*stride_t, H*stride_h, W*stride_w).
        """
        # x: (B, C, T, H, W)
        out = self.conv_t(x)
        # out: (B, C_out, (T-1)*stride_t + kernel_t, H_up, W_up)

        # Trim extra temporal frames from the end to maintain causality
        if self.temporal_trim > 0:
            out = out[:, :, :-self.temporal_trim, :, :]
            # out: (B, C_out, T * stride_t, H_up, W_up)

        return out


class GroupCausalConv3d(nn.Module):
    """Group causal 3D convolution — Hydra's innovation for improved reconstruction.

    Standard 3D convolution operates freely within local frame groups of size G,
    allowing bidirectional temporal attention within each group. Between groups,
    strict causal padding is applied so that group g can attend to groups 0..g
    but not g+1, g+2, etc.

    This yields better reconstruction quality than pure causal conv because:
    - Within a group, frames can share bidirectional context (better consistency)
    - Between groups, causality is maintained (no future leakage beyond group boundary)

    For a video of T frames with group_size=G:
    - Frames are divided into ceil(T/G) groups
    - Within each group: standard (non-causal) 3D convolution
    - Between groups: causal padding prevents future information flow

    Args:
        in_channels: Number of input channels.
        out_channels: Number of output channels.
        kernel_size: Kernel size as int or (T, H, W) tuple.
        stride: Stride as int or (T, H, W) tuple. Temporal stride must be 1.
        dilation: Dilation as int or (T, H, W) tuple.
        group_size: Number of frames per causal group.
        groups: Number of blocked connections (conv groups, not causal groups).
        bias: Whether to add a learnable bias.
    """

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: Union[int, Tuple[int, int, int]] = 3,
        stride: Union[int, Tuple[int, int, int]] = 1,
        dilation: Union[int, Tuple[int, int, int]] = 1,
        group_size: int = 4,
        groups: int = 1,
        bias: bool = True,
    ) -> None:
        super().__init__()

        if isinstance(kernel_size, int):
            kernel_size = (kernel_size, kernel_size, kernel_size)
        if isinstance(stride, int):
            stride = (stride, stride, stride)
        if isinstance(dilation, int):
            dilation = (dilation, dilation, dilation)

        assert stride[0] == 1, (
            f"GroupCausalConv3d requires temporal stride=1, got {stride[0]}. "
            "Use standard CausalConv3d for temporal striding."
        )

        self.kernel_size = kernel_size
        self.stride = stride
        self.dilation = dilation
        self.group_size = group_size

        # Total temporal receptive field of the kernel
        self.temporal_receptive_field = dilation[0] * (kernel_size[0] - 1) + 1

        # Symmetric spatial padding
        self.spatial_pad_h = dilation[1] * (kernel_size[1] - 1) // 2
        self.spatial_pad_w = dilation[2] * (kernel_size[2] - 1) // 2

        # Number of frames the kernel extends into the past beyond current position
        self.temporal_kernel_past = dilation[0] * (kernel_size[0] - 1)

        # The conv itself has no built-in padding
        self.conv = nn.Conv3d(
            in_channels,
            out_channels,
            kernel_size=kernel_size,
            stride=stride,
            padding=0,
            dilation=dilation,
            groups=groups,
            bias=bias,
        )

        self._init_weights()

    def _init_weights(self) -> None:
        """Initialize conv weights with Kaiming normal."""
        nn.init.kaiming_normal_(self.conv.weight, mode="fan_out", nonlinearity="relu")
        if self.conv.bias is not None:
            nn.init.zeros_(self.conv.bias)

    def _compute_group_padding(
        self, t: int, group_idx: int, num_groups: int
    ) -> Tuple[int, int]:
        """Compute temporal padding for a specific group.

        Within a group: symmetric padding to allow bidirectional context.
        At group boundaries: only pad from the past (causal between groups).

        Args:
            t: Total number of frames.
            group_idx: Index of the current group.
            num_groups: Total number of groups.

        Returns:
            (left_pad, right_pad) for the temporal dimension of this group.
        """
        half_pad = self.temporal_kernel_past // 2
        remainder = self.temporal_kernel_past % 2

        if group_idx == 0:
            # First group: no past context available, pad with zeros on left
            # Use full causal padding (all left)
            left_pad = self.temporal_kernel_past
            right_pad = 0
        elif group_idx == num_groups - 1:
            # Last group: can borrow from the past, no future padding needed
            # Symmetric within group, causal at boundary
            left_pad = half_pad + remainder
            right_pad = half_pad
        else:
            # Interior group: symmetric padding within, but capped at group boundaries
            left_pad = half_pad + remainder
            right_pad = half_pad

        return left_pad, right_pad

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Apply group causal 3D convolution.

        Processes the video in groups of `group_size` frames. Within each group,
        the convolution has bidirectional context. Between groups, information
        flows only from past to future.

        Args:
            x: Input tensor of shape (B, C, T, H, W).

        Returns:
            Output tensor of shape (B, C_out, T, H_out, W_out).
            Temporal dimension is preserved (stride_t = 1).
        """
        B, C, T, H, W = x.shape

        # Number of groups (last group may be smaller)
        num_groups = math.ceil(T / self.group_size)

        output_chunks = []

        for g in range(num_groups):
            # Slice out this group's frames plus context from previous group
            t_start = g * self.group_size
            t_end = min((g + 1) * self.group_size, T)
            group_len = t_end - t_start

            # How many past frames to include as context (from previous group)
            # These are actual data frames, not zero-padding
            context_start = max(0, t_start - self.temporal_kernel_past)
            x_group_with_context = x[:, :, context_start:t_end, :, :]
            # x_group_with_context: (B, C, context_frames + group_len, H, W)

            context_frames = t_start - context_start

            # Compute how much zero-padding we still need
            # If we got enough context from previous frames, no zero-padding needed
            needed_past_pad = max(0, self.temporal_kernel_past - context_frames)

            # For the future direction: within the group, we allow bidirectional
            # context, but we don't want to leak past the group boundary.
            # The kernel's future reach is 0 for causal, but within-group we want
            # symmetric: so we add right_pad only within the group's data
            # Since we include all frames up to t_end, right_pad is zero-padding
            left_pad, right_pad = self._compute_group_padding(
                T, g, num_groups
            )

            # Override left_pad: only need zero-padding for what context didn't cover
            actual_left_pad = needed_past_pad

            # For interior/last groups, right_pad allows within-group bidirectional flow
            # But clamp it: don't pad beyond what the group needs
            if g == 0:
                actual_right_pad = 0  # First group: pure causal
            else:
                actual_right_pad = right_pad

            # Apply padding: spatial symmetric + temporal as computed
            x_padded = F.pad(
                x_group_with_context,
                (
                    self.spatial_pad_w, self.spatial_pad_w,  # W: symmetric
                    self.spatial_pad_h, self.spatial_pad_h,  # H: symmetric
                    actual_left_pad, actual_right_pad,       # T: group-causal
                ),
            )
            # x_padded: (B, C, padded_T, padded_H, padded_W)

            out_group = self.conv(x_padded)
            # out_group: (B, C_out, T_group_out, H_out, W_out)

            # Extract only the frames corresponding to this group's output
            # The context frames produce outputs that we discard
            # With stride_t=1, each input frame produces one output frame
            # Context frames at the start produce `context_frames` extra outputs
            # (but after padding adjustments, the conv output should align)

            # Total temporal input to conv = actual_left_pad + context_frames + group_len + actual_right_pad
            # Total temporal output = total_input - temporal_kernel_past (since no padding in conv)
            total_out_t = out_group.shape[2]

            # We want the last `group_len` output frames
            if total_out_t >= group_len:
                out_group = out_group[:, :, total_out_t - group_len :, :, :]
            # out_group: (B, C_out, group_len, H_out, W_out)

            output_chunks.append(out_group)

        # Concatenate all groups along temporal dimension
        output = torch.cat(output_chunks, dim=2)
        # output: (B, C_out, T, H_out, W_out)

        return output
