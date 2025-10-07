import React, { useState, useEffect } from 'react';
import { getAllAudioMetadata, deleteAudio } from '../services/database';

interface AudioMetadata {
  id: string;
  title: string;
  timestamp: number;
}

interface YouTubeHistoryProps {
  onLoad: (id: string) => void;
}

const YouTubeHistory: React.FC<YouTubeHistoryProps> = ({ onLoad }) => {
  const [history, setHistory] = useState<AudioMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const metadata = await getAllAudioMetadata();
      setHistory(metadata);
    } catch (error) {
      console.error("Failed to load audio history:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteAudio(id);
      // Refresh the list after deleting
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error(`Failed to delete audio ${id}:`, error);
    }
  };

  if (isLoading) {
    return <p className="text-slate-400 text-center">Loading history...</p>;
  }

  if (history.length === 0) {
    return <p className="text-slate-500 text-center text-sm mt-6">No download history yet.</p>;
  }

  return (
    <div className="mt-8 pt-6 border-t border-slate-700">
      <h3 className="font-semibold text-slate-300 mb-3">Download History</h3>
      <div className="space-y-2">
        {history.map(item => (
          <div key={item.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
            <div className="truncate">
              <p className="text-slate-200 font-medium truncate" title={item.title}>{item.title}</p>
              <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</p>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
              <button 
                onClick={() => onLoad(item.id)}
                className="px-3 py-1 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                title="Load this audio"
              >
                Load
              </button>
              <button 
                onClick={() => handleDelete(item.id)}
                className="p-2 rounded-md hover:bg-red-500/20 text-red-400 transition-colors"
                title="Delete from history"
              >
                  <i className="ph-bold ph-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default YouTubeHistory;
