"""
Audio conditioning encoder for Project Hydra.

Lightweight convolutional encoder that converts raw audio waveforms into
temporal feature sequences for the audio DiT branch.  Includes energy-based
beat/onset detection for rhythmic attention in the attention bridge.

Dependencies:
    - torchaudio (primary) — mel spectrogram extraction
    - librosa (optional fallback) — mel spectrogram if torchaudio unavailable

If neither library is available the module will issue a warning and produce
zero-filled features from raw waveforms.
"""

from __future__ import annotations

import logging
import math
import warnings
from dataclasses import dataclass
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# ── Optional audio backend imports ──────────────────────────────────────────

_HAS_TORCHAUDIO = False
_HAS_LIBROSA = False

try:
    import torchaudio
    import torchaudio.transforms as T_audio

    _HAS_TORCHAUDIO = True
except ImportError:
    pass

try:
    import librosa  # noqa: F401
    import numpy as np

    _HAS_LIBROSA = True
except ImportError:
    pass

if not _HAS_TORCHAUDIO and not _HAS_LIBROSA:
    warnings.warn(
        "Neither torchaudio nor librosa found.  AudioEncoder will produce "
        "features from raw waveform only — mel spectrogram features will "
        "be unavailable.",
        stacklevel=2,
    )


# ─── Data Container ────────────────────────────────────────────────────────────


@dataclass
class AudioCondition:
    """Output container for audio conditioning signals.

    Attributes:
        hidden_states: Temporal audio feature sequence for cross-attention.
            Shape: (B, time_steps, dim)
        beats: Detected beat / onset frame indices (variable-length per
            sample, padded to max_beats with -1).
            Shape: (B, max_beats)
    """
    hidden_states: torch.Tensor  # (B, time_steps, dim)
    beats: torch.Tensor          # (B, max_beats)


# ─── Mel Spectrogram Extraction ────────────────────────────────────────────────


def extract_mel_spectrogram(
    waveform: torch.Tensor,
    sample_rate: int = 16000,
    n_mels: int = 80,
    hop_length: int = 256,
    n_fft: int = 1024,
    f_min: float = 0.0,
    f_max: Optional[float] = 8000.0,
) -> torch.Tensor:
    """Convert raw audio waveform to log-mel spectrogram.

    Tries torchaudio first, then librosa, then falls back to a simple
    magnitude STFT (no mel filterbank).

    Args:
        waveform: Raw audio tensor of shape (B, num_samples) or
            (num_samples,).  Expected to be float in [-1, 1].
        sample_rate: Audio sample rate in Hz.
        n_mels: Number of mel frequency bins.
        hop_length: STFT hop length in samples.
        n_fft: FFT window size.
        f_min: Minimum frequency for mel filterbank.
        f_max: Maximum frequency for mel filterbank.

    Returns:
        Log-mel spectrogram of shape (B, n_mels, time_frames).
    """
    if waveform.ndim == 1:
        waveform = waveform.unsqueeze(0)  # (1, num_samples)

    if _HAS_TORCHAUDIO:
        mel_transform = T_audio.MelSpectrogram(
            sample_rate=sample_rate,
            n_mels=n_mels,
            hop_length=hop_length,
            n_fft=n_fft,
            f_min=f_min,
            f_max=f_max,
            power=2.0,
        ).to(waveform.device)
        mel = mel_transform(waveform)                  # (B, n_mels, T)
        log_mel = torch.log(mel.clamp(min=1e-7))       # (B, n_mels, T)
        return log_mel

    if _HAS_LIBROSA:
        import numpy as np

        results = []
        for i in range(waveform.shape[0]):
            wav_np = waveform[i].cpu().numpy()
            mel_np = librosa.feature.melspectrogram(
                y=wav_np,
                sr=sample_rate,
                n_mels=n_mels,
                hop_length=hop_length,
                n_fft=n_fft,
                fmin=f_min,
                fmax=f_max,
            )
            log_mel_np = np.log(np.maximum(mel_np, 1e-7))
            results.append(torch.from_numpy(log_mel_np))
        return torch.stack(results, dim=0).to(waveform.device)  # (B, n_mels, T)

    # Fallback: magnitude STFT without mel filterbank
    warnings.warn(
        "Using raw STFT magnitude — install torchaudio or librosa for "
        "proper mel spectrograms.",
        stacklevel=2,
    )
    # torch.stft returns (B, n_fft//2+1, T, 2) in older PyTorch
    spec = torch.stft(
        waveform,
        n_fft=n_fft,
        hop_length=hop_length,
        return_complex=True,
    )
    mag = spec.abs()  # (B, n_fft//2+1, T)
    # Truncate or pad frequency axis to n_mels
    if mag.shape[1] > n_mels:
        mag = mag[:, :n_mels, :]
    elif mag.shape[1] < n_mels:
        pad = torch.zeros(
            mag.shape[0], n_mels - mag.shape[1], mag.shape[2],
            device=mag.device, dtype=mag.dtype,
        )
        mag = torch.cat([mag, pad], dim=1)
    return torch.log(mag.clamp(min=1e-7))  # (B, n_mels, T)


