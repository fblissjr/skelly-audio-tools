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

const WaveformDisplay: React.FC<{ title: string; data: WaveformData; color: string; duration: number; onSeek?: (time: number) => void; }> = ({ title, data, color, duration, onSeek }) => (
    <div className="flex-1 p-2 bg-slate-700/50 rounded-md">
        <p className="text-xs font-bold text-center text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <Waveform data={data} height={50} color={color} totalDuration={duration} onSeek={onSeek} />
    </div>
);

export const EffectSlider: React.FC<{
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
    onSeparateVocals?: (segmentId: number, segmentFile: File) => Promise<void>;
    globalInstrumentalFile?: File | null;
}> = ({ segment, onSettingsChange, onSeparateVocals, globalInstrumentalFile }) => {
    const startTimeFormatted = formatTime(segment.startTime);
    const endTimeFormatted = formatTime(segment.startTime + segment.duration);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSeparating, setIsSeparating] = useState(false);
    const [useRecombined, setUseRecombined] = useState(false);
    const [vocalVolume, setVocalVolume] = useState(1.0); // 1.0 = 100%

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = Math.max(0, Math.min(1, segment.volume));
        }
    }, [segment.volume]);

    const handleSeparateVocals = async () => {
        if (!onSeparateVocals) return;
        setIsSeparating(true);
        try {
            // Convert blob URL to File
            const response = await fetch(segment.blobUrl);
            const blob = await response.blob();
            const file = new File([blob], segment.name, { type: 'audio/wav' });
            await onSeparateVocals(segment.id, file);
        } catch (error) {
            console.error(`Failed to separate vocals for ${segment.name}:`, error);
        } finally {
            setIsSeparating(false);
        }
    };

    const recombineAudio = async (): Promise<Blob> => {
        // Mix vocals (current segment) with instrumental
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Load vocals
        const vocalsResponse = await fetch(segment.blobUrl);
        const vocalsBlob = await vocalsResponse.arrayBuffer();
        const vocalsBuffer = await audioContext.decodeAudioData(vocalsBlob);

        // Load instrumental
        let instrumentalBuffer: AudioBuffer;
        if (segment.instrumentalBlobUrl) {
            // Use segment-specific instrumental
            const instResponse = await fetch(segment.instrumentalBlobUrl);
            const instBlob = await instResponse.arrayBuffer();
            instrumentalBuffer = await audioContext.decodeAudioData(instBlob);
        } else if (globalInstrumentalFile) {
            // Use global instrumental, need to extract the right segment
            const instArrayBuffer = await globalInstrumentalFile.arrayBuffer();
            const fullInstBuffer = await audioContext.decodeAudioData(instArrayBuffer);

            // Extract segment from global instrumental
            const sampleRate = fullInstBuffer.sampleRate;
            const startSample = Math.floor(segment.startTime * sampleRate);
            const length = Math.floor(segment.duration * sampleRate);

            instrumentalBuffer = audioContext.createBuffer(
                fullInstBuffer.numberOfChannels,
                length,
                sampleRate
            );

            for (let channel = 0; channel < fullInstBuffer.numberOfChannels; channel++) {
                const sourceData = fullInstBuffer.getChannelData(channel);
                const destData = instrumentalBuffer.getChannelData(channel);
                for (let i = 0; i < length && (startSample + i) < sourceData.length; i++) {
                    destData[i] = sourceData[startSample + i];
                }
            }
        } else {
            throw new Error('No instrumental track available for recombination');
        }

        // Mix the two buffers
        const maxLength = Math.max(vocalsBuffer.length, instrumentalBuffer.length);
        const numberOfChannels = Math.max(vocalsBuffer.numberOfChannels, instrumentalBuffer.numberOfChannels);
        const sampleRate = vocalsBuffer.sampleRate;

        const mixedBuffer = audioContext.createBuffer(numberOfChannels, maxLength, sampleRate);

        for (let channel = 0; channel < numberOfChannels; channel++) {
            const mixedData = mixedBuffer.getChannelData(channel);
            const vocalsData = channel < vocalsBuffer.numberOfChannels ? vocalsBuffer.getChannelData(channel) : null;
            const instData = channel < instrumentalBuffer.numberOfChannels ? instrumentalBuffer.getChannelData(channel) : null;

            for (let i = 0; i < maxLength; i++) {
                let sample = 0;
                if (vocalsData && i < vocalsBuffer.length) sample += vocalsData[i] * vocalVolume;
                if (instData && i < instrumentalBuffer.length) sample += instData[i];
                mixedData[i] = sample;
            }
        }

        // Convert to WAV blob
        const wavBlob = await bufferToWave(mixedBuffer, sampleRate);
        return wavBlob;
    };

    const bufferToWave = (buffer: AudioBuffer, sampleRate: number): Promise<Blob> => {
        const length = buffer.length * buffer.numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;

        // Write WAV header
        const setUint16 = (data: number) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        const setUint32 = (data: number) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(buffer.numberOfChannels);
        setUint32(sampleRate);
        setUint32(sampleRate * 2 * buffer.numberOfChannels); // avg. bytes/sec
        setUint16(buffer.numberOfChannels * 2); // block-align
        setUint16(16); // 16-bit
        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // Write interleaved data
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return Promise.resolve(new Blob([arrayBuffer], { type: 'audio/wav' }));
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            let blobToDownload: Blob;

            if (useRecombined && (segment.instrumentalBlobUrl || globalInstrumentalFile)) {
                // Recombine vocals with instrumental first
                blobToDownload = await recombineAudio();
            } else {
                // Just download vocals with effects
                const { volume, fadeInDuration, fadeOutDuration } = segment;
                blobToDownload = await applyEffectsToSegment(segment.blobUrl, { volume, fadeInDuration, fadeOutDuration });
            }

            const url = URL.createObjectURL(blobToDownload);
            const a = document.createElement('a');
            a.href = url;
            const downloadName = useRecombined
                ? segment.name.replace('.wav', '_recombined.wav')
                : segment.name;
            a.download = downloadName;
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

    const handleSeek = (time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            audioRef.current.play();
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
                    <WaveformDisplay title="Before" data={segment.originalWaveform} color="#a8a29e" duration={segment.duration} onSeek={handleSeek} />
                    <i className="ph-bold ph-arrow-right text-slate-500 text-xl"></i>
                    <WaveformDisplay title="After" data={segment.processedWaveform} color="#fb923c" duration={segment.duration} onSeek={handleSeek} />
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

                {/* Vocal Separation Controls */}
                {!segment.isSeparated && onSeparateVocals && (
                    <button
                        onClick={handleSeparateVocals}
                        disabled={isSeparating}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isSeparating ? <i className="ph ph-spinner animate-spin"></i> : <i className="ph-bold ph-scissors"></i>}
                        <span>{isSeparating ? "Separating..." : "Separate Vocals"}</span>
                    </button>
                )}

                {/* Recombination Toggle */}
                {segment.isSeparated && (segment.instrumentalBlobUrl || globalInstrumentalFile) && (
                    <div className="p-3 bg-slate-700/50 rounded-md space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-slate-300 flex items-center">
                                <i className="ph-bold ph-disc mr-2 text-purple-400"></i>
                                Recombine with Instrumental
                            </span>
                            <input
                                type="checkbox"
                                checked={useRecombined}
                                onChange={(e) => setUseRecombined(e.target.checked)}
                                className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500 focus:ring-2"
                            />
                        </label>
                        <p className="text-xs text-slate-500">Download with instrumental track mixed back in</p>

                        {useRecombined && (
                            <div className="pt-2 border-t border-slate-600">
                                <EffectSlider
                                    label="Vocal Volume"
                                    icon="ph-microphone"
                                    value={vocalVolume * 100}
                                    max={200}
                                    step={1}
                                    unit="%"
                                    onChange={(val) => setVocalVolume(val / 100)}
                                />
                                <p className="text-xs text-slate-500 mt-1">Adjust vocal level in the mix</p>
                            </div>
                        )}
                    </div>
                )}

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

const Results: React.FC<{
    segments: AudioSegment[],
    onSegmentSettingsChange: (id: number, settings: Partial<Pick<AudioSegment, 'volume' | 'fadeInDuration' | 'fadeOutDuration'>>) => void;
    onSeparateVocals?: (segmentId: number, segmentFile: File) => Promise<void>;
    globalInstrumentalFile?: File | null;
}> = ({ segments, onSegmentSettingsChange, onSeparateVocals, globalInstrumentalFile }) => {
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
          <SegmentCard
            key={segment.id}
            segment={segment}
            onSettingsChange={onSegmentSettingsChange}
            onSeparateVocals={onSeparateVocals}
            globalInstrumentalFile={globalInstrumentalFile}
          />
        ))}
      </div>
    </section>
  );
};

export default Results;
