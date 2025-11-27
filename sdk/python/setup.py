"""
AgentCache Python SDK
~~~~~~~~~~~~~~~~~~~~~

Python client library for AgentCache.ai - Cognitive Caching for AI Agents.

:copyright: (c) 2025 AgentCache
:license: MIT
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="agentcache",
    version="0.1.0",
    author="AgentCache Team",
    author_email="support@agentcache.ai",
    description="Python SDK for AgentCache.ai cognitive caching platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/agentcache/python-sdk",
    project_urls={
        "Bug Tracker": "https://github.com/agentcache/python-sdk/issues",
        "Documentation": "https://docs.agentcache.ai",
        "Source Code": "https://github.com/agentcache/python-sdk",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.8",
    install_requires=[
        "httpx>=0.25.0",
        "pydantic>=2.0.0",
        "typing-extensions>=4.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
            "ruff>=0.1.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "agentcache=agentcache.cli:main",
        ],
    },
)
