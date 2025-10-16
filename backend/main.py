from fastapi import FastAPI, HTTPException, File, UploadFile, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import yt_dlp
import httpx
from urllib.parse import quote
import os
import tempfile
import zipfile
from separator import VocalSeparator
import logging
from datetime import datetime
import sys
import uuid
import threading
from typing import Dict, Optional

# Configure logging
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / f"backend_{datetime.now().strftime('%Y%m%d')}.log"

# Configure logging to both file and console
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BOB the Skelly - Backend API",
    version="2.0",
    description="Provides endpoints for fetching YouTube audio and performing vocal separation."
)

# Job tracking system
class JobInfo:
    def __init__(self, job_id: str, job_type: str, filename: str):
        self.job_id = job_id
        self.job_type = job_type  # 'youtube' or 'vocal_separation'
        self.filename = filename
        self.status = 'running'  # 'running', 'completed', 'failed', 'cancelled'
        self.progress = 0
        self.error_message: Optional[str] = None
        self.created_at = datetime.now()
        self.cancel_event = threading.Event()
        self.thread: Optional[threading.Thread] = None

    def cancel(self):
        """Signal the job to cancel."""
        self.cancel_event.set()
        self.status = 'cancelled'

    def is_cancelled(self) -> bool:
        """Check if cancellation was requested."""
        return self.cancel_event.is_set()

# Global job registry
active_jobs: Dict[str, JobInfo] = {}

# Initialize the separator on startup
# Environment variables for optimization:
# - REMOTE_CUDA_URL: URL of remote CUDA server (e.g., http://gpu-server:8001) - highest priority
# - USE_ONNX=1: Use ONNX Runtime (2-5x faster, recommended for local CPU)
# - QUANTIZED=1: Use INT8 quantized model (faster, slightly lower quality)
# - CPU_THREADS=N: Number of CPU threads (auto-detects if not set)
separator = None

@app.on_event("startup")
async def startup_event():
    """Initialize the vocal separator on startup."""
    global separator
    remote_cuda_url = os.getenv("REMOTE_CUDA_URL")
    use_onnx = os.getenv("USE_ONNX", "1") == "1"  # ONNX enabled by default
    use_quantized = os.getenv("QUANTIZED", "0") == "1"
    cpu_threads = int(os.getenv("CPU_THREADS", "0")) or None

    logger.info("=" * 60)
    logger.info("BOB the Skelly Backend Starting Up")
    logger.info(f"Log file: {LOG_FILE}")
    logger.info("=" * 60)

    try:
        logger.info("Initializing Vocal Separator...")
        if remote_cuda_url:
            logger.info(f"Backend: Remote CUDA Server ({remote_cuda_url})")
        else:
            logger.info(f"Backend: {'ONNX Runtime' if use_onnx else 'PyTorch CPU'}")
            logger.info(f"Quantized: {use_quantized}")
            logger.info(f"CPU Threads: {cpu_threads if cpu_threads else 'auto-detect'}")

        separator = VocalSeparator(
            quantized=use_quantized,
            use_onnx=use_onnx,
            num_threads=cpu_threads,
            remote_cuda_url=remote_cuda_url
        )

        logger.info(f"✓ Vocal separator ready! (Backend: {separator.backend_type})")
        logger.info("=" * 60)
    except FileNotFoundError as e:
        logger.warning("=" * 60)
        logger.warning("WARNING: Vocal separator model not found!")
        logger.warning(str(e))
        logger.warning("/separate-vocals endpoint will be disabled.")
        logger.warning("=" * 60)
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"ERROR loading vocal separator: {e}")
        logger.error("/separate-vocals endpoint will be disabled.")
        logger.error("=" * 60)


def cleanup_temp_files(*file_paths):
    """Background task to clean up temporary files."""
    for path in file_paths:
        try:
            if os.path.exists(path):
                os.unlink(path)
                logger.debug(f"Cleaned up temp file: {path}")
        except Exception as e:
            logger.error(f"Error cleaning up {path}: {e}")


