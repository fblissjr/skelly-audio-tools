"""
Remote CUDA backend support for vocal separation.

This allows offloading vocal separation to a remote GPU server for maximum performance.
Useful when running the main backend on a low-power CPU server but have access to a CUDA box.

Usage:
1. On the CUDA server, run: python separator_remote.py --server --port 8001
2. On the main backend, set: REMOTE_CUDA_URL=http://cuda-server:8001
"""
import os
import sys
import tempfile
import argparse
from pathlib import Path
from typing import Tuple

# Setup imports
backend_dir = Path(__file__).parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

# Try to import components
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

try:
    from fastapi import FastAPI, File, UploadFile
    from fastapi.responses import FileResponse
    import uvicorn
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False


class RemoteCUDAVocalSeparator:
    """
    Client for remote CUDA-accelerated vocal separation.
    Sends audio to a remote server with GPU acceleration.
    """

    def __init__(self, remote_url: str, timeout: int = 600):
        """
        Initialize remote CUDA separator client.

        Args:
            remote_url: URL of the remote CUDA server (e.g., http://gpu-server:8001)
            timeout: Request timeout in seconds (default: 10 minutes)
        """
        if not HTTPX_AVAILABLE:
            raise ImportError("httpx required for remote separation. Install with: pip install httpx")

        self.remote_url = remote_url.rstrip('/')
        self.timeout = timeout
        self.backend_type = "remote-cuda"

        print(f"Remote CUDA separator configured: {self.remote_url}")
        print(f"Timeout: {self.timeout}s")

    def separate(self, audio_path: str) -> Tuple[str, str, int]:
        """
        Separates an audio file using remote CUDA server.

        Args:
            audio_path: Path to the input audio file

        Returns:
            (vocals_path, instrumental_path, sample_rate)
        """
        print(f"Sending to remote CUDA server: {audio_path}")

        with open(audio_path, 'rb') as f:
            files = {'file': (os.path.basename(audio_path), f, 'audio/mpeg')}

            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    f"{self.remote_url}/separate-vocals-cuda",
                    files=files
                )

        if response.status_code != 200:
            raise Exception(f"Remote separation failed: {response.text}")

        # Response contains vocals and instrumental paths
        result = response.json()

        # Download the separated files
        vocals_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        instrumental_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name

        with httpx.Client() as client:
            # Download vocals
            vocals_response = client.get(f"{self.remote_url}{result['vocals_url']}")
            with open(vocals_path, 'wb') as f:
                f.write(vocals_response.content)

            # Download instrumental
            inst_response = client.get(f"{self.remote_url}{result['instrumental_url']}")
            with open(instrumental_path, 'wb') as f:
                f.write(inst_response.content)

        sample_rate = result.get('sample_rate', 44100)
        print(f"Remote separation complete (sample_rate={sample_rate} Hz)")

        return vocals_path, instrumental_path, sample_rate


# Remote CUDA Server Implementation
if FASTAPI_AVAILABLE:
    cuda_app = FastAPI(title="CUDA Vocal Separator Server")

    # Global separator instance
    cuda_separator = None

    @cuda_app.on_event("startup")
    async def startup():
        """Initialize CUDA separator on startup."""
        global cuda_separator
        from vocal_model.separator import VocalSeparator

        print("Initializing CUDA vocal separator...")
        cuda_separator = VocalSeparator(
            device="cuda"  # Force CUDA
        )
        print("CUDA separator ready!")

    @cuda_app.post("/separate-vocals-cuda")
    async def separate_vocals_cuda(file: UploadFile = File(...)):
        """
        CUDA-accelerated vocal separation endpoint.

        Processes audio on GPU and returns file URLs.
        """
        if not cuda_separator:
            return {"error": "Separator not initialized"}, 503

        # Save uploaded file
        temp_input = tempfile.NamedTemporaryFile(suffix=os.path.splitext(file.filename)[1], delete=False)
        content = await file.read()
        temp_input.write(content)
        temp_input.close()

        try:
            # Separate on GPU
            vocals_path, instrumental_path, sr = cuda_separator.separate(temp_input.name)

            return {
                "vocals_url": f"/download/{os.path.basename(vocals_path)}",
                "instrumental_url": f"/download/{os.path.basename(instrumental_path)}",
                "sample_rate": sr
            }
        finally:
            os.unlink(temp_input.name)

    @cuda_app.get("/download/{filename}")
    async def download_file(filename: str):
        """Download separated audio file."""
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, filename)

        if not os.path.exists(file_path):
            return {"error": "File not found"}, 404

        return FileResponse(file_path, media_type='audio/wav')

    def run_cuda_server(host: str = "0.0.0.0", port: int = 8001):
        """Run the CUDA separation server."""
        print(f"Starting CUDA vocal separator server on {host}:{port}")
        uvicorn.run(cuda_app, host=host, port=port)


def main():
    parser = argparse.ArgumentParser(
        description="Remote CUDA vocal separator"
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Run as CUDA server"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Server host (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Server port (default: 8001)"
    )
    parser.add_argument(
        "--test",
        type=str,
        help="Test remote separation with audio file"
    )
    parser.add_argument(
        "--remote_url",
        type=str,
        default="http://localhost:8001",
        help="Remote server URL for testing"
    )

    args = parser.parse_args()

    if args.server:
        if not FASTAPI_AVAILABLE:
            print("ERROR: FastAPI not available. Install with: pip install fastapi uvicorn")
            sys.exit(1)
        run_cuda_server(args.host, args.port)
    elif args.test:
        client = RemoteCUDAVocalSeparator(args.remote_url)
        vocals, inst, sr = client.separate(args.test)
        print(f"Vocals: {vocals}")
        print(f"Instrumental: {inst}")
        print(f"Sample rate: {sr} Hz")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
