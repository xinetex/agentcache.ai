from setuptools import setup, find_packages

setup(
    name="hydra-video",
    version="0.1.0",
    description="Project Hydra: A Seedance 2.0-class video generation engine",
    author="AgentCache AI",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "torch>=2.1.0",
        "torchvision>=0.16.0",
        "torchaudio>=2.1.0",
        "einops>=0.7.0",
        "transformers>=4.36.0",
        "omegaconf>=2.3.0",
        "pyyaml>=6.0",
        "tqdm>=4.66.0",
        "numpy>=1.24.0",
        "pillow>=10.0.0",
        "safetensors>=0.4.0",
    ],
    extras_require={
        "training": [
            "accelerate>=0.25.0",
            "wandb>=0.16.0",
            "tensorboard>=2.15.0",
            "webdataset>=0.2.48",
            "decord>=0.6.0",
        ],
        "audio": [
            "librosa>=0.10.1",
            "soundfile>=0.12.1",
        ],
        "flash": [
            "flash-attn>=2.3.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "hydra-generate=hydra.pipeline.text_to_video:main",
        ],
    },
)
