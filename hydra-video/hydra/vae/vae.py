"""
Causal Video VAE — Top-level module for Project Hydra.

Wraps the VideoEncoder and VideoDecoder into a complete Variational Autoencoder
with reparameterization trick, reconstruction loss, and KL divergence.

The VAE compresses video spatiotemporally:
    (B, 3, T, H, W) → latent (B, latent_dim, T//4, H//8, W//8) → (B, 3, T, H, W)

Supports:
    - Variable-length video (arbitrary T values, must be divisible by temporal_downsample)
    - Configurable via VAEConfig dataclass
    - Gradient checkpointing for memory efficiency
    - Both training (forward with loss) and inference (encode/decode) modes
"""

from typing import Dict, NamedTuple, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from hydra.config import VAEConfig
from hydra.vae.encoder import VideoEncoder
from hydra.vae.decoder import VideoDecoder


class VAEPosterior(NamedTuple):
    """Posterior distribution parameters from the encoder."""
    mean: torch.Tensor       # (B, latent_dim, T', H', W')
    log_var: torch.Tensor    # (B, latent_dim, T', H', W')


class VAEOutput(NamedTuple):
    """Full VAE forward pass output."""
    reconstruction: torch.Tensor  # (B, 3, T, H, W)
    mean: torch.Tensor            # (B, latent_dim, T', H', W')
    log_var: torch.Tensor         # (B, latent_dim, T', H', W')
    z: torch.Tensor               # (B, latent_dim, T', H', W')


