from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"]-  # Allows all methods
    allow_headers=["*"]-  # Allows all headers
)

class VideoRequest(BaseModel):
    url: str

@app.post("/get-audio-url")
async def get_audio_url(request: VideoRequest):
    """
    Accepts a YouTube URL and returns a direct URL to the best audio-only stream.
    """
    YDL_OPTIONS = {
        'format': 'bestaudio/best',
        'noplaylist': True,
    }

    try:
        with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
            info = ydl.extract_info(request.url, download=False)

            # Filter for audio-only formats and sort by average bitrate
            audio_formats = [f for f in info.get('formats', []) if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
            if not audio_formats:
                # Fallback for formats that bundle audio and video like mp4
                audio_formats = [f for f in info.get('formats', []) if f.get('acodec') != 'none']

            if not audio_formats:
                 raise HTTPException(status_code=404, detail="No suitable audio format found.")

            # Sort by average bitrate (abr) descending, or bitrate (br) as a fallback
            best_audio = sorted(audio_formats, key=lambda f: f.get('abr') or f.get('br') or 0, reverse=True)[0]

            return {"audioUrl": best_audio['url']}

    except yt_dlp.utils.DownloadError as e:
        print(f"yt-dlp error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process YouTube URL: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
