"""
ODE samplers for Rectified Flow Matching inference in Project Hydra.

Implements two samplers for solving the flow ODE from noise (t=1) to data (t=0):

1. EulerSampler — Standard first-order Euler method with optional
   classifier-free guidance (CFG).

2. PyramidalEulerSampler — Multi-resolution Euler sampler that operates at
   reduced resolution for early noisy steps and progressively increases to
   full resolution. This significantly reduces inference cost for video
   generation where early high-frequency details are masked by noise.

Both samplers return the final denoised latent and optionally a list of
intermediate states for visualization/debugging.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Protocol, Tuple, Union

import torch
import torch.nn as nn
import torch.nn.functional as F
from tqdm import tqdm

from hydra.config import FlowConfig
from hydra.flow.scheduler import FlowMatchingScheduler


# ─── Model Protocol ─────────────────────────────────────────────────────────────

class VelocityModel(Protocol):
    """Protocol for a velocity prediction model used during inference."""

    def __call__(
        self,
        x_t: torch.Tensor,
        t: torch.Tensor,
        condition: Any,
    ) -> torch.Tensor:
        """Predict velocity at the given timestep.

        Args:
            x_t: Current noised latent, shape (B, C, T, H, W).
            t: Current timestep, shape (B,).
            condition: Conditioning signals.

        Returns:
            Predicted velocity, shape (B, C, T, H, W).
        """
        ...


# ─── Euler Sampler ───────────────────────────────────────────────────────────────

class EulerSampler(nn.Module):
    """Standard Euler method ODE solver for rectified flow sampling.

    Solves the ODE:
        dx/dt = v(x_t, t, cond)

    from t=1 (noise) to t=0 (clean data) using first-order Euler steps:
        x_{t-dt} = x_t - dt * v(x_t, t, cond)

    Supports classifier-free guidance (CFG) which blends unconditional and
    conditional velocity predictions:
        v = v_uncond + cfg_scale * (v_cond - v_uncond)

    Args:
        config: FlowConfig with inference hyperparameters.
    """

    def __init__(self, config: Optional[FlowConfig] = None) -> None:
        super().__init__()
        self.config = config or FlowConfig()

    @torch.no_grad()
    def sample(
        self,
        model: VelocityModel,
        noise: torch.Tensor,
        condition: Any,
        scheduler: FlowMatchingScheduler,
        num_steps: Optional[int] = None,
        cfg_scale: Optional[float] = None,
        uncondition: Optional[Any] = None,
        return_intermediates: bool = False,
        progress_bar: bool = True,
    ) -> Union[torch.Tensor, Tuple[torch.Tensor, List[torch.Tensor]]]:
        """Generate samples by solving the flow ODE with Euler steps.

        Args:
            model: Velocity prediction model.
            noise: Initial noise tensor of shape (B, C, T, H, W) at t=1.
            condition: Conditioning signals for guided generation.
            scheduler: FlowMatchingScheduler providing the timestep schedule.
            num_steps: Number of Euler steps. Defaults to config value.
            cfg_scale: Classifier-free guidance scale. If > 1.0 and uncondition
                is provided, CFG is applied. Defaults to config value.
            uncondition: Unconditional conditioning input for CFG. Required if
                cfg_scale > 1.0. Typically null/empty text embeddings.
            return_intermediates: If True, returns a list of all intermediate
                x_t states along with the final output.
            progress_bar: If True, show tqdm progress bar.

        Returns:
            If return_intermediates is False:
                Final denoised tensor x_0 of shape (B, C, T, H, W).
            If return_intermediates is True:
                Tuple of (x_0, intermediates) where intermediates is a list
                of tensors at each step.
        """
        num_steps = num_steps or self.config.num_inference_steps
        cfg_scale = cfg_scale if cfg_scale is not None else self.config.cfg_scale
        use_cfg = cfg_scale > 1.0 and uncondition is not None

        # Get timestep schedule: [1.0, ..., 0.0] with num_steps+1 entries
        schedule = scheduler.get_timestep_schedule(num_steps, device=noise.device)  # (S+1,)

        # Start from pure noise at t=1
        x_t = noise.clone()  # (B, C, T, H, W)
        B = x_t.shape[0]
        intermediates: List[torch.Tensor] = []

        if return_intermediates:
            intermediates.append(x_t.clone().cpu())

        steps_iter = range(num_steps)
        if progress_bar:
            steps_iter = tqdm(steps_iter, desc="Euler sampling", leave=False)

        for i in steps_iter:
            t_current = schedule[i]  # scalar: current timestep
            t_next = schedule[i + 1]  # scalar: next timestep
            dt = t_current - t_next  # scalar: step size (positive, since t decreases)

            # Create batch timestep tensor
            t_batch = torch.full((B,), t_current.item(), device=x_t.device, dtype=x_t.dtype)  # (B,)

            if use_cfg:
                # ── Classifier-Free Guidance ────────────────────────────────
                # Requires two forward passes: one conditional, one unconditional
                v_cond = model(x_t, t_batch, condition)  # (B, C, T, H, W)
                v_uncond = model(x_t, t_batch, uncondition)  # (B, C, T, H, W)

                # Blend: v = v_uncond + scale * (v_cond - v_uncond)
                v = v_uncond + cfg_scale * (v_cond - v_uncond)  # (B, C, T, H, W)
            else:
                # Single forward pass
                v = model(x_t, t_batch, condition)  # (B, C, T, H, W)

            # Euler step: move along the velocity field
            # ODE: dx/dt = v, so x_{t-dt} = x_t - dt * v
            # (Negative because we're going from t=1 to t=0, i.e., decreasing t)
            x_t = x_t - dt * v  # (B, C, T, H, W)

            if return_intermediates:
                intermediates.append(x_t.clone().cpu())

        if return_intermediates:
            return x_t, intermediates
        return x_t

    def __repr__(self) -> str:
        return (
            f"EulerSampler("
            f"steps={self.config.num_inference_steps}, "
            f"cfg_scale={self.config.cfg_scale})"
        )


# ─── Pyramidal Euler Sampler ─────────────────────────────────────────────────────

class PyramidalEulerSampler(nn.Module):
    """Multi-resolution Euler sampler for efficient video generation.

    Key insight: During early denoising steps (high noise levels), fine spatial
    details are completely masked by noise. We can safely predict velocities at
    lower resolution without quality loss, dramatically reducing compute.

    Resolution schedule (controlled by pyramid_schedule from FlowConfig):
        Phase 1 — t ∈ [1.0, high_threshold]:  Low resolution (2x downsample)
            Early steps where the model mostly predicts global structure.
            Operating at half resolution saves ~4x FLOPs per step.

        Phase 2 — t ∈ [high_threshold, low_threshold]:  Full resolution
            Middle steps where medium-frequency details emerge.

        Phase 3 — t ∈ [low_threshold, 0.0]:  Full resolution + adaptive steps
            Final steps refining fine details with smaller step sizes
            to reduce discretization error near the clean data manifold.

    The pyramid_schedule list [low_threshold, high_threshold, 1.0] from FlowConfig
    defines the transition points. Default is [0.3, 0.6, 1.0].

    Args:
        config: FlowConfig with pyramid schedule and inference parameters.
        downsample_factor: Spatial downsampling factor for the low-res phase.
        adaptive_step_ratio: For the final phase, steps are this fraction of
            the default step size (smaller = finer resolution in time).
    """

    def __init__(
        self,
        config: Optional[FlowConfig] = None,
        downsample_factor: int = 2,
        adaptive_step_ratio: float = 0.5,
    ) -> None:
        super().__init__()
        self.config = config or FlowConfig()
        self.downsample_factor = downsample_factor
        self.adaptive_step_ratio = adaptive_step_ratio

        # Parse pyramid schedule from config: [low_thresh, high_thresh, 1.0]
        schedule = self.config.pyramid_schedule
        if len(schedule) < 2:
            raise ValueError(
                f"pyramid_schedule must have at least 2 entries "
                f"[low_threshold, high_threshold], got {schedule}"
            )
        self.low_threshold: float = schedule[0]   # Below this: adaptive fine steps
        self.high_threshold: float = schedule[1]   # Above this: low-res steps

    def _get_resolution_phase(self, t: float) -> str:
        """Determine which resolution phase a timestep belongs to.

        Args:
            t: Current timestep value in [0, 1].

        Returns:
            Phase name: "low_res", "full_res", or "adaptive".
        """
        if t >= self.high_threshold:
            return "low_res"
        elif t >= self.low_threshold:
            return "full_res"
        else:
            return "adaptive"

    def _downsample_latent(self, x: torch.Tensor) -> torch.Tensor:
        """Spatially downsample a 5D video latent tensor.

        Uses trilinear interpolation to downsample spatial dimensions (H, W)
        by the downsample factor while keeping temporal dimension unchanged.

        Args:
            x: Input tensor of shape (B, C, T, H, W).

        Returns:
            Downsampled tensor of shape (B, C, T, H//factor, W//factor).
        """
        B, C, T, H, W = x.shape
        H_down = H // self.downsample_factor
        W_down = W // self.downsample_factor

        # F.interpolate expects either 3D, 4D, or 5D input
        # For 5D: (B, C, D, H, W) with mode='trilinear'
        # We want to downsample H and W only, keeping T fixed
        x_down = F.interpolate(
            x,
            size=(T, H_down, W_down),
            mode="trilinear",
            align_corners=False,
        )  # (B, C, T, H//f, W//f)
        return x_down

    def _upsample_latent(
        self,
        x: torch.Tensor,
        target_size: Tuple[int, int, int],
    ) -> torch.Tensor:
        """Spatially upsample a 5D video latent back to target size.

        Args:
            x: Downsampled tensor of shape (B, C, T, H_small, W_small).
            target_size: Target (T, H, W) dimensions.

        Returns:
            Upsampled tensor of shape (B, C, T, H, W).
        """
        x_up = F.interpolate(
            x,
            size=target_size,
            mode="trilinear",
            align_corners=False,
        )  # (B, C, T, H, W)
        return x_up

    def _build_adaptive_schedule(
        self,
        base_dt: float,
        t_start: float,
        t_end: float,
    ) -> List[Tuple[float, float]]:
        """Build an adaptive (finer) step schedule for the final phase.

        Uses smaller step sizes near t=0 where the velocity field changes
        more rapidly and discretization error accumulates.

        Args:
            base_dt: The base step size from the uniform schedule.
            t_start: Starting timestep for this phase.
            t_end: Ending timestep (typically 0.0).

        Returns:
            List of (t_current, t_next) pairs for each adaptive step.
        """
        adaptive_dt = base_dt * self.adaptive_step_ratio
        steps: List[Tuple[float, float]] = []
        t = t_start
        while t > t_end + 1e-6:
            t_next = max(t - adaptive_dt, t_end)
            steps.append((t, t_next))
            t = t_next
        return steps

    @torch.no_grad()
    def sample(
        self,
        model: VelocityModel,
        noise: torch.Tensor,
        condition: Any,
        scheduler: FlowMatchingScheduler,
        num_steps: Optional[int] = None,
        cfg_scale: Optional[float] = None,
        uncondition: Optional[Any] = None,
        return_intermediates: bool = False,
        progress_bar: bool = True,
    ) -> Union[torch.Tensor, Tuple[torch.Tensor, List[torch.Tensor]]]:
        """Generate samples using pyramidal multi-resolution Euler integration.

        Resolution strategy:
            t ∈ [1.0, high_threshold):  2x downsampled latent space
            t ∈ [high_threshold, low_threshold): Full resolution
            t ∈ [low_threshold, 0.0]:  Full resolution + adaptive step size

        Args:
            model: Velocity prediction model.
            noise: Initial noise tensor of shape (B, C, T, H, W) at t=1.
            condition: Conditioning signals.
            scheduler: FlowMatchingScheduler for timestep schedule.
            num_steps: Number of base Euler steps.
            cfg_scale: CFG guidance scale.
            uncondition: Null conditioning for CFG.
            return_intermediates: Whether to return intermediate states.
            progress_bar: Whether to show progress bar.

        Returns:
            If return_intermediates is False:
                Final denoised tensor x_0 of shape (B, C, T, H, W).
            If return_intermediates is True:
                Tuple of (x_0, intermediates).
        """
        num_steps = num_steps or self.config.num_inference_steps
        cfg_scale = cfg_scale if cfg_scale is not None else self.config.cfg_scale
        use_cfg = cfg_scale > 1.0 and uncondition is not None

        # Get the base uniform schedule
        base_schedule = scheduler.get_timestep_schedule(num_steps, device=noise.device)  # (S+1,)
        base_dt = (1.0 / num_steps)

        # Full resolution size (for upsampling back)
        B, C, T, H, W = noise.shape
        full_size = (T, H, W)

        # Start from noise
        x_t = noise.clone()  # (B, C, T, H, W)
        intermediates: List[torch.Tensor] = []

        if return_intermediates:
            intermediates.append(x_t.clone().cpu())

        # ── Build the complete step list with phase annotations ─────────────
        all_steps: List[Tuple[float, float, str]] = []  # (t_curr, t_next, phase)

        for i in range(num_steps):
            t_curr = base_schedule[i].item()
            t_next = base_schedule[i + 1].item()
            phase = self._get_resolution_phase(t_curr)

            if phase == "adaptive":
                # Replace this single step with multiple finer steps
                adaptive_steps = self._build_adaptive_schedule(
                    base_dt=t_curr - t_next,
                    t_start=t_curr,
                    t_end=t_next,
                )
                for at_curr, at_next in adaptive_steps:
                    all_steps.append((at_curr, at_next, "adaptive"))
            else:
                all_steps.append((t_curr, t_next, phase))

        steps_iter = all_steps
        if progress_bar:
            steps_iter = tqdm(steps_iter, desc="Pyramidal Euler sampling", leave=False)

        for t_curr, t_next, phase in steps_iter:
            dt = t_curr - t_next  # positive step size

            # Create batch timestep tensor
            t_batch = torch.full(
                (B,), t_curr, device=x_t.device, dtype=x_t.dtype
            )  # (B,)

            if phase == "low_res":
                # ── Low-resolution phase ────────────────────────────────────
                # Downsample latent to save compute
                x_t_low = self._downsample_latent(x_t)  # (B, C, T, H//f, W//f)

                if use_cfg:
                    v_cond = model(x_t_low, t_batch, condition)  # (B, C, T, H//f, W//f)
                    v_uncond = model(x_t_low, t_batch, uncondition)  # (B, C, T, H//f, W//f)
                    v_low = v_uncond + cfg_scale * (v_cond - v_uncond)  # (B, C, T, H//f, W//f)
                else:
                    v_low = model(x_t_low, t_batch, condition)  # (B, C, T, H//f, W//f)

                # Upsample velocity back to full resolution
                v = self._upsample_latent(v_low, full_size)  # (B, C, T, H, W)

            else:
                # ── Full resolution phase (both "full_res" and "adaptive") ──
                if use_cfg:
                    v_cond = model(x_t, t_batch, condition)  # (B, C, T, H, W)
                    v_uncond = model(x_t, t_batch, uncondition)  # (B, C, T, H, W)
                    v = v_uncond + cfg_scale * (v_cond - v_uncond)  # (B, C, T, H, W)
                else:
                    v = model(x_t, t_batch, condition)  # (B, C, T, H, W)

            # Euler update
            x_t = x_t - dt * v  # (B, C, T, H, W)

            if return_intermediates:
                intermediates.append(x_t.clone().cpu())

        if return_intermediates:
            return x_t, intermediates
        return x_t

    def __repr__(self) -> str:
        return (
            f"PyramidalEulerSampler("
            f"steps={self.config.num_inference_steps}, "
            f"cfg_scale={self.config.cfg_scale}, "
            f"downsample={self.downsample_factor}x, "
            f"schedule=[{self.low_threshold}, {self.high_threshold}])"
        )
