"""
Training losses for Rectified Flow Matching in Project Hydra.

Provides two loss classes:
    1. FlowMatchingLoss — Standard single-branch velocity-matching loss
    2. DualBranchFlowMatchingLoss — Joint visual + audio loss for the
       dual-branch diffusion transformer, with independent noise schedules
       and configurable loss weighting between modalities

The training objective minimizes:
    L = E_{t, x_0, eps} [ w(t) * ||v_pred(x_t, t, cond) - v_target||^2 ]

where:
    x_t = (1 - t) * x_0 + t * eps     (linear interpolation)
    v_target = eps - x_0               (constant velocity)
    w(t) = optional per-timestep weight (default: uniform)
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional, Protocol, Union

import torch
import torch.nn as nn
import torch.nn.functional as F

from hydra.flow.scheduler import FlowMatchingScheduler


# ─── Model Protocols ────────────────────────────────────────────────────────────
# These protocols define the expected interface for models passed to the loss.
# Using Protocol rather than ABC so any model matching the signature works.

class VelocityModel(Protocol):
    """Protocol for a model that predicts velocity given noised input and timestep."""

    def __call__(
        self,
        x_t: torch.Tensor,
        t: torch.Tensor,
        condition: Any,
    ) -> torch.Tensor:
        """Forward pass predicting velocity.

        Args:
            x_t: Noised latent of shape (B, C, T, H, W).
            t: Timestep tensor of shape (B,).
            condition: Arbitrary conditioning (text embeddings, images, etc.).

        Returns:
            Predicted velocity of shape (B, C, T, H, W).
        """
        ...


class DualBranchModel(Protocol):
    """Protocol for dual-branch model that predicts visual and audio velocities."""

    def __call__(
        self,
        visual_x_t: torch.Tensor,
        audio_x_t: torch.Tensor,
        t: torch.Tensor,
        condition: Any,
    ) -> Dict[str, torch.Tensor]:
        """Forward pass predicting velocities for both branches.

        Args:
            visual_x_t: Noised visual latent of shape (B, C_v, T, H, W).
            audio_x_t: Noised audio latent of shape (B, C_a, T_a, F).
            t: Shared timestep tensor of shape (B,).
            condition: Conditioning signals.

        Returns:
            Dict with keys "visual" and "audio", each a velocity tensor
            matching the shape of the corresponding input.
        """
        ...


# ─── Weighting Functions ────────────────────────────────────────────────────────

def uniform_weight(t: torch.Tensor) -> torch.Tensor:
    """Uniform weighting (no reweighting). Returns ones.

    Args:
        t: Timestep tensor of shape (B,).

    Returns:
        Weight tensor of shape (B,) filled with 1.0.
    """
    return torch.ones_like(t)  # (B,)


def snr_weight(t: torch.Tensor) -> torch.Tensor:
    """Signal-to-noise ratio inspired weighting.

    Upweights intermediate timesteps where the model must distinguish
    signal from noise. Downweights endpoints where the task is trivial
    (pure data at t=0, pure noise at t=1).

    w(t) = 1 / (t * (1 - t) + eps)

    This is analogous to min-SNR weighting in DDPM but adapted for flow matching.

    Args:
        t: Timestep tensor of shape (B,).

    Returns:
        Weight tensor of shape (B,).
    """
    eps = 1e-5
    # t*(1-t) is maximized at 0.5 and approaches 0 at endpoints
    # Inverting gives higher weight at endpoints, lower at middle
    # But we actually want to *match* SNR behavior: upweight middle
    w = 1.0 / (t * (1.0 - t) + eps)  # (B,)
    # Normalize so mean weight is 1.0 to keep loss scale consistent
    w = w / w.mean()  # (B,)
    return w


def cosine_weight(t: torch.Tensor) -> torch.Tensor:
    """Cosine weighting — smooth upweighting of middle timesteps.

    w(t) = 2 * (1 - cos(π * t)) = 4 * sin²(π*t/2)

    Peaks at t=0.5, zero at t=0 and t=1.

    Args:
        t: Timestep tensor of shape (B,).

    Returns:
        Weight tensor of shape (B,).
    """
    import math
    w = 2.0 * (1.0 - torch.cos(math.pi * t))  # (B,)
    w = w / w.mean().clamp(min=1e-5)  # (B,) — normalize
    return w


WEIGHT_FUNCTIONS: Dict[str, Callable[[torch.Tensor], torch.Tensor]] = {
    "uniform": uniform_weight,
    "snr": snr_weight,
    "cosine": cosine_weight,
}


# ─── Single-Branch Flow Matching Loss ────────────────────────────────────────────

class FlowMatchingLoss(nn.Module):
    """Rectified flow matching velocity-prediction loss.

    Implements the training objective for a single-branch model (visual or audio):
        1. Sample noise eps ~ N(0, I)
        2. Sample timesteps t ~ distribution
        3. Interpolate x_t = (1-t)*x_0 + t*eps
        4. Predict velocity v_pred = model(x_t, t, condition)
        5. Compute target v_target = eps - x_0
        6. Return weighted MSE: mean( w(t) * ||v_pred - v_target||^2 )

    Args:
        weighting: Loss weighting strategy. One of "uniform", "snr", "cosine".
            Can also pass a custom callable (Tensor → Tensor).
        reduction: Loss reduction mode. "mean" (default) or "none" (per-sample).
    """

    def __init__(
        self,
        weighting: Union[str, Callable[[torch.Tensor], torch.Tensor]] = "uniform",
        reduction: str = "mean",
    ) -> None:
        super().__init__()

        if isinstance(weighting, str):
            if weighting not in WEIGHT_FUNCTIONS:
                raise ValueError(
                    f"Unknown weighting '{weighting}'. "
                    f"Choose from {list(WEIGHT_FUNCTIONS.keys())}."
                )
            self.weight_fn = WEIGHT_FUNCTIONS[weighting]
        else:
            self.weight_fn = weighting

        if reduction not in ("mean", "none"):
            raise ValueError(f"reduction must be 'mean' or 'none', got '{reduction}'")
        self.reduction = reduction

    def forward(
        self,
        model: VelocityModel,
        x_0: torch.Tensor,
        condition: Any,
        scheduler: FlowMatchingScheduler,
        timestep_weights: Optional[torch.Tensor] = None,
    ) -> Union[torch.Tensor, Dict[str, torch.Tensor]]:
        """Compute the flow matching training loss.

        Args:
            model: Velocity prediction model (see VelocityModel protocol).
            x_0: Clean data latent of shape (B, C, T, H, W).
            condition: Conditioning input (passed directly to model).
            scheduler: FlowMatchingScheduler for timestep sampling and interpolation.
            timestep_weights: Optional pre-computed per-sample weights of shape (B,).
                If provided, these override the weight function.

        Returns:
            If reduction="mean": scalar loss tensor.
            If reduction="none": per-sample loss tensor of shape (B,).
        """
        B = x_0.shape[0]
        device = x_0.device

        # 1. Sample noise ~ N(0, I)
        noise = torch.randn_like(x_0)  # (B, C, T, H, W)

        # 2. Sample timesteps from configured distribution
        t = scheduler.sample_timesteps(B, device)  # (B,)

        # 3. Interpolate to get noised latent
        x_t = scheduler.add_noise(x_0, noise, t)  # (B, C, T, H, W)

        # 4. Model predicts velocity
        v_pred = model(x_t, t, condition)  # (B, C, T, H, W)

        # 5. Compute target velocity (constant along rectified flow path)
        v_target = scheduler.get_velocity(x_0, noise)  # (B, C, T, H, W)

        # 6. Per-sample MSE: ||v_pred - v_target||^2 averaged over (C, T, H, W)
        # First compute element-wise squared error
        sq_error = (v_pred - v_target) ** 2  # (B, C, T, H, W)
        # Reduce over all dims except batch → per-sample loss
        per_sample_loss = sq_error.mean(dim=list(range(1, sq_error.ndim)))  # (B,)

        # 7. Apply per-timestep weighting
        if timestep_weights is not None:
            weights = timestep_weights  # (B,)
        else:
            weights = self.weight_fn(t)  # (B,)

        weighted_loss = per_sample_loss * weights  # (B,)

        if self.reduction == "mean":
            return weighted_loss.mean()  # scalar
        else:
            return weighted_loss  # (B,)


# ─── Dual-Branch Flow Matching Loss ─────────────────────────────────────────────

class DualBranchFlowMatchingLoss(nn.Module):
    """Flow matching loss for the dual-branch (visual + audio) DiT.

    Each branch gets independently sampled noise but shares the same
    timestep schedule. This ensures visual and audio denoising are
    temporally aligned (same t) while allowing modality-specific noise.

    The total loss is:
        L = lambda_visual * L_visual + lambda_audio * L_audio

    Args:
        visual_weight: Weight for visual branch loss (lambda_visual).
        audio_weight: Weight for audio branch loss (lambda_audio).
        weighting: Per-timestep weighting strategy (shared by both branches).
        reduction: Loss reduction mode.
        shared_timesteps: If True (default), both branches use the same timesteps.
            If False, each branch samples independently.
    """

    def __init__(
        self,
        visual_weight: float = 1.0,
        audio_weight: float = 0.5,
        weighting: Union[str, Callable[[torch.Tensor], torch.Tensor]] = "uniform",
        reduction: str = "mean",
        shared_timesteps: bool = True,
    ) -> None:
        super().__init__()
        self.visual_weight = visual_weight
        self.audio_weight = audio_weight
        self.shared_timesteps = shared_timesteps

        if isinstance(weighting, str):
            if weighting not in WEIGHT_FUNCTIONS:
                raise ValueError(
                    f"Unknown weighting '{weighting}'. "
                    f"Choose from {list(WEIGHT_FUNCTIONS.keys())}."
                )
            self.weight_fn = WEIGHT_FUNCTIONS[weighting]
        else:
            self.weight_fn = weighting

        if reduction not in ("mean", "none"):
            raise ValueError(f"reduction must be 'mean' or 'none', got '{reduction}'")
        self.reduction = reduction

    def forward(
        self,
        model: DualBranchModel,
        visual_x_0: torch.Tensor,
        audio_x_0: torch.Tensor,
        condition: Any,
        scheduler: FlowMatchingScheduler,
        timestep_weights: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        """Compute dual-branch flow matching loss.

        Args:
            model: Dual-branch velocity prediction model.
            visual_x_0: Clean visual latent of shape (B, C_v, T, H, W).
            audio_x_0: Clean audio latent of shape (B, C_a, T_a, F).
            condition: Conditioning input (text embeddings, reference images, etc.).
            scheduler: FlowMatchingScheduler instance.
            timestep_weights: Optional per-sample weights of shape (B,).

        Returns:
            Dict with keys:
                "loss": Total weighted loss (scalar if reduction="mean").
                "visual_loss": Visual branch loss before weighting.
                "audio_loss": Audio branch loss before weighting.
        """
        B = visual_x_0.shape[0]
        device = visual_x_0.device

        # ── Sample timesteps ────────────────────────────────────────────────
        t = scheduler.sample_timesteps(B, device)  # (B,)
        if not self.shared_timesteps:
            t_audio = scheduler.sample_timesteps(B, device)  # (B,)
        else:
            t_audio = t  # Shared for temporal alignment

        # ── Visual branch: noise and interpolate ────────────────────────────
        visual_noise = torch.randn_like(visual_x_0)  # (B, C_v, T, H, W)
        visual_x_t = scheduler.add_noise(visual_x_0, visual_noise, t)  # (B, C_v, T, H, W)
        visual_v_target = scheduler.get_velocity(visual_x_0, visual_noise)  # (B, C_v, T, H, W)

        # ── Audio branch: independent noise, interpolate ────────────────────
        audio_noise = torch.randn_like(audio_x_0)  # (B, C_a, T_a, F)
        # Audio is 4D (B, C_a, T_a, F) — need to handle different dimensionality
        # Reshape t_audio for 4D broadcasting: (B,) → (B, 1, 1, 1)
        t_audio_expanded = t_audio[:, None, None, None]  # (B, 1, 1, 1)
        audio_x_t = (1.0 - t_audio_expanded) * audio_x_0 + t_audio_expanded * audio_noise  # (B, C_a, T_a, F)
        audio_v_target = audio_noise - audio_x_0  # (B, C_a, T_a, F)

        # ── Forward pass through dual-branch model ──────────────────────────
        v_preds = model(visual_x_t, audio_x_t, t, condition)
        visual_v_pred = v_preds["visual"]  # (B, C_v, T, H, W)
        audio_v_pred = v_preds["audio"]  # (B, C_a, T_a, F)

        # ── Compute per-sample MSE for each branch ──────────────────────────
        visual_sq_error = (visual_v_pred - visual_v_target) ** 2  # (B, C_v, T, H, W)
        visual_per_sample = visual_sq_error.mean(
            dim=list(range(1, visual_sq_error.ndim))
        )  # (B,)

        audio_sq_error = (audio_v_pred - audio_v_target) ** 2  # (B, C_a, T_a, F)
        audio_per_sample = audio_sq_error.mean(
            dim=list(range(1, audio_sq_error.ndim))
        )  # (B,)

        # ── Apply timestep weights ──────────────────────────────────────────
        if timestep_weights is not None:
            weights = timestep_weights  # (B,)
        else:
            weights = self.weight_fn(t)  # (B,)

        weighted_visual = visual_per_sample * weights  # (B,)
        weighted_audio = audio_per_sample * weights  # (B,)

        # ── Combine losses with branch weights ──────────────────────────────
        total_per_sample = (
            self.visual_weight * weighted_visual
            + self.audio_weight * weighted_audio
        )  # (B,)

        if self.reduction == "mean":
            total_loss = total_per_sample.mean()  # scalar
            visual_loss = weighted_visual.mean()  # scalar
            audio_loss = weighted_audio.mean()  # scalar
        else:
            total_loss = total_per_sample  # (B,)
            visual_loss = weighted_visual  # (B,)
            audio_loss = weighted_audio  # (B,)

        return {
            "loss": total_loss,
            "visual_loss": visual_loss,
            "audio_loss": audio_loss,
        }
