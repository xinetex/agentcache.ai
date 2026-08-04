"""Multi-modal conditioning: text, image, audio, and unified fusion."""

from hydra.conditioning.text_encoder import TextEncoder, TextCondition
from hydra.conditioning.image_encoder import ImageEncoder, ImageCondition
from hydra.conditioning.audio_encoder import AudioEncoder, AudioCondition
from hydra.conditioning.quad_modal import QuadModalConditioner, HydraCondition

__all__ = [
    "TextEncoder",
    "TextCondition",
    "ImageEncoder",
    "ImageCondition",
    "AudioEncoder",
    "AudioCondition",
    "QuadModalConditioner",
    "HydraCondition",
]
