"""
Hydra configuration system.

Hierarchical config using dataclasses with YAML override support.
Configs define model architecture, training, and inference parameters.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Tuple
from pathlib import Path
import yaml


# ─── VAE Configuration ─────────────────────────────────────────────────────────

@dataclass
class VAEConfig:
    """Causal 3D VAE configuration."""
    in_channels: int = 3
    latent_dim: int = 4
    channels: List[int] = field(default_factory=lambda: [64, 128, 256])
    num_res_blocks: int = 2
    spatial_downsample: int = 8       # Total spatial compression factor
    temporal_downsample: int = 4      # Total temporal compression factor
    attention_resolutions: List[int] = field(default_factory=lambda: [32])
    group_size: int = 4               # Frames per group for group causal conv
    dropout: float = 0.0
    kl_weight: float = 1e-6


# ─── Transformer Configuration ─────────────────────────────────────────────────

@dataclass
class VisualBranchConfig:
    """Visual DiT branch configuration."""
    hidden_dim: int = 512
    num_heads: int = 8
    num_blocks: int = 12
    patch_size: Tuple[int, int, int] = (1, 2, 2)  # (T, H, W)
    mlp_ratio: float = 4.0
    dropout: float = 0.0
    use_rope3d: bool = True
    attention_mode: str = "factorized"  # "factorized" | "full"


@dataclass
class AudioBranchConfig:
    """Audio DiT branch configuration."""
    hidden_dim: int = 256
    num_heads: int = 4
    num_blocks: int = 6
    patch_size: Tuple[int, int] = (2, 16)  # (time, freq) for mel spectrogram
    mlp_ratio: float = 4.0
    dropout: float = 0.0


@dataclass
class AttentionBridgeConfig:
    """Attention bridge between visual and audio branches."""
    num_heads: int = 8
    frequency: int = 3              # Bridge every N blocks
    use_gradient_gating: bool = True
    gate_init: float = 0.0          # Initialize gates to zero (no flow initially)
    use_rhythmic_attention: bool = True
    rhythmic_heads: int = 2         # Dedicated heads for beat/motion sync


@dataclass
class TransformerConfig:
    """Full dual-branch transformer configuration."""
    visual: VisualBranchConfig = field(default_factory=VisualBranchConfig)
    audio: AudioBranchConfig = field(default_factory=AudioBranchConfig)
    bridge: AttentionBridgeConfig = field(default_factory=AttentionBridgeConfig)
    enable_audio_branch: bool = True


# ─── Flow Matching Configuration ────────────────────────────────────────────────

@dataclass
class FlowConfig:
    """Rectified flow matching configuration."""
    timestep_distribution: str = "logit_normal"   # "uniform" | "logit_normal" | "u_shaped"
    logit_normal_mean: float = 0.0
    logit_normal_std: float = 1.0
    num_inference_steps: int = 20
    cfg_scale: float = 4.0
    use_pyramidal: bool = True       # Pyramidal flow matching
    pyramid_levels: int = 3
    pyramid_schedule: List[float] = field(default_factory=lambda: [0.3, 0.6, 1.0])


# ─── Conditioning Configuration ─────────────────────────────────────────────────

@dataclass
class ConditioningConfig:
    """Multi-modal conditioning configuration."""
    text_encoder: str = "t5-small"       # "t5-small" | "t5-base" | "google/t5-v1_1-xxl"
    text_max_length: int = 128
    use_image_encoder: bool = True
    image_encoder: str = "clip-vit-base"  # "clip-vit-base" | "clip-vit-large"
    max_reference_images: int = 9
    use_audio_encoder: bool = True
    mel_channels: int = 80
    mel_hop_length: int = 256
    sample_rate: int = 16000


# ─── Training Configuration ─────────────────────────────────────────────────────

@dataclass
class TrainingConfig:
    """Training configuration."""
    resolution: int = 256
    num_frames: int = 16
    batch_size: int = 1
    gradient_accumulation_steps: int = 4
    learning_rate: float = 1e-4
    weight_decay: float = 0.01
    warmup_steps: int = 1000
    num_steps: int = 100000
    precision: str = "bf16"              # "fp32" | "fp16" | "bf16"
    ema_decay: float = 0.9999
    max_grad_norm: float = 1.0
    save_every: int = 5000
    log_every: int = 100
    eval_every: int = 2500
    output_dir: str = "./outputs"
    seed: int = 42


# ─── Top-Level Configuration ────────────────────────────────────────────────────

@dataclass
class HydraConfig:
    """Top-level Hydra configuration."""
    vae: VAEConfig = field(default_factory=VAEConfig)
    transformer: TransformerConfig = field(default_factory=TransformerConfig)
    flow: FlowConfig = field(default_factory=FlowConfig)
    conditioning: ConditioningConfig = field(default_factory=ConditioningConfig)
    training: TrainingConfig = field(default_factory=TrainingConfig)

    @staticmethod
    def from_yaml(path: str) -> "HydraConfig":
        """Load config from YAML file with defaults for unspecified fields."""
        with open(path, "r") as f:
            raw = yaml.safe_load(f) or {}

        config = HydraConfig()
        _update_dataclass(config, raw)
        return config

    def to_yaml(self, path: str) -> None:
        """Save config to YAML file."""
        from dataclasses import asdict
        with open(path, "w") as f:
            yaml.dump(asdict(self), f, default_flow_style=False, sort_keys=False)


def _update_dataclass(obj, overrides: dict):
    """Recursively update a dataclass from a dict of overrides."""
    from dataclasses import fields as dc_fields
    if not overrides:
        return
    for f in dc_fields(obj):
        if f.name in overrides:
            val = overrides[f.name]
            current = getattr(obj, f.name)
            if hasattr(current, "__dataclass_fields__") and isinstance(val, dict):
                _update_dataclass(current, val)
            else:
                # Convert lists/tuples properly
                if isinstance(current, tuple) and isinstance(val, list):
                    val = tuple(val)
                setattr(obj, f.name, val)


# ─── Preset Configs ──────────────────────────────────────────────────────────────

def hydra_nano() -> HydraConfig:
    """Nano config: ~150M params, trainable on 1x 8GB GPU."""
    return HydraConfig()  # Defaults are nano-scale


def hydra_small() -> HydraConfig:
    """Small config: ~500M params, trainable on 1x 24GB GPU."""
    config = HydraConfig()
    config.vae.channels = [128, 256, 512]
    config.vae.latent_dim = 8
    config.transformer.visual = VisualBranchConfig(
        hidden_dim=768, num_heads=12, num_blocks=18
    )
    config.transformer.audio = AudioBranchConfig(
        hidden_dim=384, num_heads=6, num_blocks=9
    )
    config.conditioning.text_encoder = "t5-base"
    config.training.resolution = 384
    config.training.num_frames = 24
    return config


def hydra_base() -> HydraConfig:
    """Base config: ~1.3B params, requires multi-GPU."""
    config = HydraConfig()
    config.vae.channels = [128, 256, 512, 512]
    config.vae.latent_dim = 16
    config.transformer.visual = VisualBranchConfig(
        hidden_dim=1024, num_heads=16, num_blocks=24
    )
    config.transformer.audio = AudioBranchConfig(
        hidden_dim=512, num_heads=8, num_blocks=12
    )
    config.transformer.bridge = AttentionBridgeConfig(
        num_heads=16, frequency=4
    )
    config.conditioning.text_encoder = "google/t5-v1_1-xxl"
    config.training.resolution = 512
    config.training.num_frames = 32
    config.flow.num_inference_steps = 30
    return config
