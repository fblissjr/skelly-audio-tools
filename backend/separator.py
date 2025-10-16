"""
Backend vocal separator - wraps the vocal_model package for FastAPI integration.

Supports multiple inference backends:
- ONNX Runtime (2-5x faster on CPU, recommended)
- PyTorch CPU (fallback)
- Remote CUDA server (optional)
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

# Try to import ONNX separator first (faster)
try:
    from vocal_model.separator_onnx import ONNXVocalSeparator
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False

from vocal_model.separator import VocalSeparator as VocalModelSeparator

# Try to import remote CUDA separator
try:
    from separator_remote import RemoteCUDAVocalSeparator
    REMOTE_CUDA_AVAILABLE = True
except ImportError:
    REMOTE_CUDA_AVAILABLE = False


class VocalSeparator:
    """Wrapper around vocal_model separator with multiple backend options."""

    def __init__(
        self,
        model_path: str = None,
        config_path: str = None,
        quantized: bool = False,
        use_onnx: bool = True,
        num_threads: int = None,
        remote_cuda_url: str = None
    ):
        """
        Initialize the vocal separator with optimizations.

        Args:
            model_path: Path to model file (.safetensors for PyTorch, .onnx for ONNX).
            config_path: Path to config file. Auto-detects if None.
            quantized: Use quantized model (faster, slightly lower quality).
            use_onnx: Prefer ONNX Runtime if available (2-5x faster).
            num_threads: CPU threads to use. Auto-detects if None.
            remote_cuda_url: URL of remote CUDA server (e.g., http://gpu-server:8001).
        """
        self.backend_type = "unknown"

        # Try remote CUDA first if URL provided
        if remote_cuda_url and REMOTE_CUDA_AVAILABLE:
            try:
                print(f"Attempting remote CUDA server: {remote_cuda_url}")
                self.separator = RemoteCUDAVocalSeparator(remote_cuda_url)
                self.backend_type = "remote-cuda"
                print("Remote CUDA separator configured successfully!")
                print("Expected speedup: 5-10x faster than CPU")
                return
            except Exception as e:
                print(f"Remote CUDA initialization failed: {e}")
                print("Falling back to local processing...")

        # Optimize PyTorch for CPU inference
        if num_threads is None:
            num_threads = os.cpu_count()

        torch.set_num_threads(num_threads)
        torch.set_num_interop_threads(num_threads)

        # Try ONNX first if requested and available
        if use_onnx and ONNX_AVAILABLE:
            try:
                print(f"Attempting ONNX Runtime (quantized={quantized}, threads={num_threads})...")
                self.separator = ONNXVocalSeparator(
                    onnx_model_path=model_path if model_path and model_path.endswith('.onnx') else None,
                    config_path=config_path,
                    use_quantized=quantized,
                    num_threads=num_threads
                )
                self.backend_type = "onnx"
                print("ONNX Runtime vocal separator loaded successfully!")
                print("Expected speedup: 2-5x faster than PyTorch CPU")
                return
            except (FileNotFoundError, Exception) as e:
                print(f"ONNX initialization failed: {e}")
                print("Falling back to PyTorch CPU...")

        # Fallback to PyTorch
        if model_path is None or not model_path.endswith('.safetensors'):
            # Default to Tommy's Mel-Band RoFormer
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

        print(f"Loading PyTorch vocal separator (threads={num_threads})...")
        self.separator = VocalModelSeparator(
            model_path=str(model_path),
            config_path=str(config_path),
            device="cpu"
        )
        self.backend_type = "pytorch"
        print("PyTorch vocal separator loaded successfully!")

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