# ─── Beat / Onset Detection ───────────────────────────────────────────────────


def detect_beats(
    mel_spec: torch.Tensor,
    threshold_ratio: float = 1.5,
    max_beats: int = 64,
) -> torch.Tensor:
    """Simple energy-based onset detection via spectral flux.

    Computes the half-wave rectified difference of spectral energy between
    adjacent frames and identifies peaks above a dynamic threshold.

    Args:
        mel_spec: Log-mel spectrogram of shape (B, n_mels, T).
        threshold_ratio: Peaks must exceed ``mean_flux * threshold_ratio``
            to count as an onset.
        max_beats: Maximum number of beat positions to return per sample.
            Shorter sequences are padded with -1.

    Returns:
        Beat frame indices of shape (B, max_beats).  Padding value is -1.
    """
    B, _n_mels, T = mel_spec.shape

    # Spectral energy per frame: sum over mel bins
    energy = mel_spec.sum(dim=1)  # (B, T)

    # Spectral flux: positive differences only (onset = energy increase)
    flux = F.relu(energy[:, 1:] - energy[:, :-1])  # (B, T-1)

    # Dynamic threshold per sample
    mean_flux = flux.mean(dim=1, keepdim=True)  # (B, 1)
    threshold = mean_flux * threshold_ratio      # (B, 1)

    # Find peaks: flux[t] > flux[t-1] AND flux[t] > flux[t+1] AND > threshold
    # Pad flux for neighbor comparison
    padded = F.pad(flux, (1, 1), value=0.0)  # (B, T+1)
    is_peak = (
        (padded[:, 1:-1] > padded[:, :-2])
        & (padded[:, 1:-1] > padded[:, 2:])
        & (flux > threshold)
    )  # (B, T-1)

    # Extract beat positions per sample
    beat_batch = torch.full(
        (B, max_beats), fill_value=-1, dtype=torch.long, device=mel_spec.device
    )

    for b in range(B):
        peak_indices = torch.nonzero(is_peak[b], as_tuple=False).squeeze(-1)
        # peak_indices: (num_peaks,)
        num = min(peak_indices.shape[0], max_beats)
        if num > 0:
            # +1 offset because flux is computed on frames 1..T-1
            beat_batch[b, :num] = peak_indices[:num] + 1

    return beat_batch  # (B, max_beats)


# ─── Convolutional Audio Encoder ───────────────────────────────────────────────


