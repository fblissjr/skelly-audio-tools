from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import httpx

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"]
)

class VideoRequest(BaseModel):
    url: str

@app.post("/get-audio-url")
async def get_audio_url(request: VideoRequest):
    """
    Accepts a YouTube URL, finds the best audio-only stream, and then
    acts as a proxy to stream the audio content back to the client.
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

        audio_formats = [f for f in info.get('formats', []) if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
        if not audio_formats:
            audio_formats = [f for f in info.get('formats', []) if f.get('acodec') != 'none']

        if not audio_formats:
            raise HTTPException(status_code=404, detail="No suitable audio format found.")

        best_audio = sorted(audio_formats, key=lambda f: f.get('abr') or f.get('br') or 0, reverse=True)[0]
        audio_url = best_audio['url']
        
        # Instead of returning the URL, we now stream the content
        async def stream_audio():
            async with httpx.AsyncClient() as client:
                async with client.stream("GET", audio_url) as response:
                    response.raise_for_status()  # Raise an exception for bad status codes
                    async for chunk in response.aiter_bytes():
                        yield chunk

        # Get headers from the original response to pass them along
        async with httpx.AsyncClient() as client:
            head_response = await client.head(audio_url)
            headers = {
                "Content-Disposition": head_response.headers.get("Content-Disposition", "attachment; filename=audio.mp4"),
                "Content-Type": head_response.headers.get("Content-Type", "audio/mp4"),
                "Content-Length": head_response.headers.get("Content-Length"),
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