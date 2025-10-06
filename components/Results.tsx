import React, { useState, useRef, useEffect } from 'react';
import type { AudioSegment, WaveformData } from '../types';
import Waveform from './Waveform';
import { applyEffectsToSegment } from '../services/audioProcessor';


// Inform TypeScript that JSZip is available globally from the script tag in index.html
declare const JSZip: any;

const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const WaveformDisplay: React.FC<{ title: string; data: WaveformData; color: string }> = ({ title, data, color }) => (
    <div className="flex-1 p-2 bg-slate-700/50 rounded-md">
        <p className="text-xs font-bold text-center text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <Waveform data={data} height={50} color={color} />
    </div>
);

const EffectSlider: React.FC<{
    label: string;
    icon: string;
    value: number;
    min?: number;
    max: number;
    step?: number;
    unit: string;
    onChange: (value: number) => void;
}> = ({ label, icon, value, min = 0, max, step = 0.01, unit, onChange }) => (
    <div>
        <div className="flex justify-between items-center text-sm mb-1">
            <label htmlFor={`${label}-slider`} className="font-medium text-slate-300 flex items-center">
                <i className={`ph-bold ${icon} mr-2 text-slate-400`}></i>
                {label}
            </label>
            <span className="font-mono text-orange-400">{value.toFixed(unit === '%' ? 0 : 2)}{unit}</span>
        </div>
        <input
            id={`${label}-slider`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
            aria-label={label}
        />
    </div>
);


const SegmentCard: React.FC<{ 
    segment: AudioSegment, 
    onSettingsChange: (id: number, settings: Partial<Pick<AudioSegment, 'volume' | 'fadeInDuration' | 'fadeOutDuration'>>) => void; 
}> = ({ segment, onSettingsChange }) => {
    const startTimeFormatted = formatTime(segment.startTime);
    const endTimeFormatted = formatTime(segment.startTime + segment.duration);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // This useEffect allows the native audio player's volume to be controlled
    // by our custom volume slider for a better preview experience.
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = segment.volume;
        }
    }, [segment.volume]);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const { volume, fadeInDuration, fadeOutDuration } = segment;
            const adjustedBlob = await applyEffectsToSegment(segment.blobUrl, { volume, fadeInDuration, fadeOutDuration });
            const url = URL.createObjectURL(adjustedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = segment.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(`Failed to download ${segment.name}:`, error);
        } finally {
            setIsDownloading(false);
        }
    };


    return (
        <div className="bg-slate-800 rounded-lg p-4 flex flex-col lg:flex-row items-start justify-between gap-6 border border-slate-700 shadow-md">
            {/* Left side: Info and Waveforms */}
            <div className="w-full lg:flex-1 space-y-4">
                <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-md bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xl">
                        {segment.id + 1}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-100">{segment.name}</p>
                        <p className="text-sm text-slate-400">
                            Time: {startTimeFormatted} - {endTimeFormatted}
                        </p>
                    </div>
                </div>
                <div className="w-full flex items-center space-x-2">
                    <WaveformDisplay title="Before" data={segment.originalWaveform} color="#a8a29e" />
                    <i className="ph-bold ph-arrow-right text-slate-500 text-xl"></i>
                    <WaveformDisplay title="After" data={segment.processedWaveform} color="#fb923c" />
                </div>
            </div>

            {/* Right side: Controls */}
            <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
                <audio controls src={segment.blobUrl} ref={audioRef} className="w-full h-10"></audio>
                
                <div className="space-y-3 pt-2">
                    <EffectSlider
                        label="Volume"
                        icon="ph-speaker-simple-high"
                        value={segment.volume * 100}
                        max={200}
                        step={1}
                        unit="%"
                        onChange={(val) => onSettingsChange(segment.id, { volume: val / 100 })}
                    />
                    <EffectSlider
                        label="Fade In"
                        icon="ph-chart-line-up"
                        value={segment.fadeInDuration}
                        max={Math.min(10, segment.duration / 2)}
                        step={0.05}
                        unit="s"
                        onChange={(val) => onSettingsChange(segment.id, { fadeInDuration: val })}
                    />
                    <EffectSlider
                        label="Fade Out"
                        icon="ph-chart-line-down"
                        value={segment.fadeOutDuration}
                        max={Math.min(10, segment.duration / 2)}
                        step={0.05}
                        unit="s"
                        onChange={(val) => onSettingsChange(segment.id, { fadeOutDuration: val })}
                    />
                </div>
                
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-slate-600 text-slate-100 rounded-md hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    title={`Download ${segment.name}`}
                >
                    {isDownloading ? <i className="ph ph-spinner animate-spin"></i> : <i className="ph-bold ph-download-simple"></i>}
                    <span>{isDownloading ? "Applying effects..." : "Download"}</span>
                </button>
            </div>
        </div>
    );
};

const Results: React.FC<{ segments: AudioSegment[], onSegmentSettingsChange: (id: number, settings: Partial<Pick<AudioSegment, 'volume' | 'fadeInDuration' | 'fadeOutDuration'>>) => void; }> = ({ segments, onSegmentSettingsChange }) => {
  const [isZipping, setIsZipping] = useState(false);

  const handleDownloadAll = async () => {
    if (!segments || segments.length === 0 || typeof JSZip === 'undefined') return;

    setIsZipping(true);

    try {
      const zip = new JSZip();

      const downloadPromises = segments.map(segment =>
        applyEffectsToSegment(segment.blobUrl, { 
            volume: segment.volume, 
            fadeInDuration: segment.fadeInDuration, 
            fadeOutDuration: segment.fadeOutDuration 
        }).then(blob => {
          zip.file(segment.name, blob);
        })
      );
      
      await Promise.all(downloadPromises);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Bob_the_Skelly_Clips.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to create ZIP file:", error);
      // You could set an error state here to inform the user
    } finally {
      setIsZipping(false);
    }
  };


  return (
    <section>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-slate-200">Your Processed Clips</h2>
          <p className="text-slate-400">Fine-tune each clip, then download individually or all at once.</p>
        </div>
        {segments.length > 0 && (
          <button
            onClick={handleDownloadAll}
            disabled={isZipping}
            className="mt-4 sm:mt-0 px-6 py-2 font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-600 rounded-lg shadow-lg hover:from-teal-600 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center space-x-2"
          >
            {isZipping ? (
              <>
                <i className="ph ph-spinner animate-spin"></i>
                <span>Applying Effects & Zipping...</span>
              </>
            ) : (
              <>
                <i className="ph-bold ph-file-zip"></i>
                <span>Download All (.zip)</span>
              </>
            )}
          </button>
        )}
      </div>
      
      <div className="space-y-4">
        {segments.map(segment => (
          <SegmentCard key={segment.id} segment={segment} onSettingsChange={onSegmentSettingsChange} />
        ))}
      </div>
    </section>
  );
};

export default Results;
