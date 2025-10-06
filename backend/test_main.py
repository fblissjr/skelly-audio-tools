from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from .main import app

client = TestClient(app)

def test_get_audio_url_success():
    """Tests the happy path where a valid YouTube URL is provided and an audio stream is found."""
    # This is a sample of the data structure yt-dlp returns
    mock_video_info = {
        'formats': [
            {'acodec': 'opus', 'vcodec': 'none', 'abr': 160, 'url': 'https://example.com/best_audio.opus'},
            {'acodec': 'mp4a.40.2', 'vcodec': 'none', 'abr': 128, 'url': 'https://example.com/good_audio.m4a'},
            {'acodec': 'none', 'vcodec': 'vp9', 'url': 'https://example.com/video_only.webm'},
        ]
    }

    # We patch yt_dlp.YoutubeDL to avoid real network calls
    with patch('main.yt_dlp.YoutubeDL') as mock_ydl:
        # Configure the mock to return our fake video info
        mock_instance = MagicMock()
        mock_instance.extract_info.return_value = mock_video_info
        mock_ydl.return_value.__enter__.return_value = mock_instance

        response = client.post("/get-audio-url", json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})

        assert response.status_code == 200
        assert response.json() == {"audioUrl": "https://example.com/best_audio.opus"}
        mock_instance.extract_info.assert_called_once_with("https://www.youtube.com/watch?v=dQw4w9WgXcQ", download=False)

def test_get_audio_url_no_suitable_format():
    """Tests the case where yt-dlp returns info, but no audio-only format is available."""
    mock_video_info = {
        'formats': [
            {'acodec': 'none', 'vcodec': 'vp9', 'url': 'https://example.com/video_only.webm'},
        ]
    }

    with patch('main.yt_dlp.YoutubeDL') as mock_ydl:
        mock_instance = MagicMock()
        mock_instance.extract_info.return_value = mock_video_info
        mock_ydl.return_value.__enter__.return_value = mock_instance

        response = client.post("/get-audio-url", json={"url": "https://www.youtube.com/watch?v=some_video"})

        assert response.status_code == 404
        assert "No suitable audio format found" in response.json()["detail"]

def test_get_audio_url_yt_dlp_fails():
    """Tests the case where yt-dlp throws an exception."""
    with patch('main.yt_dlp.YoutubeDL') as mock_ydl:
        # Configure the mock to raise an error when used
        mock_instance = MagicMock()
        mock_instance.extract_info.side_effect = Exception("Video unavailable")
        mock_ydl.return_value.__enter__.return_value = mock_instance

        response = client.post("/get-audio-url", json={"url": "https://www.youtube.com/watch?v=private_video"})

        assert response.status_code == 500
        assert "Failed to process YouTube URL" in response.json()["detail"]

def test_get_audio_url_no_url_provided():
    """Tests that a 422 Unprocessable Entity error is returned if the URL is missing."""
    response = client.post("/get-audio-url", json={"url": ""})
    # FastAPI automatically handles this validation, returning a 422 error
    assert response.status_code == 422
