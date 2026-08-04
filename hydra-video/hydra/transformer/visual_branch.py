"""
Visual Branch — Stack of DiT blocks for the visual generation pathway.

The visual branch is the primary pathway in Hydra's dual-branch architecture.
It processes video latent tokens through a series of DiT blocks, with optional
bridge points where information is exchanged with the audio branch.

Supports gradient checkpointing for memory-efficient training of deep models.
"""

from typing import Optional, Tuple, List, Dict

import torch
import torch.nn as nn
from torch.utils.checkpoint import checkpoint

from hydra.config import VisualBranchConfig
from hydra.transformer.dit_block import DiTBlock


class VisualBranch(nn.Module):
    """
    Visual DiT branch: stack of DiT blocks for video generation.

    Each block applies:
    1. Factorized spatiotemporal self-attention (with RoPE3D)
    2. Cross-attention with conditioning (text/image embeddings)
    3. GEGLU feed-forward network
    All modulated by adaLN-Zero from the timestep embedding.

    At specified bridge layer indices, the branch exposes its tokens for
    exchange with the audio branch via the attention bridge.

    Args:
        config: VisualBranchConfig with architecture hyperparameters.
        cond_dim: Dimension of conditioning tokens (text encoder output).
    """

    def __init__(
        self,
        config: VisualBranchConfig,
        cond_dim: Optional[int] = None,
    ) -> None:
        super().__init__()
        self.config = config
        self.hidden_dim = config.hidden_dim
        self.num_blocks = config.num_blocks
        self.gradient_checkpointing = False  # Toggled externally for training

        # Conditioning projection: map external cond_dim → hidden_dim if needed
        self.cond_dim = cond_dim or config.hidden_dim
        if self.cond_dim != config.hidden_dim:
            self.cond_proj = nn.Linear(self.cond_dim, config.hidden_dim)
            nn.init.kaiming_normal_(self.cond_proj.weight, nonlinearity="linear")
            nn.init.zeros_(self.cond_proj.bias)
        else:
            self.cond_proj = nn.Identity()

        # Stack of DiT blocks
        self.blocks = nn.ModuleList([
            DiTBlock(
                dim=config.hidden_dim,
                num_heads=config.num_heads,
                cond_dim=config.hidden_dim,  # After projection, cond is in hidden_dim
                mlp_ratio=config.mlp_ratio,
                dropout=config.dropout,
                use_rope=config.use_rope3d,
                qk_norm=True,
            )
            for _ in range(config.num_blocks)
        ])

    def enable_gradient_checkpointing(self) -> None:
        """Enable gradient checkpointing for memory-efficient training."""
        self.gradient_checkpointing = True

    def disable_gradient_checkpointing(self) -> None:
        """Disable gradient checkpointing (faster but more memory)."""
        self.gradient_checkpointing = False

    def forward(
        self,
        x: torch.Tensor,
        t_emb: torch.Tensor,
        condition: torch.Tensor,
        grid_t: int,
        grid_h: int,
        grid_w: int,
        rope_grids: Optional[Tuple[torch.Tensor, torch.Tensor, torch.Tensor]] = None,
        audio_bridge_input: Optional[torch.Tensor] = None,
        bridge_layer_indices: Optional[List[int]] = None,
    ) -> Tuple[torch.Tensor, Dict[int, torch.Tensor]]:
        """
        Forward pass through all DiT blocks with optional bridge exchange.

        Args:
            x: Visual latent tokens.       Shape: (B, N_vis, D_vis)
            t_emb: Timestep embedding.      Shape: (B, D_vis)
            condition: Conditioning tokens.  Shape: (B, N_cond, D_cond)
            grid_t: Number of temporal positions in the visual token grid.
            grid_h: Number of height positions.
            grid_w: Number of width positions.
            rope_grids: Optional (grid_t_idx, grid_h_idx, grid_w_idx) for RoPE3D.
                        Each of shape (N_vis,).
            audio_bridge_input: Audio tokens for bridge exchange (unused here,
                                bridge is applied externally in HydraDiT).
                                Shape: (B, N_aud, D_aud) or None.
            bridge_layer_indices: List of block indices where bridge exchange
                                  should occur. Used to collect intermediate tokens.

        Returns:
            x: Output visual tokens.  Shape: (B, N_vis, D_vis)
            bridge_outputs: Dict mapping bridge block index → intermediate visual
                           tokens at that layer.  Shape per entry: (B, N_vis, D_vis)
        """
        bridge_layer_indices = bridge_layer_indices or []
        bridge_outputs: Dict[int, torch.Tensor] = {}

        # Project conditioning to hidden_dim
        condition = self.cond_proj(condition)  # (B, N_cond, D_vis)

        for idx, block in enumerate(self.blocks):
            if self.training and self.gradient_checkpointing:
                # Gradient checkpointing: recompute activations during backward
                # to save memory at the cost of ~33% more compute
                x = checkpoint(
                    self._block_forward,
                    block, x, t_emb, condition, grid_t, grid_h, grid_w, rope_grids,
                    use_reentrant=False,
                )
            else:
                x = block(x, t_emb, condition, grid_t, grid_h, grid_w, rope_grids)

            # Collect tokens at bridge indices for cross-branch exchange
            if idx in bridge_layer_indices:
                bridge_outputs[idx] = x

        return x, bridge_outputs

    @staticmethod
    def _block_forward(
        block: DiTBlock,
        x: torch.Tensor,
        t_emb: torch.Tensor,
        condition: torch.Tensor,
        grid_t: int,
        grid_h: int,
        grid_w: int,
        rope_grids: Optional[Tuple[torch.Tensor, torch.Tensor, torch.Tensor]],
    ) -> torch.Tensor:
        """
        Static method for gradient checkpointing compatibility.

        torch.utils.checkpoint requires a function (not a bound method)
        to properly handle the compute graph.
        """
        return block(x, t_emb, condition, grid_t, grid_h, grid_w, rope_grids)
