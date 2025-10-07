import { useState } from 'react';
import { addAudio } from '../services/database';

// Defines the possible states of the YouTube fetching process
export type YouTubeFetchStatus = 'idle' | 'fetching' | 'success' | 'error';

export interface YouTubeFetchState {
  status: YouTubeFetchStatus;
  error: string | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/get-audio-url';

export const useYouTube = () => {
  const [state, setState] = useState<YouTubeFetchState>({
    status: 'idle',
    error: null,
  });

  const fetchAudio = async (youTubeUrl: string): Promise<ArrayBuffer | null> => {
    if (!youTubeUrl) {
      setState({ status: 'error', error: 'YouTube URL cannot be empty.' });
      return null;
    }

    const videoIdMatch = youTubeUrl.match(/(?:v=)([^&]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : new Date().getTime().toString();

    setState({ status: 'fetching', error: null });
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

      const titleHeader = response.headers.get('X-Video-Title');
      const title = titleHeader ? decodeURIComponent(titleHeader) : 'Unknown Title';
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Save to IndexedDB
      await addAudio({ id: videoId, title, data: arrayBuffer.slice(0) });

      setState({ status: 'success', error: null });
      return arrayBuffer;

    } catch (err: any) {
      console.error('Error fetching audio data:', err);
      setState({ status: 'error', error: `Failed to download audio: ${err.message}` });
      return null;
    }
  };

  const reset = () => {
      setState({ status: 'idle', error: null });
  }

  return { ...state, fetchAudio, reset };
};