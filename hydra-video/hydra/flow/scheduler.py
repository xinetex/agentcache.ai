"""
Rectified Flow Matching scheduler for Project Hydra.

Implements the core operations of rectified flow matching:
- Timestep sampling from configurable distributions
- Linear interpolation between data and noise (forward process)
- Velocity field targets for training
- Deterministic timestep schedules for inference

Rectified flow defines straight-line paths between data x_0 and noise x_1:
    x_t = (1 - t) * x_0 + t * noise
    v_target = noise - x_0  (constant velocity along the path)

References:
    - Liu et al., "Flow Matching for Generative Modeling" (2022)
    - Lipman et al., "Flow Matching for Scalable Simulation-Free Training" (2022)
    - Esser et al., "Scaling Rectified Flow Transformers for High-Resolution Image Synthesis" (2024)
"""

from __future__ import annotations

import math
from typing import Optional, Tuple

import torch
import torch.nn as nn

from hydra.config import FlowConfig


class FlowMatchingScheduler(nn.Module):
    """Rectified flow matching scheduler.

    Handles timestep sampling during training and timestep schedule generation
    during inference. Supports multiple sampling distributions that bias training
    toward different parts of the diffusion trajectory.

    Args:
        config: FlowConfig dataclass with scheduler hyperparameters.
    """

    def __init__(self, config: Optional[FlowConfig] = None) -> None:
        super().__init__()
        self.config = config or FlowConfig()

        # Validate distribution name
        valid_distributions = {"uniform", "logit_normal", "u_shaped"}
        if self.config.timestep_distribution not in valid_distributions:
            raise ValueError(
                f"Unknown timestep distribution '{self.config.timestep_distribution}'. "
                f"Must be one of {valid_distributions}."
            )

        # Logit-normal parameters
        self.logit_normal_mean: float = self.config.logit_normal_mean
        self.logit_normal_std: float = self.config.logit_normal_std

        # Small epsilon to prevent exact 0 or 1 timesteps (numerical stability)
        self.eps: float = 1e-5

    def sample_timesteps(
        self,
        batch_size: int,
        device: torch.device,
        generator: Optional[torch.Generator] = None,
    ) -> torch.Tensor:
        """Sample timesteps from the configured distribution.

        Args:
            batch_size: Number of timesteps to sample.
            device: Device to place the timestep tensor on.
            generator: Optional random number generator for reproducibility.

        Returns:
            Tensor of shape (B,) with values in [eps, 1 - eps].
        """
        distribution = self.config.timestep_distribution

        if distribution == "uniform":
            t = self._sample_uniform(batch_size, device, generator)
        elif distribution == "logit_normal":
            t = self._sample_logit_normal(batch_size, device, generator)
        elif distribution == "u_shaped":
            t = self._sample_u_shaped(batch_size, device, generator)
        else:
            raise ValueError(f"Unknown distribution: {distribution}")

        # Clamp to [eps, 1-eps] for numerical stability
        t = t.clamp(self.eps, 1.0 - self.eps)  # (B,)
        return t

    def _sample_uniform(
        self,
        batch_size: int,
        device: torch.device,
        generator: Optional[torch.Generator] = None,
    ) -> torch.Tensor:
        """Sample from Uniform[0, 1].

        Returns:
            Tensor of shape (B,) ~ U(0, 1).
        """
        return torch.rand(batch_size, device=device, generator=generator)  # (B,)

    def _sample_logit_normal(
        self,
        batch_size: int,
        device: torch.device,
        generator: Optional[torch.Generator] = None,
    ) -> torch.Tensor:
        """Sample from the logit-normal distribution.

        Draws z ~ N(mean, std²), then applies sigmoid to map to (0, 1).
        This biases samples toward the middle of the [0, 1] interval,
        which has been shown to improve training stability for flow matching
        (see SD3 / Stable Diffusion 3 training recipe).

        Returns:
            Tensor of shape (B,) ~ LogitNormal(mean, std).
        """
        # Sample from standard normal and shift/scale
        z = torch.randn(batch_size, device=device, generator=generator)  # (B,)
        z = z * self.logit_normal_std + self.logit_normal_mean  # (B,)
        # Apply sigmoid: maps R → (0, 1), concentrating mass around 0.5
        t = torch.sigmoid(z)  # (B,)
        return t

    def _sample_u_shaped(
        self,
        batch_size: int,
        device: torch.device,
        generator: Optional[torch.Generator] = None,
    ) -> torch.Tensor:
        """Sample from a U-shaped Beta(0.5, 0.5) distribution.

        This is the arcsine distribution, which concentrates mass near t=0
        and t=1. Useful when the model needs extra training signal at the
        endpoints of the flow trajectory (pure noise and near-clean data).

        Returns:
            Tensor of shape (B,) ~ Beta(0.5, 0.5).
        """
        # PyTorch's Beta distribution doesn't support generators directly,
        # so we use the inverse CDF method: if U ~ Uniform(0,1), then
        # sin²(π/2 * U) ~ Beta(0.5, 0.5).
        u = torch.rand(batch_size, device=device, generator=generator)  # (B,)
        t = torch.sin(u * (math.pi / 2.0)) ** 2  # (B,)
        return t

    def add_noise(
        self,
        x_0: torch.Tensor,
        noise: torch.Tensor,
        t: torch.Tensor,
    ) -> torch.Tensor:
        """Linearly interpolate between clean data and noise.

        Implements the forward process of rectified flow:
            x_t = (1 - t) * x_0 + t * noise

        This defines straight-line paths from x_0 (data) at t=0
        to noise at t=1.

        Args:
            x_0: Clean data tensor of shape (B, C, T, H, W).
            noise: Noise tensor of shape (B, C, T, H, W), typically ~ N(0, I).
            t: Timestep tensor of shape (B,). Will be reshaped internally.

        Returns:
            Noised tensor x_t of shape (B, C, T, H, W).
        """
        # Reshape t to broadcast over spatial/temporal dims: (B,) → (B, 1, 1, 1, 1)
        t_expanded = t[:, None, None, None, None]  # (B, 1, 1, 1, 1)

        # Linear interpolation: straight-line ODE path
        x_t = (1.0 - t_expanded) * x_0 + t_expanded * noise  # (B, C, T, H, W)
        return x_t

    def get_velocity(
        self,
        x_0: torch.Tensor,
        noise: torch.Tensor,
    ) -> torch.Tensor:
        """Compute the target velocity field for rectified flow.

        For straight-line paths x_t = (1-t)*x_0 + t*noise, the velocity is:
            v = dx_t/dt = noise - x_0

        This is constant along the path (independent of t), which makes
        rectified flow particularly clean to train.

        Args:
            x_0: Clean data tensor of shape (B, C, T, H, W).
            noise: Noise tensor of shape (B, C, T, H, W).

        Returns:
            Target velocity tensor of shape (B, C, T, H, W).
        """
        v_target = noise - x_0  # (B, C, T, H, W)
        return v_target

    def get_timestep_schedule(
        self,
        num_steps: Optional[int] = None,
        device: Optional[torch.device] = None,
    ) -> torch.Tensor:
        """Generate a linearly-spaced timestep schedule for inference.

        Returns timesteps from 1.0 → 0.0 (noise → clean data), which is
        the direction we solve the ODE during sampling.

        Args:
            num_steps: Number of sampling steps. Defaults to config value.
            device: Device for the output tensor.

        Returns:
            Tensor of shape (num_steps + 1,) with values from 1.0 to 0.0 inclusive.
            The schedule has num_steps+1 entries so that there are num_steps
            intervals between consecutive timesteps.
        """
        num_steps = num_steps or self.config.num_inference_steps

        # Linearly spaced from 1.0 to 0.0
        schedule = torch.linspace(1.0, 0.0, steps=num_steps + 1, device=device)  # (S+1,)
        return schedule

    def get_dt(
        self,
        schedule: torch.Tensor,
        step_idx: int,
    ) -> float:
        """Compute the step size dt for a given step index.

        Args:
            schedule: Timestep schedule tensor of shape (num_steps + 1,).
            step_idx: Current step index (0-indexed).

        Returns:
            Step size dt = t_{i} - t_{i+1} (positive value).
        """
        dt = (schedule[step_idx] - schedule[step_idx + 1]).item()
        return dt

    def __repr__(self) -> str:
        return (
            f"FlowMatchingScheduler("
            f"distribution={self.config.timestep_distribution!r}, "
            f"inference_steps={self.config.num_inference_steps}, "
            f"pyramidal={self.config.use_pyramidal})"
        )
