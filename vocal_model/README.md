# README: Vocal Separation Model (`vocal_model`)
## 1. Project High-Level Summary

- **Name:** `vocal_model`
- **Purpose:** A self-contained Python package for separating vocals from instrumental tracks in an audio file.
- **Core Technology:** It wraps the Mel-Band RoFormer model designed for music source separation.
- **Primary Functionality:**
    1.  Loads a pre-trained Mel-Band RoFormer model from a `.safetensors` file.
    2.  Provides a high-level Python class (`VocalSeparator`) for easy integration into other applications.
    3.  Offers a command-line interface (CLI) for direct audio file processing.
    4.  Handles audio pre-processing (resampling, stereo conversion) and post-processing (overlap-add chunking) to produce high-quality output.

## 2. Project Structure and File Manifest

The `vocal_model` directory is structured as a standard Python package.

```text
vocal_model/
├── __init__.py                # Makes the directory a Python package and exposes the main class.
├── separator.py               # Main entry point: Contains the VocalSeparator class and CLI logic.
├── config.yaml                # The model's architectural and inference blueprint (dim=320, depth=12).
├── mel_band_roformer.py       # Defines the core MelBandRoformer neural network architecture.
├── attend.py                  # A dependency for the model, defining the attention mechanism.
├── requirements.txt           # A list of all necessary Python dependencies.
└── melband_roformer_vocals.safetensors # Pre-trained model weights (this is data, not code).
```

### File Descriptions:

- **`separator.py`**: This is the most important file. It contains the primary `VocalSeparator` class, which is the main API for this package. It also includes the `main()` function that implements the command-line interface. The core logic for loading audio, chunking it, running inference, and saving the output is here.
- **`config.yaml`**: This YAML file contains the exact parameters required to instantiate the `MelBandRoformer` model architecture. It is critical because the parameters (`dim: 320`, `depth: 12`, etc.) must match the architecture of the pre-trained weights in `melband_roformer_vocals.safetensors`. It also contains inference settings like `chunk_size` and `num_overlap`.
- **`mel_band_roformer.py`**: This file defines the `MelBandRoformer` class, which is a `torch.nn.Module`. It builds the neural network layer by layer based on the parameters passed during instantiation (which come from `config.yaml`).
- **`attend.py`**: A helper module that implements the flash attention mechanism used by the Transformer blocks in `mel_band_roformer.py`.
- **`__init__.py`**: Exposes the `VocalSeparator` class at the package level, allowing for clean imports like `from vocal_model import VocalSeparator`.
- **`requirements.txt`**: Specifies all pip-installable dependencies.

## 3. Dependencies

The following Python libraries are required. They are listed in `requirements.txt`.

- `torch`
- `numpy`
- `soundfile`
- `librosa`
- `tqdm`
- `pyyaml`
- `omegaconf`
- `safetensors`
- `einops`
- `beartype`
- `rotary_embedding_torch`

**Installation Command:**
```bash
uv pip install -r vocal_model/requirements.txt
```

## 4. Usage Patterns

This package is designed to be used in two primary ways: as a command-line tool or as a Python library.

### A. Command-Line Interface (CLI) Usage

The primary entry point for CLI usage is `separator.py`.

**Syntax:**
```bash
python vocal_model/separator.py --model_path <path_to_model> --input <input_path> --output_dir <output_directory>
```

- `--model_path`: **Required.** Path to the `.safetensors` model weights file (e.g., `vocal_model/melband_roformer_vocals.safetensors`).
- `--input`: **Required.** Can be a path to a single audio file (e.g., `my_song.mp3`) or a path to a folder containing multiple audio files.
- `--output_dir`: **Optional.** Directory where the output files (`_vocals.wav` and `_instrumental.wav`) will be saved. Defaults to the current directory (`.`).

**Example 1: Processing a single file**
```bash
python vocal_model/separator.py --model_path vocal_model/melband_roformer_vocals.safetensors --input /path/to/my_song.mp3 --output_dir ./audio_results
```

**Example 2: Processing a folder of songs**
```bash
python vocal_model/separator.py --model_path vocal_model/melband_roformer_vocals.safetensors --input /path/to/songs_folder --output_dir ./audio_results
```

### B. Library Usage (Programmatic API)

The package is designed to be imported into other Python applications. The main API is the `VocalSeparator` class.

**Core Class:** `vocal_model.separator.VocalSeparator`

**Initialization:**
```python
from vocal_model import VocalSeparator

# The constructor loads the model and prepares it for inference.
# This should be done once.
separator = VocalSeparator(
    model_path="vocal_model/melband_roformer_vocals.safetensors",
    config_path="vocal_model/config.yaml"  # This is optional, it will be found automatically
)
```

**Primary Method:** `separator.separate_file()`
This method handles loading, resampling, processing, and saving.

**Example:**
```python
from vocal_model import VocalSeparator

# 1. Initialize the separator
# This is a one-time setup cost as it loads the model into memory.
print("Initializing the vocal separator...")
separator = VocalSeparator(model_path="vocal_model/melband_roformer_vocals.safetensors")

# 2. Use the separator to process an audio file
input_audio = "path/to/my_song.mp3"
output_vocals = "path/to/my_song_vocals.wav"
output_instrumental = "path/to/my_song_instrumental.wav"

print(f"Starting separation for {input_audio}...")
separator.separate_file(
    input_path=input_audio,
    output_vocals_path=output_vocals,
    output_inst_path=output_instrumental
)
print("Separation complete.")
