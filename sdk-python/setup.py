from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="agentcache",
    version="0.2.0",
    author="AgentCache.ai",
    author_email="support@agentcache.ai",
    description="Official Python client for AgentCache.ai - Reduce LLM costs by 90%",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/xinetex/agentcache.ai",
    project_urls={
        "Bug Tracker": "https://github.com/xinetex/agentcache.ai/issues",
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    package_dir={"": "."},
    packages=find_packages(where="."),
    python_requires=">=3.7",
    install_requires=[
        "requests>=2.25.0",
    ],
)