class AudioEncoder(nn.Module):
    """Lightweight convolutional encoder for audio conditioning.

    Converts mel spectrograms into a temporal feature sequence suitable for
    cross-attention in the audio (and optionally visual) DiT branch.  Also
    returns detected beat positions for rhythmic attention.

    The architecture is a small stack of 1-D convolutions along the time
    axis (after collapsing the mel-frequency dimension), designed to run
    efficiently even on CPU during inference.

    Args:
        mel_channels: Number of mel frequency bins (input feature dim).
        hidden_dim: Output feature dimension for each time step.
        sample_rate: Expected audio sample rate.
        hop_length: Mel spectrogram hop length (controls time resolution).
        max_beats: Maximum number of beat positions to detect.
        n_fft: FFT window size for mel extraction.

    Example::

        enc = AudioEncoder(mel_channels=80, hidden_dim=256)
        waveform = torch.randn(2, 16000 * 5)  # 5 seconds of audio
        cond = enc(waveform)
        # cond.hidden_states.shape ≈ (2, 312, 256) for 5s @ 16kHz, hop=256
    """

    def __init__(
        self,
        mel_channels: int = 80,
        hidden_dim: int = 256,
        sample_rate: int = 16000,
        hop_length: int = 256,
        max_beats: int = 64,
        n_fft: int = 1024,
    ) -> None:
        super().__init__()

        self.mel_channels = mel_channels
        self.hidden_dim = hidden_dim
        self.sample_rate = sample_rate
        self.hop_length = hop_length
        self.max_beats = max_beats
        self.n_fft = n_fft

        # ── Convolutional stack ─────────────────────────────────────────
        # Input: (B, mel_channels, T) — treat mel bins as "channels"
        # We use 1D causal-style convolutions along time.
        self.conv_stack = nn.Sequential(
            # Stage 1: mel_channels → hidden_dim, kernel=3, stride=1
            nn.Conv1d(mel_channels, hidden_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, hidden_dim),
            nn.GELU(),

            # Stage 2: hidden_dim → hidden_dim, kernel=3, stride=1
            nn.Conv1d(hidden_dim, hidden_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, hidden_dim),
            nn.GELU(),

            # Stage 3: hidden_dim → hidden_dim, kernel=3, stride=1
            nn.Conv1d(hidden_dim, hidden_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, hidden_dim),
            nn.GELU(),
        )

        # Final projection (1×1 conv = linear per time step)
        self.out_proj = nn.Conv1d(hidden_dim, hidden_dim, kernel_size=1)

        # ── Null token for unconditional generation ─────────────────────
        # Learned null sequence — fixed length covering ~2 seconds of audio
        null_len = max(1, (sample_rate * 2) // hop_length)
        self.null_hidden = nn.Parameter(
            torch.randn(1, null_len, hidden_dim) * 0.02
        )

        self._init_weights()

    def _init_weights(self) -> None:
        """Initialise convolutional weights with Kaiming normal."""
        for m in self.modules():
            if isinstance(m, nn.Conv1d):
                nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    # ── Forward ─────────────────────────────────────────────────────────────

    def forward(
        self,
        audio: torch.Tensor,
        sample_rate: Optional[int] = None,
    ) -> AudioCondition:
        """Encode raw audio waveform into temporal conditioning features.

        Args:
            audio: Raw waveform of shape (B, num_samples) or (num_samples,).
                Expected float in [-1, 1].
            sample_rate: Override sample rate.  If the input was recorded at
                a different rate it will be resampled to ``self.sample_rate``.

        Returns:
            AudioCondition with temporal hidden_states and beat positions.
        """
        if audio.ndim == 1:
            audio = audio.unsqueeze(0)  # (1, num_samples)

        sr = sample_rate or self.sample_rate

        # Resample if needed
        if _HAS_TORCHAUDIO and sr != self.sample_rate:
            resampler = torchaudio.transforms.Resample(
                orig_freq=sr, new_freq=self.sample_rate
            ).to(audio.device)
            audio = resampler(audio)  # (B, new_num_samples)

        # ── Mel spectrogram ─────────────────────────────────────────────
        mel = extract_mel_spectrogram(
            audio,
            sample_rate=self.sample_rate,
            n_mels=self.mel_channels,
            hop_length=self.hop_length,
            n_fft=self.n_fft,
        )  # (B, mel_channels, T)

        # ── Beat detection (on mel, before conv) ────────────────────────
        beats = detect_beats(
            mel, max_beats=self.max_beats
        )  # (B, max_beats)

        # ── Convolutional encoding ──────────────────────────────────────
        h = self.conv_stack(mel)      # (B, hidden_dim, T)
        h = self.out_proj(h)          # (B, hidden_dim, T)

        # Transpose to sequence-first layout for transformer consumption
        hidden_states = h.transpose(1, 2)  # (B, T, hidden_dim)

        return AudioCondition(
            hidden_states=hidden_states,  # (B, T, hidden_dim)
            beats=beats,                   # (B, max_beats)
        )

    # ── Null encoding ───────────────────────────────────────────────────────

    def encode_null(self, batch_size: int = 1) -> AudioCondition:
        """Produce learned null audio conditioning for CFG.

        Args:
            batch_size: Number of null embeddings to produce.

        Returns:
            AudioCondition with learned null tokens and empty beats (-1).
        """
        hidden_states = self.null_hidden.expand(
            batch_size, -1, -1
        )  # (B, null_len, hidden_dim)

        beats = torch.full(
            (batch_size, self.max_beats),
            fill_value=-1,
            dtype=torch.long,
            device=self.null_hidden.device,
        )  # (B, max_beats)

        return AudioCondition(
            hidden_states=hidden_states,
            beats=beats,
        )

    # ── Utility ─────────────────────────────────────────────────────────────

    @property
    def output_dim(self) -> int:
        """Output feature dimension per time step."""
        return self.hidden_dim

    def extra_repr(self) -> str:
        return (
            f"mel_channels={self.mel_channels}, "
            f"hidden_dim={self.hidden_dim}, "
            f"sample_rate={self.sample_rate}, "
            f"hop_length={self.hop_length}"
        )