class CausalVideoVAE(nn.Module):
    """Causal 3D Video Variational Autoencoder.

    Compresses video spatiotemporally while maintaining strict temporal causality
    (output frame t depends only on input frames ≤ t). Uses a causal 3D convolutional
    architecture with group causal convolutions for improved reconstruction quality.

    Compression ratios (default config):
        Spatial:  8× (H, W each reduced by 8)
        Temporal: 4× (T reduced by 4)
        Channel:  3 → latent_dim (default 4)

    Training pipeline:
        x → encode → (mean, log_var) → sample z → decode → recon
        loss = MSE(x, recon) + kl_weight * KL(q(z|x) || p(z))

    Inference pipeline:
        x → encode → (mean, log_var) → sample z → decode → recon

    Args:
        config: VAEConfig dataclass with architecture and training parameters.
    """

    def __init__(self, config: Optional[VAEConfig] = None) -> None:
        super().__init__()

        if config is None:
            config = VAEConfig()

        self.config = config
        self.latent_dim = config.latent_dim
        self.kl_weight = config.kl_weight

        # ── Encoder ──
        self.encoder = VideoEncoder(
            in_channels=config.in_channels,
            latent_dim=config.latent_dim,
            channels=config.channels,
            num_res_blocks=config.num_res_blocks,
            attention_resolutions=config.attention_resolutions,
            dropout=config.dropout,
        )

        # ── Decoder ──
        self.decoder = VideoDecoder(
            out_channels=config.in_channels,
            latent_dim=config.latent_dim,
            channels=config.channels,
            num_res_blocks=config.num_res_blocks,
            dropout=config.dropout,
        )

        # ── Latent scaling ──
        # Learned scaling factor for the latent space, initialized to 1.0
        # Helps stabilize training by keeping latent magnitudes in a good range
        self.latent_scale = nn.Parameter(torch.ones(1))

    def encode(self, x: torch.Tensor) -> VAEPosterior:
        """Encode video to posterior distribution parameters.

        Args:
            x: Input video tensor of shape (B, C_in, T, H, W) where
               C_in is typically 3 (RGB), T must be divisible by temporal_downsample (4),
               H and W must be divisible by spatial_downsample (8).

        Returns:
            VAEPosterior containing:
                mean:    (B, latent_dim, T//4, H//8, W//8)
                log_var: (B, latent_dim, T//4, H//8, W//8)
        """
        # x: (B, C_in, T, H, W)
        h = self.encoder(x)
        # h: (B, 2*latent_dim, T//4, H//8, W//8)

        # Split into mean and log_var along channel dimension
        mean, log_var = h.chunk(2, dim=1)
        # mean:    (B, latent_dim, T//4, H//8, W//8)
        # log_var: (B, latent_dim, T//4, H//8, W//8)

        # Clamp log_var for numerical stability
        # Prevents extremely large or small variances
        log_var = torch.clamp(log_var, min=-30.0, max=20.0)

        return VAEPosterior(mean=mean, log_var=log_var)

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        """Decode latent tensor to video.

        Args:
            z: Latent tensor of shape (B, latent_dim, T', H', W') where
               T' = T//4, H' = H//8, W' = W//8.

        Returns:
            Reconstructed video of shape (B, C_in, T, H, W).
        """
        # z: (B, latent_dim, T', H', W')

        # Apply learned latent scaling
        z_scaled = z / self.latent_scale
        # z_scaled: (B, latent_dim, T', H', W')

        recon = self.decoder(z_scaled)
        # recon: (B, C_in, T'*4, H'*8, W'*8) = (B, C_in, T, H, W)

        return recon

    def sample(
        self,
        mean: torch.Tensor,
        log_var: torch.Tensor,
        generator: Optional[torch.Generator] = None,
    ) -> torch.Tensor:
        """Sample from the posterior using the reparameterization trick.

        z = mean + std * epsilon, where epsilon ~ N(0, I)

        This allows gradients to flow through the sampling operation.

        Args:
            mean: Posterior mean of shape (B, latent_dim, T', H', W').
            log_var: Posterior log-variance of shape (B, latent_dim, T', H', W').
            generator: Optional random number generator for reproducibility.

        Returns:
            Sampled latent tensor of shape (B, latent_dim, T', H', W').
        """
        # mean:    (B, latent_dim, T', H', W')
        # log_var: (B, latent_dim, T', H', W')

        # Compute standard deviation from log variance
        std = torch.exp(0.5 * log_var)
        # std: (B, latent_dim, T', H', W')

        # Sample epsilon from standard normal
        epsilon = torch.randn_like(std, generator=generator)
        # epsilon: (B, latent_dim, T', H', W')

        # Reparameterization trick
        z = mean + std * epsilon
        # z: (B, latent_dim, T', H', W')

        # Apply learned latent scaling
        z = z * self.latent_scale
        # z: (B, latent_dim, T', H', W')

        return z

    def loss(
        self,
        x: torch.Tensor,
        reconstruction: torch.Tensor,
        mean: torch.Tensor,
        log_var: torch.Tensor,
    ) -> Dict[str, torch.Tensor]:
        """Compute VAE loss: reconstruction + KL divergence.

        Loss = MSE(x, recon) + kl_weight * KL(q(z|x) || N(0, I))

        The KL divergence has a closed-form solution for Gaussian posterior
        against a standard normal prior:
            KL = -0.5 * sum(1 + log_var - mean^2 - exp(log_var))

        Args:
            x: Original input video of shape (B, C, T, H, W).
            reconstruction: Reconstructed video of shape (B, C, T, H, W).
            mean: Posterior mean of shape (B, latent_dim, T', H', W').
            log_var: Posterior log-variance of shape (B, latent_dim, T', H', W').

        Returns:
            Dictionary with:
                'total': Combined loss scalar
                'reconstruction': MSE reconstruction loss scalar
                'kl': KL divergence loss scalar
        """
        # x, reconstruction: (B, C, T, H, W)
        # mean, log_var:     (B, latent_dim, T', H', W')

        # ── Reconstruction loss (per-element MSE, averaged over all dims) ──
        recon_loss = F.mse_loss(reconstruction, x, reduction="mean")
        # recon_loss: scalar

        # ── KL divergence ──
        # Closed-form KL(N(mean, var) || N(0, I))
        # = -0.5 * sum(1 + log(var) - mean^2 - var)
        # = -0.5 * sum(1 + log_var - mean^2 - exp(log_var))
        kl_loss = -0.5 * torch.mean(
            1.0 + log_var - mean.pow(2) - log_var.exp()
        )
        # kl_loss: scalar

        # ── Total loss ──
        total_loss = recon_loss + self.kl_weight * kl_loss
        # total_loss: scalar

        return {
            "total": total_loss,
            "reconstruction": recon_loss,
            "kl": kl_loss,
        }

    def forward(
        self,
        x: torch.Tensor,
        sample_posterior: bool = True,
        generator: Optional[torch.Generator] = None,
    ) -> VAEOutput:
        """Full VAE forward pass: encode → sample → decode.

        Args:
            x: Input video tensor of shape (B, C_in, T, H, W).
               T must be divisible by 4, H and W must be divisible by 8.
            sample_posterior: If True, sample from posterior (training mode).
                              If False, use the mean directly (deterministic mode).
            generator: Optional RNG for reproducible sampling.

        Returns:
            VAEOutput containing:
                reconstruction: (B, C_in, T, H, W) — reconstructed video
                mean:           (B, latent_dim, T//4, H//8, W//8) — posterior mean
                log_var:        (B, latent_dim, T//4, H//8, W//8) — posterior log-var
                z:              (B, latent_dim, T//4, H//8, W//8) — sampled latent
        """
        B, C, T, H, W = x.shape

        # Validate input dimensions
        assert T % self.config.temporal_downsample == 0, (
            f"Temporal dim T={T} must be divisible by "
            f"temporal_downsample={self.config.temporal_downsample}"
        )
        assert H % self.config.spatial_downsample == 0, (
            f"Spatial dim H={H} must be divisible by "
            f"spatial_downsample={self.config.spatial_downsample}"
        )
        assert W % self.config.spatial_downsample == 0, (
            f"Spatial dim W={W} must be divisible by "
            f"spatial_downsample={self.config.spatial_downsample}"
        )

        # ── Encode ──
        posterior = self.encode(x)
        # posterior.mean:    (B, latent_dim, T//4, H//8, W//8)
        # posterior.log_var: (B, latent_dim, T//4, H//8, W//8)

        # ── Sample ──
        if sample_posterior:
            z = self.sample(posterior.mean, posterior.log_var, generator=generator)
        else:
            # Deterministic: use posterior mean with scaling
            z = posterior.mean * self.latent_scale
        # z: (B, latent_dim, T//4, H//8, W//8)

        # ── Decode ──
        reconstruction = self.decode(z)
        # reconstruction: (B, C_in, T, H, W)

        return VAEOutput(
            reconstruction=reconstruction,
            mean=posterior.mean,
            log_var=posterior.log_var,
            z=z,
        )

    @torch.no_grad()
    def encode_video(self, x: torch.Tensor) -> torch.Tensor:
        """Encode video to latent representation (inference helper).

        Uses the posterior mean for deterministic encoding.

        Args:
            x: Input video of shape (B, C_in, T, H, W).

        Returns:
            Latent tensor of shape (B, latent_dim, T//4, H//8, W//8).
        """
        posterior = self.encode(x)
        # Use mean for deterministic encoding, apply scaling
        return posterior.mean * self.latent_scale

    @torch.no_grad()
    def decode_latent(self, z: torch.Tensor) -> torch.Tensor:
        """Decode latent to video (inference helper).

        Args:
            z: Latent tensor of shape (B, latent_dim, T', H', W').

        Returns:
            Reconstructed video of shape (B, C_in, T, H, W).
        """
        return self.decode(z)

    def get_latent_shape(
        self, batch_size: int, num_frames: int, height: int, width: int
    ) -> Tuple[int, int, int, int, int]:
        """Compute the latent tensor shape for a given input shape.

        Args:
            batch_size: Batch size.
            num_frames: Number of input video frames (T).
            height: Input height (H).
            width: Input width (W).

        Returns:
            Tuple of (B, latent_dim, T', H', W') where
            T' = T // temporal_downsample,
            H' = H // spatial_downsample,
            W' = W // spatial_downsample.
        """
        return (
            batch_size,
            self.latent_dim,
            num_frames // self.config.temporal_downsample,
            height // self.config.spatial_downsample,
            width // self.config.spatial_downsample,
        )

    def enable_gradient_checkpointing(self) -> None:
        """Enable gradient checkpointing for memory-efficient training.

        Trades compute for memory by recomputing intermediate activations
        during the backward pass instead of storing them.
        """
        # Enable for encoder stages
        for stage in self.encoder.down_stages:
            for res_block in stage["res_blocks"]:
                res_block.forward = torch.utils.checkpoint.checkpoint_wrapper(
                    res_block.forward, use_reentrant=False
                )

        # Enable for decoder stages
        for stage in self.decoder.up_stages:
            for res_block in stage["res_blocks"]:
                res_block.forward = torch.utils.checkpoint.checkpoint_wrapper(
                    res_block.forward, use_reentrant=False
                )
