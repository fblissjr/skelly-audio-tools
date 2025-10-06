import React, { useRef, useEffect, useState } from 'react';
import type { AudioSegment } from '../types';
import InteractiveWaveform from './InteractiveWaveform';
import { EffectSlider } from './Results'; // Assuming EffectSlider is exported from Results.tsx
import { applyEffectsToSegment } from '../services/audioProcessor';
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

interface MasterTrackEditorProps {
  masterTrack: AudioSegment;
  isProcessing: boolean;
  selectedRegion: Region | null;
  onRegionChange: (region: Region | null) => void;
  onAddSegment: () => void;
  onAutoSplit: () => void;
  onSettingsChange: (settings: Partial<Pick<AudioSegment, 'volume' | 'fadeInDuration' | 'fadeOutDuration'>>) => void;
}

const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`;
};

const MasterTrackEditor: React.FC<MasterTrackEditorProps> = ({
  masterTrack,
  isProcessing,
  selectedRegion,
  onRegionChange,
  onAddSegment,
  onAutoSplit,
  onSettingsChange,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, masterTrack.volume));
    }
  }, [masterTrack.volume]);

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
        const { volume, fadeInDuration, fadeOutDuration } = masterTrack;
        const adjustedBlob = await applyEffectsToSegment(masterTrack.blobUrl, { volume, fadeInDuration, fadeOutDuration });
        const url = URL.createObjectURL(adjustedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = masterTrack.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error(`Failed to download ${masterTrack.name}:`, error);
    } finally {
        setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">Master Track Editor</h3>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-4">
          <InteractiveWaveform audioUrl={masterTrack.blobUrl} onRegionChange={onRegionChange} />
          <audio controls src={masterTrack.blobUrl} ref={audioRef} className="w-full h-10"></audio>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3 p-4 rounded-lg bg-slate-700/50 flex flex-col">
            <h4 className="font-bold text-slate-200">Master Track Controls</h4>
            <div className="flex-grow space-y-3">
              <EffectSlider label="Volume" icon="ph-speaker-simple-high" value={masterTrack.volume * 100} max={200} step={1} unit="%" onChange={(val) => onSettingsChange({ volume: val / 100 })} />
              <EffectSlider label="Fade In" icon="ph-chart-line-up" value={masterTrack.fadeInDuration} max={10} step={0.1} unit="s" onChange={(val) => onSettingsChange({ fadeInDuration: val })} />
              <EffectSlider label="Fade Out" icon="ph-chart-line-down" value={masterTrack.fadeOutDuration} max={10} step={0.1} unit="s" onChange={(val) => onSettingsChange({ fadeOutDuration: val })} />
            </div>
            <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-2 bg-slate-600 text-slate-100 rounded-md hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
                {isDownloading ? <i className="ph ph-spinner animate-spin"></i> : <i className="ph-bold ph-download-simple"></i>}
                <span>{isDownloading ? "Applying effects..." : "Download Master Track"}</span>
            </button>
        </div>

        <div className="space-y-3 p-4 rounded-lg bg-slate-700/50">
            <h4 className="font-bold text-slate-200">Segmentation Tools</h4>
            <div className="text-sm text-slate-400 h-12">
                {selectedRegion ? (
                    <p>Region selected from {formatTime(selectedRegion.start)} to {formatTime(selectedRegion.end)}</p>
                ) : (
                    <p>Drag on the waveform to create a region for manual segmentation.</p>
                )}
            </div>
            <button onClick={onAddSegment} disabled={!selectedRegion || isProcessing} className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Create Segment from Selection
            </button>
            <button onClick={onAutoSplit} disabled={isProcessing} className="w-full px-4 py-2 font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                Auto-Split into 30s Segments
            </button>
        </div>
      </div>
    </div>
  );
};

export default MasterTrackEditor;
