"""
Performance benchmarking script for vocal separation backends.

Compares performance of:
- PyTorch CPU (baseline)
- ONNX Runtime
- ONNX Runtime with INT8 quantization
- Remote CUDA (if configured)

Usage:
    python benchmark_separator.py --audio test_audio.mp3 --duration 60
"""
import argparse
import os
import sys
import time
import tempfile
from pathlib import Path
from typing import Dict, List

# Setup imports
script_dir = Path(__file__).parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root))

try:
    from backend.separator import VocalSeparator
    import soundfile as sf
    import numpy as np
except ImportError as e:
    print(f"ERROR: Missing dependencies: {e}")
    print("Make sure you're in the activated virtual environment")
    sys.exit(1)


def generate_test_audio(duration_seconds: int = 30, sample_rate: int = 44100) -> str:
    """
    Generate synthetic test audio for benchmarking.

    Args:
        duration_seconds: Length of audio in seconds
        sample_rate: Sample rate (Hz)

    Returns:
        Path to temporary audio file
    """
    print(f"Generating {duration_seconds}s test audio...")
    num_samples = duration_seconds * sample_rate

    # Generate stereo pink noise (more realistic than white noise)
    audio = np.random.randn(2, num_samples).astype(np.float32) * 0.1

    # Save to temp file
    temp_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    sf.write(temp_path, audio.T, sample_rate)

    print(f"Test audio saved to: {temp_path}")
    return temp_path


def benchmark_backend(
    backend_name: str,
    audio_path: str,
    backend_config: Dict
) -> Dict:
    """
    Benchmark a specific backend configuration.

    Args:
        backend_name: Human-readable name for the backend
        audio_path: Path to test audio
        backend_config: Configuration dict for VocalSeparator

    Returns:
        Dict with timing results and metadata
    """
    print("\n" + "=" * 60)
    print(f"Benchmarking: {backend_name}")
    print("=" * 60)

    try:
        # Initialize separator
        init_start = time.time()
        separator = VocalSeparator(**backend_config)
        init_time = time.time() - init_start

        print(f"Initialization time: {init_time:.2f}s")
        print(f"Backend type: {separator.backend_type}")

        # Warm-up run (helps stabilize timing)
        print("Warming up...")
        separator.separate(audio_path)

        # Actual benchmark run
        print("Running benchmark...")
        start_time = time.time()
        vocals_path, inst_path, sr = separator.separate(audio_path)
        processing_time = time.time() - start_time

        # Get audio duration
        audio_data, _ = sf.read(audio_path)
        audio_duration = len(audio_data) / sr

        # Calculate metrics
        real_time_factor = audio_duration / processing_time

        result = {
            "backend_name": backend_name,
            "backend_type": separator.backend_type,
            "init_time": init_time,
            "processing_time": processing_time,
            "audio_duration": audio_duration,
            "real_time_factor": real_time_factor,
            "success": True,
            "error": None
        }

        print(f"\n✓ Processing time: {processing_time:.2f}s")
        print(f"✓ Audio duration: {audio_duration:.2f}s")
        print(f"✓ Real-time factor: {real_time_factor:.2f}x")

        # Cleanup
        os.unlink(vocals_path)
        os.unlink(inst_path)

        return result

    except Exception as e:
        print(f"\n✗ Benchmark failed: {e}")
        return {
            "backend_name": backend_name,
            "backend_type": "unknown",
            "init_time": 0,
            "processing_time": 0,
            "audio_duration": 0,
            "real_time_factor": 0,
            "success": False,
            "error": str(e)
        }


def print_results_table(results: List[Dict]):
    """Print benchmark results in a formatted table."""
    print("\n" + "=" * 80)
    print("BENCHMARK RESULTS")
    print("=" * 80)

    # Header
    print(f"{'Backend':<30} {'Init':<10} {'Process':<10} {'RTF':<10} {'Status':<10}")
    print("-" * 80)

    # Results
    baseline_time = None
    for result in results:
        if result['success']:
            status = "✓ OK"
            speedup = ""
            if baseline_time is None:
                baseline_time = result['processing_time']
            else:
                speedup = f" ({baseline_time/result['processing_time']:.1f}x faster)"

            print(
                f"{result['backend_name']:<30} "
                f"{result['init_time']:<10.2f} "
                f"{result['processing_time']:<10.2f} "
                f"{result['real_time_factor']:<10.2f} "
                f"{status:<10}{speedup}"
            )
        else:
            print(
                f"{result['backend_name']:<30} "
                f"{'N/A':<10} "
                f"{'N/A':<10} "
                f"{'N/A':<10} "
                f"✗ FAIL"
            )

    print("=" * 80)
    print("Legend:")
    print("  Init: Initialization time (seconds)")
    print("  Process: Audio processing time (seconds)")
    print("  RTF: Real-time factor (higher is better, >1.0 means faster than real-time)")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark vocal separation performance"
    )
    parser.add_argument(
        "--audio",
        type=str,
        help="Path to audio file for testing (generates synthetic if not provided)"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=30,
        help="Duration of synthetic audio in seconds (default: 30)"
    )
    parser.add_argument(
        "--backends",
        type=str,
        nargs="+",
        default=["pytorch", "onnx", "onnx-quantized"],
        choices=["pytorch", "onnx", "onnx-quantized", "remote-cuda"],
        help="Backends to benchmark (default: all available)"
    )
    parser.add_argument(
        "--remote_cuda_url",
        type=str,
        default=os.getenv("REMOTE_CUDA_URL"),
        help="URL of remote CUDA server"
    )

    args = parser.parse_args()

    # Get or generate test audio
    if args.audio and os.path.exists(args.audio):
        audio_path = args.audio
        print(f"Using provided audio: {audio_path}")
    else:
        audio_path = generate_test_audio(args.duration)

    # Define backend configurations
    backend_configs = {
        "pytorch": {
            "name": "PyTorch CPU (baseline)",
            "config": {"use_onnx": False, "quantized": False}
        },
        "onnx": {
            "name": "ONNX Runtime",
            "config": {"use_onnx": True, "quantized": False}
        },
        "onnx-quantized": {
            "name": "ONNX Runtime + INT8 Quantized",
            "config": {"use_onnx": True, "quantized": True}
        },
        "remote-cuda": {
            "name": f"Remote CUDA ({args.remote_cuda_url})",
            "config": {"remote_cuda_url": args.remote_cuda_url}
        }
    }

    # Run benchmarks
    results = []
    for backend_key in args.backends:
        if backend_key not in backend_configs:
            print(f"Skipping unknown backend: {backend_key}")
            continue

        backend = backend_configs[backend_key]
        result = benchmark_backend(
            backend["name"],
            audio_path,
            backend["config"]
        )
        results.append(result)

    # Print results
    print_results_table(results)

    # Cleanup if we generated synthetic audio
    if not args.audio:
        os.unlink(audio_path)


if __name__ == "__main__":
    main()
