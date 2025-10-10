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

app = FastAPI(
    title="BOB the Skelly - Backend API",
    version="2.0",
    description="Provides endpoints for fetching YouTube audio and performing vocal separation."
)

# Initialize the separator on startup
# Set QUANTIZED=1 environment variable to use the quantized model (faster on CPU)
separator = None

@app.on_event("startup")
async def startup_event():
    """Initialize the vocal separator on startup."""
    global separator
    use_quantized = os.getenv("QUANTIZED", "0") == "1"

    try:
        print("=" * 60)
        print("Initializing Vocal Separator...")
        print(f"Mode: {'Quantized (CPU-optimized)' if use_quantized else 'Standard'}")
        print("=" * 60)
        separator = VocalSeparator(quantized=use_quantized)
        print("✓ Vocal separator ready!")
        print("=" * 60)
    except FileNotFoundError as e:
        print("=" * 60)
        print("WARNING: Vocal separator model not found!")
        print(str(e))
        print("/separate-vocals endpoint will be disabled.")
        print("=" * 60)
    except Exception as e:
        print("=" * 60)
        print(f"ERROR loading vocal separator: {e}")
        print("/separate-vocals endpoint will be disabled.")
        print("=" * 60)


def cleanup_temp_files(*file_paths):
    """Background task to clean up temporary files."""
    for path in file_paths:
        try:
            if os.path.exists(path):
                os.unlink(path)
        except Exception as e:
            print(f"Error cleaning up {path}: {e}")


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
    if not separator:
        raise HTTPException(
            status_code=503,
            detail="Vocal separator model is not loaded. Please check server logs."
        )

    # Save uploaded file to temp location
    temp_input = tempfile.NamedTemporaryFile(suffix=os.path.splitext(file.filename)[1], delete=False)
    try:
        content = await file.read()
        temp_input.write(content)
        temp_input.flush()  # Ensure data is written to disk
        temp_input.close()

        # Verify file was created
        if not os.path.exists(temp_input.name):
            raise Exception(f"Temporary file was not created: {temp_input.name}")

        file_size = os.path.getsize(temp_input.name)
        if file_size == 0:
            raise Exception(f"Temporary file is empty: {temp_input.name}")

        print(f"Starting separation for: {file.filename} (temp file: {temp_input.name}, size: {file_size} bytes)")

        # Process the audio (this is CPU-intensive and will block)
        vocals_path, instrumental_path, sr = separator.separate(temp_input.name)
        print(f"Separation complete for: {file.filename}")

        # Create ZIP file
        zip_path = tempfile.NamedTemporaryFile(suffix=".zip", delete=False).name
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(vocals_path, arcname="vocals.wav")
            zipf.write(instrumental_path, arcname="instrumental.wav")

        # Schedule cleanup of temp files after response is sent
        background_tasks.add_task(
            cleanup_temp_files,
            temp_input.name,
            vocals_path,
            instrumental_path,
            zip_path
        )

        return FileResponse(
            zip_path,
            media_type='application/zip',
            filename=f"{os.path.splitext(file.filename)[0]}_separated.zip"
        )

    except Exception as e:
        # Clean up on error
        cleanup_temp_files(temp_input.name)
        print(f"Error during separation: {e}")
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

@app.post("/get-audio-url")
async def get_audio_url(request: VideoRequest):
    """
    Accepts a YouTube URL, downloads the audio to .cache, and serves the cached file.
    The video title is returned in a custom X-Video-Title header.
    """
    if not request.url:
        raise HTTPException(status_code=422, detail="URL cannot be empty.")

    # Create cache directory if it doesn't exist
    cache_dir = Path(__file__).parent / ".cache"
    cache_dir.mkdir(exist_ok=True)

    try:
        # Extract video ID for caching
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            info = ydl.extract_info(request.url, download=False)

        video_id = info.get('id', 'unknown')
        video_title = info.get('title', 'Unknown Title')

        # Check if already cached (always MP3)
        cached_file = cache_dir / f"{video_id}.mp3"

        if not cached_file.exists():
            # Download and convert to MP3
            print(f"Downloading {video_id} to cache and converting to MP3...")
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

            with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
                ydl.download([request.url])

            if not cached_file.exists():
                raise HTTPException(status_code=500, detail="Download succeeded but MP3 file not found in cache")
        else:
            print(f"Using cached MP3 file: {cached_file}")

        # Serve the MP3 file
        headers = {
            "X-Video-Title": quote(video_title.encode('utf-8')),
            "Content-Type": "audio/mpeg",
        }

        return FileResponse(
            path=cached_file,
            headers=headers,
            media_type="audio/mpeg",
            filename=f"{video_title}.mp3"
        )

    except yt_dlp.utils.DownloadError as e:
        print(f"yt-dlp error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process YouTube URL: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")