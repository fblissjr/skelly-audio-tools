import React, { useState, useRef, useEffect } from 'react';
import type { AudioSegment, WaveformData } from '../types';
import Waveform from './Waveform';
import { applyVolumeToSegment } from '../services/audioProcessor';


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
        <Waveform data={data} width={200} height={50} color={color} />
    </div>
);


const SegmentCard: React.FC<{ segment: AudioSegment, onVolumeChange: (id: number, volume: number) => void; }> = ({ segment, onVolumeChange }) => {
    const startTimeFormatted = formatTime(segment.startTime);
    const endTimeFormatted = formatTime(segment.startTime + segment.duration);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = segment.volume;
        }
    }, [segment.volume]);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const adjustedBlob = await applyVolumeToSegment(segment.blobUrl, segment.volume);
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
        <div className="bg-slate-800 rounded-lg p-4 flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0 lg:space-x-4 border border-slate-700 shadow-md">
            <div className="w-full lg:w-auto flex items-center space-x-4">
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
            
            <div className="w-full lg:flex-grow flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                <div className="w-full md:w-auto flex-grow flex items-center space-x-2">
                    <WaveformDisplay title="Before" data={segment.originalWaveform} color="#a8a29e" />
                    <i className="ph-bold ph-arrow-right text-slate-500 text-xl"></i>
                    <WaveformDisplay title="After" data={segment.processedWaveform} color="#fb923c" />
                </div>
                <div className="w-full md:w-auto flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                    <audio controls src={segment.blobUrl} ref={audioRef} className="w-full sm:w-52 h-10"></audio>
                    <div className="w-full sm:w-auto flex items-center space-x-2">
                         <i className="ph-bold ph-speaker-simple-high text-slate-400"></i>
                         <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={segment.volume}
                            onChange={(e) => onVolumeChange(segment.id, parseFloat(e.target.value))}
                            className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            title={`Volume: ${Math.round(segment.volume * 100)}%`}
                         />
                    </div>
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-slate-600 text-slate-100 rounded-md hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        title={`Download ${segment.name}`}
                    >
                        {isDownloading ? <i className="ph ph-spinner animate-spin"></i> : <i className="ph-bold ph-download-simple"></i>}
                        <span className="hidden sm:inline">{isDownloading ? "Preparing..." : "Download"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const Results: React.FC<{ segments: AudioSegment[], onSegmentVolumeChange: (id: number, volume: number) => void; }> = ({ segments, onSegmentVolumeChange }) => {
  const [isZipping, setIsZipping] = useState(false);

  const handleDownloadAll = async () => {
    if (!segments || segments.length === 0 || typeof JSZip === 'undefined') return;

    setIsZipping(true);

    try {
      const zip = new JSZip();

      const downloadPromises = segments.map(segment =>
        applyVolumeToSegment(segment.blobUrl, segment.volume).then(blob => {
          zip.file(segment.name, blob);
        })
      );
      
      await Promise.all(downloadPromises);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SkellyTune_Clips.zip';
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
          <p className="text-slate-400">Fine-tune volume for each clip, then download individually or all at once.</p>
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
                <span>Zipping...</span>
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
          <SegmentCard key={segment.id} segment={segment} onVolumeChange={onSegmentVolumeChange} />
        ))}
      </div>
    </section>
  );
};

export default Results;