@app.post("/separate-vocals")
async def separate_vocals(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Separates vocals from an uploaded audio file.
    Returns a ZIP containing vocals.wav and instrumental.wav.

    Note: This endpoint processes on CPU and may take several minutes.
    """
    logger.info(f"[/separate-vocals] Request received for: {file.filename}")

    if not separator:
        logger.error("[/separate-vocals] Vocal separator model not loaded")
        raise HTTPException(
            status_code=503,
            detail="Vocal separator model is not loaded. Please check server logs."
        )

    # Create job tracking
    job_id = str(uuid.uuid4())
    job = JobInfo(job_id=job_id, job_type='vocal_separation', filename=file.filename)
    active_jobs[job_id] = job
    logger.info(f"[/separate-vocals] Job created: {job_id}")

    # Save uploaded file to temp location
    temp_input = tempfile.NamedTemporaryFile(suffix=os.path.splitext(file.filename)[1], delete=False)
    start_time = datetime.now()

    try:
        content = await file.read()
        temp_input.write(content)
        temp_input.flush()
        temp_input.close()

        # Check for cancellation
        if job.is_cancelled():
            cleanup_temp_files(temp_input.name)
            logger.info(f"[/separate-vocals] Job {job_id} cancelled before processing")
            raise HTTPException(status_code=499, detail="Job cancelled")

        # Verify file was created
        if not os.path.exists(temp_input.name):
            raise Exception(f"Temporary file was not created: {temp_input.name}")

        file_size = os.path.getsize(temp_input.name)
        if file_size == 0:
            raise Exception(f"Temporary file is empty: {temp_input.name}")

        logger.info(f"[/separate-vocals] File uploaded: {file.filename}")
        logger.info(f"[/separate-vocals] Temp path: {temp_input.name}")
        logger.info(f"[/separate-vocals] File size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
        logger.info(f"[/separate-vocals] Starting AI vocal separation...")

        job.progress = 10

        # Check for cancellation before heavy processing
        if job.is_cancelled():
            cleanup_temp_files(temp_input.name)
            logger.info(f"[/separate-vocals] Job {job_id} cancelled before separation")
            raise HTTPException(status_code=499, detail="Job cancelled")

        # Process the audio (this is CPU-intensive and will block)
        vocals_path, instrumental_path, sr = separator.separate(temp_input.name)

        # Check cancellation after processing
        if job.is_cancelled():
            cleanup_temp_files(temp_input.name, vocals_path, instrumental_path)
            logger.info(f"[/separate-vocals] Job {job_id} cancelled after separation")
            raise HTTPException(status_code=499, detail="Job cancelled")

        processing_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[/separate-vocals] Separation complete in {processing_time:.1f}s")
        logger.info(f"[/separate-vocals] Sample rate: {sr} Hz")

        job.progress = 80

        # Create ZIP file
        logger.info(f"[/separate-vocals] Creating ZIP archive...")
        zip_path = tempfile.NamedTemporaryFile(suffix=".zip", delete=False).name
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(vocals_path, arcname="vocals.wav")
            zipf.write(instrumental_path, arcname="instrumental.wav")

        zip_size = os.path.getsize(zip_path)
        logger.info(f"[/separate-vocals] ZIP created: {zip_size:,} bytes ({zip_size / 1024 / 1024:.2f} MB)")

        job.progress = 100
        job.status = 'completed'

        # Schedule cleanup of temp files after response is sent
        background_tasks.add_task(
            cleanup_temp_files,
            temp_input.name,
            vocals_path,
            instrumental_path,
            zip_path
        )

        total_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[/separate-vocals] Total processing time: {total_time:.1f}s")
        logger.info(f"[/separate-vocals] Sending response...")

        return FileResponse(
            zip_path,
            media_type='application/zip',
            filename=f"{os.path.splitext(file.filename)[0]}_separated.zip",
            headers={"X-Job-ID": job_id}
        )

    except HTTPException as e:
        # Re-raise HTTPExceptions (including cancellation)
        job.status = 'cancelled' if e.status_code == 499 else 'failed'
        job.error_message = e.detail
        raise
    except Exception as e:
        # Clean up on error
        cleanup_temp_files(temp_input.name)
        error_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"[/separate-vocals] Error after {error_time:.1f}s: {e}")
        job.status = 'failed'
        job.error_message = str(e)
        raise HTTPException(status_code=500, detail=f"Error during separation: {str(e)}")



# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
    expose_headers=["X-Video-Title"] # Expose custom header
)

class VideoRequest(BaseModel):
    url: str

class JobResponse(BaseModel):
    job_id: str
    job_type: str
    filename: str
    status: str
    progress: int
    error_message: Optional[str]
    created_at: str

@app.get("/jobs")
async def list_jobs():
    """List all active and recent jobs."""
    jobs = []
    for job_id, job in active_jobs.items():
        jobs.append({
            "job_id": job.job_id,
            "job_type": job.job_type,
            "filename": job.filename,
            "status": job.status,
            "progress": job.progress,
            "error_message": job.error_message,
            "created_at": job.created_at.isoformat()
        })
    return {"jobs": jobs}

@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get status of a specific job."""
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.job_id,
        "job_type": job.job_type,
        "filename": job.filename,
        "status": job.status,
        "progress": job.progress,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat()
    }

