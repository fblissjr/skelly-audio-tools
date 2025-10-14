"""
Backend vocal separator - wraps the vocal_model package for FastAPI integration.
"""
import sys
import os
import tempfile
import torch
import soundfile as sf
from pathlib import Path

# Add the parent directory to the path so we can import vocal_model
backend_dir = Path(__file__).parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

from vocal_model.separator import VocalSeparator as VocalModelSeparator

class VocalSeparator:
    """Wrapper around vocal_model.VocalSeparator for backend use."""

    def __init__(self, model_path: str = None, config_path: str = None, quantized: bool = False):
        """
        Initialize the vocal separator.

        Args:
            model_path: Path to the safetensors model file. If None, uses BS-Roformer by default.
            config_path: Path to config file. If None, auto-detects based on model.
            quantized: Whether to use the quantized model (faster on CPU).
        """
        if model_path is None:
            # Default to Tommy's Mel-Band RoFormer (12 layers, better quality)
            model_path = project_root / "vocal_model" / "model_vocals_tommy.safetensors"

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model not found at {model_path}. "
                f"Please ensure the model file exists."
            )

        # Auto-detect config if not provided
        if config_path is None:
            model_name = os.path.basename(model_path)
            if 'bs_roformer' in model_name.lower():
                config_path = project_root / "vocal_model" / "config_bs_roformer.yaml"
            elif 'tommy' in model_name.lower():
                config_path = project_root / "vocal_model" / "config_vocals_tommy.yaml"
            else:
                config_path = project_root / "vocal_model" / "config.yaml"

        print(f"Loading vocal separator (quantized={quantized})...")
        self.separator = VocalModelSeparator(
            model_path=str(model_path),
            config_path=str(config_path),
            device="cpu"  # Force CPU for backend deployment
        )
        print("Vocal separator loaded successfully!")

    def separate(self, audio_path: str) -> tuple[str, str, int]:
        """
        Separates an audio file into vocals and instrumentals.

        Args:
            audio_path: Path to the input audio file

        Returns:
            (vocals_path, instrumental_path, sample_rate)
            The returned paths are temporary files that should be cleaned up by the caller.
        """
        print(f"Processing: {audio_path}")

        # Load audio
        wav, sr = sf.read(audio_path)

        # soundfile returns [samples, channels], we need [channels, samples]
        if wav.ndim == 2:
            wav = wav.T  # Transpose to [channels, samples]

        original_tensor = torch.from_numpy(wav).float()

        # Ensure stereo
        if original_tensor.dim() == 1:
            original_tensor = original_tensor.unsqueeze(0).repeat(2, 1)
        elif original_tensor.shape[0] == 1:
            original_tensor = original_tensor.repeat(2, 1)

        # Resample if needed
        target_sr = self.separator.config.model.sample_rate
        if sr != target_sr:
            print(f"Resampling from {sr} Hz to {target_sr} Hz...")
            import librosa
            resampled = librosa.resample(
                original_tensor.numpy(),
                orig_sr=sr,
                target_sr=target_sr
            )
            original_tensor = torch.from_numpy(resampled).float()

        # Separate vocals
        vocals_tensor = self.separator.separate(original_tensor.to(self.separator.device))

        # Calculate instrumental
        instrumental_tensor = original_tensor - vocals_tensor.cpu()

        # Save to temporary files
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as vocal_file:
            vocals_path = vocal_file.name
            sf.write(vocals_path, vocals_tensor.cpu().numpy().T, target_sr)

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as inst_file:
            instrumental_path = inst_file.name
            sf.write(instrumental_path, instrumental_tensor.numpy().T, target_sr)

        return vocals_path, instrumental_path, target_sr
