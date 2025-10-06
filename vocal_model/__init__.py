# vocal_model/__init__.py
"""
Vocal Model Package
-------------------

This package provides a clean and reusable interface for the Mel-Band RoFormer
vocal separation model.

To use it as a library:
from vocal_model import VocalSeparator

# Initialize the separator
separator = VocalSeparator(model_path="path/to/your/model.safetensors")

# Separate a single file
separator.separate_file("path/to/input.wav", "path/to/output_vocals.wav")
"""

from .separator import VocalSeparator

__all__ = ["VocalSeparator"]
