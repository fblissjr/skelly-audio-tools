from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import httpx

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import httpx
from urllib.parse import quote
import os
import tempfile
import zipfile
import soundfile as sf
from .separator import VocalSeparator

app = FastAPI()

# ... (CORS Middleware remains the same) ...

# Initialize the separator. This will load the model into memory on startup.
# This will fail if the model file doesn't exist.
separator = None
if os.path.exists("models/mel_band_roformer.onnx"):
    separator = VocalSeparator()
else:
    print("WARNING: ONNX model not found. /separate-vocals endpoint will be disabled.")


@app.post("/separate-vocals")
async def separate_vocals(file: UploadFile = File(...)):
    if not separator:
        raise HTTPException(status_code=503, detail="Vocal separator model is not loaded.")

    with tempfile.TemporaryDirectory() as tempdir:
        input_path = os.path.join(tempdir, file.filename)
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        try:
            vocals, instrumentals, sr = separator.separate(input_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error during separation: {e}")

        vocal_path = os.path.join(tempdir, "vocals.wav")
        instrumental_path = os.path.join(tempdir, "instrumental.wav")
        sf.write(vocal_path, vocals, sr)
        sf.write(instrumental_path, instrumentals, sr)

        zip_path = os.path.join(tempdir, "separated_audio.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            zipf.write(vocal_path, arcname="vocals.wav")
            zipf.write(instrumental_path, arcname="instrumental.wav")
        
        return FileResponse(zip_path, media_type='application/zip', filename="separated_audio.zip")


# ... (get_audio_url endpoint remains the same) ...


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
    Accepts a YouTube URL, finds the best audio-only stream, and then
    acts as a proxy to stream the audio content back to the client.
    The video title is returned in a custom X-Video-Title header.
    """
    if not request.url:
        raise HTTPException(status_code=422, detail="URL cannot be empty.")

    YDL_OPTIONS = {
        'format': 'bestaudio/best',
        'noplaylist': True,
    }

    try:
        with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
            info = ydl.extract_info(request.url, download=False)

        video_title = info.get('title', 'Unknown Title')
        audio_formats = [f for f in info.get('formats', []) if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
        if not audio_formats:
            audio_formats = [f for f in info.get('formats', []) if f.get('acodec') != 'none']

        if not audio_formats:
            raise HTTPException(status_code=404, detail="No suitable audio format found.")

        best_audio = sorted(audio_formats, key=lambda f: f.get('abr') or f.get('br') or 0, reverse=True)[0]
        audio_url = best_audio['url']
        
        async def stream_audio():
            async with httpx.AsyncClient() as client:
                async with client.stream("GET", audio_url) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        yield chunk

        async with httpx.AsyncClient() as client:
            head_response = await client.head(audio_url)
            headers = {
                "Content-Disposition": head_response.headers.get("Content-Disposition", "attachment; filename=audio.mp4"),
                "Content-Type": head_response.headers.get("Content-Type", "audio/mp4"),
                "Content-Length": head_response.headers.get("Content-Length"),
                "X-Video-Title": quote(video_title.encode('utf-8'))
            }

        return StreamingResponse(stream_audio(), headers=headers)

    except yt_dlp.utils.DownloadError as e:
        print(f"yt-dlp error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process YouTube URL: {e}")
    except httpx.HTTPStatusError as e:
        print(f"HTTP error while streaming audio: {e}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch audio from source: {e.response.reason_phrase}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")