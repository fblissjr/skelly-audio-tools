import { useState } from 'react';

// Defines the possible states of the YouTube fetching process
export type YouTubeFetchStatus = 'idle' | 'fetching-url' | 'fetching-audio' | 'success' | 'error';

export interface YouTubeFetchState {
  status: YouTubeFetchStatus;
  error: string | null;
  progress: number; // Not used yet, but here for future progress bars
}

const BACKEND_URL = 'http://localhost:8000/get-audio-url';

export const useYouTube = () => {
  const [state, setState] = useState<YouTubeFetchState>({
    status: 'idle',
    error: null,
    progress: 0,
  });

  const fetchAudio = async (youTubeUrl: string): Promise<ArrayBuffer | null> => {
    if (!youTubeUrl) {
      setState({ status: 'error', error: 'YouTube URL cannot be empty.', progress: 0 });
      return null;
    }

    // 1. Get the direct audio stream URL from our backend
    setState({ status: 'fetching-url', error: null, progress: 25 });
    let audioStreamUrl = '';
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youTubeUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Server error: ${response.statusText}`);
      }

      const data = await response.json();
      audioStreamUrl = data.audioUrl;
    } catch (err: any) {
      console.error('Error fetching audio stream URL:', err);
      setState({ status: 'error', error: `Failed to connect to backend: ${err.message}`, progress: 0 });
      return null;
    }

    // 2. Fetch the audio data from the stream URL
    setState({ status: 'fetching-audio', error: null, progress: 50 });
    try {
      const audioResponse = await fetch(audioStreamUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio data: ${audioResponse.statusText}`);
      }
      const arrayBuffer = await audioResponse.arrayBuffer();
      setState({ status: 'success', error: null, progress: 100 });
      return arrayBuffer;
    } catch (err: any) {
      console.error('Error fetching audio data:', err);
      setState({ status: 'error', error: `Failed to download audio: ${err.message}`, progress: 0 });
      return null;
    }
  };

  const reset = () => {
      setState({ status: 'idle', error: null, progress: 0 });
  }

  return { ...state, fetchAudio, reset };
};
