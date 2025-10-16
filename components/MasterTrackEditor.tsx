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
  activationThreshold: number;
  showActivationOverlay: boolean;
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
  activationThreshold,
  showActivationOverlay,
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-lg font-semibold text-slate-300 mb-3">Master Track Waveform</h3>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-3">
          <InteractiveWaveform
            audioUrl={masterTrack.blobUrl}
            onRegionChange={onRegionChange}
            activationThreshold={activationThreshold}
            showActivationOverlay={showActivationOverlay}
            audioRef={audioRef}
          />

          {/* Region info and segment button - right below waveform */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="text-sm">
                {selectedRegion ? (
                    <div className="space-y-1">
                      <p className="text-slate-300 font-medium">
                        <i className="ph-bold ph-selection mr-2 text-cyan-400"></i>
                        Selection: {formatTime(selectedRegion.start)} to {formatTime(selectedRegion.end)}
                      </p>
                      <p className="text-slate-400">
                        Duration: {formatTime(selectedRegion.end - selectedRegion.start)}
                      </p>
                    </div>
                ) : (
                    <p className="text-slate-400">
                      <i className="ph-bold ph-info mr-2"></i>
                      Drag on the waveform to select a region
                    </p>
                )}
            </div>
            <button
              onClick={onAddSegment}
              disabled={!selectedRegion || isProcessing}
              className="px-6 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2">
                <i className="ph-bold ph-scissors"></i>
                <span>Create Segment</span>
            </button>
          </div>

          {/* Auto-split button */}
          <button
            onClick={onAutoSplit}
            disabled={isProcessing}
            className="w-full px-4 py-2 font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2">
              <i className="ph-bold ph-scissors"></i>
              <span>Auto-Split into 30s Segments</span>
          </button>
        </div>
      </div>

      {/* Master Track Controls */}
      <div className="space-y-3 p-4 rounded-lg bg-slate-700/50 border border-slate-700">
        <h4 className="font-bold text-slate-200">Master Track Effects</h4>
        <div className="space-y-3">
          <EffectSlider label="Volume" icon="ph-speaker-simple-high" value={masterTrack.volume * 100} max={200} step={1} unit="%" onChange={(val) => onSettingsChange({ volume: val / 100 })} />
          <EffectSlider label="Fade In" icon="ph-chart-line-up" value={masterTrack.fadeInDuration} max={10} step={0.1} unit="s" onChange={(val) => onSettingsChange({ fadeInDuration: val })} />
          <EffectSlider label="Fade Out" icon="ph-chart-line-down" value={masterTrack.fadeOutDuration} max={10} step={0.1} unit="s" onChange={(val) => onSettingsChange({ fadeOutDuration: val })} />
        </div>
        <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-2 bg-slate-600 text-slate-100 rounded-md hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-wait">
            {isDownloading ? <i className="ph ph-spinner animate-spin"></i> : <i className="ph-bold ph-download-simple"></i>}
            <span>{isDownloading ? "Applying effects..." : "Download Master Track"}</span>
        </button>
      </div>

      {/* Hidden audio element for syncing */}
      <audio src={masterTrack.blobUrl} ref={audioRef} className="hidden"></audio>
    </div>
  );
};

export default MasterTrackEditor;