@app.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running job."""
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != 'running':
        raise HTTPException(status_code=400, detail=f"Job is not running (status: {job.status})")

    logger.info(f"[/jobs/{job_id}/cancel] Cancelling job: {job.filename}")
    job.cancel()

    return {
        "job_id": job.job_id,
        "status": "cancelled",
        "message": "Job cancellation requested"
    }

@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Remove a job from the registry (completed/failed/cancelled only)."""
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == 'running':
        raise HTTPException(status_code=400, detail="Cannot delete running job. Cancel it first.")

    del active_jobs[job_id]
    logger.info(f"[DELETE /jobs/{job_id}] Job removed from registry")

    return {"message": "Job deleted"}

@app.post("/get-audio-url")
async def get_audio_url(request: VideoRequest):
    """
    Accepts a YouTube URL, downloads the audio to .cache, and serves the cached file.
    The video title is returned in a custom X-Video-Title header.
    """
    logger.info(f"[/get-audio-url] Request received for URL: {request.url}")

    if not request.url:
        logger.error("[/get-audio-url] Empty URL provided")
        raise HTTPException(status_code=422, detail="URL cannot be empty.")

    # Create cache directory if it doesn't exist
    cache_dir = Path(__file__).parent / ".cache"
    cache_dir.mkdir(exist_ok=True)

    start_time = datetime.now()
    job_id = None
    job = None

    try:
        # Extract video ID for caching
        logger.info(f"[/get-audio-url] Extracting video metadata...")
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            info = ydl.extract_info(request.url, download=False)

        video_id = info.get('id', 'unknown')
        video_title = info.get('title', 'Unknown Title')
        duration = info.get('duration', 0)

        logger.info(f"[/get-audio-url] Video ID: {video_id}")
        logger.info(f"[/get-audio-url] Title: {video_title}")
        logger.info(f"[/get-audio-url] Duration: {duration}s")

        # Check if already cached (always MP3)
        cached_file = cache_dir / f"{video_id}.mp3"

        if not cached_file.exists():
            # Create job for download tracking
            job_id = str(uuid.uuid4())
            job = JobInfo(job_id=job_id, job_type='youtube', filename=video_title)
            active_jobs[job_id] = job
            logger.info(f"[/get-audio-url] Job created: {job_id}")

            # Download and convert to MP3
            logger.info(f"[/get-audio-url] Not in cache. Downloading and converting to MP3...")
            job.progress = 10

            YDL_OPTIONS = {
                'format': 'bestaudio/best',
                'noplaylist': True,
                'outtmpl': str(cache_dir / f'{video_id}.%(ext)s'),
                'quiet': False,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            }

            # Check for cancellation before download
            if job and job.is_cancelled():
                logger.info(f"[/get-audio-url] Job {job_id} cancelled before download")
                raise HTTPException(status_code=499, detail="Job cancelled")

            with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
                ydl.download([request.url])

            # Check for cancellation after download
            if job and job.is_cancelled():
                # Clean up downloaded file
                if cached_file.exists():
                    os.unlink(cached_file)
                logger.info(f"[/get-audio-url] Job {job_id} cancelled after download")
                raise HTTPException(status_code=499, detail="Job cancelled")

            if not cached_file.exists():
                logger.error(f"[/get-audio-url] Download completed but MP3 not found: {cached_file}")
                if job:
                    job.status = 'failed'
                    job.error_message = "MP3 file not found after download"
                raise HTTPException(status_code=500, detail="Download succeeded but MP3 file not found in cache")

            file_size = os.path.getsize(cached_file)
            download_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"[/get-audio-url] Download complete in {download_time:.1f}s")
            logger.info(f"[/get-audio-url] File size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")

            if job:
                job.progress = 100
                job.status = 'completed'
        else:
            file_size = os.path.getsize(cached_file)
            logger.info(f"[/get-audio-url] Using cached file: {cached_file}")
            logger.info(f"[/get-audio-url] File size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")

        # Serve the MP3 file
        headers = {
            "X-Video-Title": quote(video_title.encode('utf-8')),
            "Content-Type": "audio/mpeg",
        }

        if job_id:
            headers["X-Job-ID"] = job_id

        total_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[/get-audio-url] Total time: {total_time:.1f}s. Sending response...")

        return FileResponse(
            path=cached_file,
            headers=headers,
            media_type="audio/mpeg",
            filename=f"{video_title}.mp3"
        )

    except HTTPException as e:
        # Re-raise HTTPExceptions (including cancellation)
        if job:
            job.status = 'cancelled' if e.status_code == 499 else 'failed'
            job.error_message = e.detail
        raise
    except yt_dlp.utils.DownloadError as e:
        error_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"[/get-audio-url] yt-dlp error after {error_time:.1f}s: {e}")
        if job:
            job.status = 'failed'
            job.error_message = str(e)
        raise HTTPException(status_code=500, detail=f"Failed to process YouTube URL: {e}")
    except Exception as e:
        error_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"[/get-audio-url] Unexpected error after {error_time:.1f}s: {e}")
        if job:
            job.status = 'failed'
            job.error_message = str(e)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")