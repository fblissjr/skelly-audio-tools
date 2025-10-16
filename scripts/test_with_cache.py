"""
Test vocal separation optimization using cached audio files.

This script tests the new ONNX/quantized backends using audio files
already in your backend/.cache/ directory, so you don't need to download anything.

Usage:
    python scripts/test_with_cache.py
    python scripts/test_with_cache.py --backend onnx
    python scripts/test_with_cache.py --all
"""
import argparse
import os
import sys
import time
from pathlib import Path
from typing import Dict, List

# Setup imports
script_dir = Path(__file__).parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

try:
    from backend.separator import VocalSeparator
    import soundfile as sf
except ImportError as e:
    print(f"ERROR: Missing dependencies: {e}")
    print("Make sure you're in the activated virtual environment")
    sys.exit(1)


def find_cached_files():
    """Find all cached audio files."""
    cache_dir = project_root / "backend" / ".cache"
    if not cache_dir.exists():
        print(f"ERROR: Cache directory not found: {cache_dir}")
        return []

    files = list(cache_dir.glob("*.mp3")) + list(cache_dir.glob("*.m4a"))
    return sorted(files)


def get_audio_info(audio_path: Path) -> Dict:
    """Get basic info about an audio file."""
    try:
        info = sf.info(str(audio_path))
        return {
            "duration": info.duration,
            "sample_rate": info.samplerate,
            "channels": info.channels,
            "size_mb": audio_path.stat().st_size / (1024 * 1024)
        }
    except Exception as e:
        return {"error": str(e)}


def test_backend(
    backend_name: str,
    audio_path: Path,
    backend_config: Dict
) -> Dict:
    """Test a specific backend with cached audio."""
    print("\n" + "=" * 70)
    print(f"Testing: {backend_name}")
    print(f"File: {audio_path.name}")
    print("=" * 70)

    # Get audio info
    audio_info = get_audio_info(audio_path)
    if "error" in audio_info:
        print(f"ERROR reading audio: {audio_info['error']}")
        return {"success": False, "error": audio_info["error"]}

    print(f"Duration: {audio_info['duration']:.1f}s")
    print(f"Size: {audio_info['size_mb']:.1f} MB")
    print(f"Sample rate: {audio_info['sample_rate']} Hz")
    print()

    try:
        # Initialize separator
        print("Initializing separator...")
        init_start = time.time()
        separator = VocalSeparator(**backend_config)
        init_time = time.time() - init_start

        print(f"✓ Initialized in {init_time:.2f}s")
        print(f"Backend type: {separator.backend_type}")
        print()

        # Process audio
        print("Processing audio...")
        process_start = time.time()
        vocals_path, inst_path, sr = separator.separate(str(audio_path))
        process_time = time.time() - process_start

        # Calculate metrics
        real_time_factor = audio_info['duration'] / process_time

        print()
        print("✓ Processing complete!")
        print(f"  Time: {process_time:.2f}s")
        print(f"  Real-time factor: {real_time_factor:.2f}x")
        print(f"  Vocals: {Path(vocals_path).stat().st_size / (1024*1024):.1f} MB")
        print(f"  Instrumental: {Path(inst_path).stat().st_size / (1024*1024):.1f} MB")

        # Cleanup
        os.unlink(vocals_path)
        os.unlink(inst_path)

        return {
            "success": True,
            "backend_name": backend_name,
            "backend_type": separator.backend_type,
            "audio_duration": audio_info['duration'],
            "init_time": init_time,
            "process_time": process_time,
            "real_time_factor": real_time_factor
        }

    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "backend_name": backend_name,
            "error": str(e)
        }


def print_results_table(results: List[Dict]):
    """Print comparison table of results."""
    if not results:
        return

    successful = [r for r in results if r.get('success')]
    if not successful:
        print("\nNo successful tests to compare.")
        return

    print("\n" + "=" * 90)
    print("RESULTS SUMMARY")
    print("=" * 90)
    print(f"{'Backend':<30} {'Init (s)':<12} {'Process (s)':<12} {'RTF':<10} {'Speedup':<10}")
    print("-" * 90)

    baseline = successful[0]['process_time']
    for result in successful:
        speedup = baseline / result['process_time']
        print(
            f"{result['backend_name']:<30} "
            f"{result['init_time']:<12.2f} "
            f"{result['process_time']:<12.2f} "
            f"{result['real_time_factor']:<10.2f} "
            f"{speedup:<10.2f}x"
        )

    print("=" * 90)
    print(f"Audio duration: {successful[0]['audio_duration']:.1f}s")
    print(f"Baseline: {successful[0]['backend_name']}")
    print(f"Best: {min(successful, key=lambda x: x['process_time'])['backend_name']}")
    print("=" * 90)


def main():
    parser = argparse.ArgumentParser(
        description="Test vocal separation with cached audio files"
    )
    parser.add_argument(
        "--backend",
        type=str,
        choices=["pytorch", "onnx", "onnx-quantized", "all"],
        default="onnx",
        help="Backend to test (default: onnx)"
    )
    parser.add_argument(
        "--file",
        type=str,
        help="Specific cached file to test (filename only)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Test all backends (same as --backend all)"
    )

    args = parser.parse_args()

    # Find cached files
    print("Scanning for cached audio files...")
    cached_files = find_cached_files()

    if not cached_files:
        print("\nNo cached audio files found in backend/.cache/")
        print("Please download some audio first or use the frontend to fetch from YouTube.")
        return

    print(f"\nFound {len(cached_files)} cached file(s):")
    for i, f in enumerate(cached_files, 1):
        info = get_audio_info(f)
        print(f"  {i}. {f.name} ({info.get('duration', 0):.1f}s, {info.get('size_mb', 0):.1f} MB)")

    # Select file to test
    if args.file:
        test_file = project_root / "backend" / ".cache" / args.file
        if not test_file.exists():
            print(f"\nERROR: File not found: {args.file}")
            return
        test_files = [test_file]
    else:
        # Use first file by default
        test_files = [cached_files[0]]
        print(f"\nUsing: {test_files[0].name}")
        print("(Use --file to specify a different file)")

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
        }
    }

    # Determine which backends to test
    if args.all or args.backend == "all":
        backends_to_test = ["pytorch", "onnx", "onnx-quantized"]
    else:
        backends_to_test = [args.backend]

    # Run tests
    results = []
    for audio_file in test_files:
        for backend_key in backends_to_test:
            if backend_key not in backend_configs:
                continue

            backend = backend_configs[backend_key]
            result = test_backend(
                backend["name"],
                audio_file,
                backend["config"]
            )
            results.append(result)

    # Print summary
    print_results_table(results)

    # Recommendations
    print("\n" + "=" * 90)
    print("RECOMMENDATIONS")
    print("=" * 90)

    successful = [r for r in results if r.get('success')]
    if len(successful) > 1:
        best = min(successful, key=lambda x: x['process_time'])
        baseline = successful[0]
        speedup = baseline['process_time'] / best['process_time']

        print(f"Best backend: {best['backend_name']}")
        print(f"Processing time: {best['process_time']:.2f}s")
        print(f"Speedup: {speedup:.2f}x faster than baseline")
        print()

        if best['backend_type'] == 'onnx':
            print("To use ONNX in production:")
            print("  cd backend")
            print("  USE_ONNX=1 uvicorn main:app --host 127.0.0.1 --port 8000")
        elif best['backend_type'] == 'pytorch':
            print("Note: PyTorch was fastest (ONNX may not be properly set up)")
            print("Run: ./scripts/setup_optimization.sh")

    print("=" * 90)


if __name__ == "__main__":
    main()
