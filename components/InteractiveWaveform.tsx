import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

interface InteractiveWaveformProps {
  audioUrl: string;
  onRegionChange: (region: Region | null) => void;
  activationThreshold: number;
  showActivationOverlay: boolean;
  audioRef?: React.RefObject<HTMLAudioElement>;
}

const InteractiveWaveform: React.FC<InteractiveWaveformProps> = ({ audioUrl, onRegionChange, activationThreshold, showActivationOverlay, audioRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Use a ref to hold the latest callback function to avoid stale closures in the main useEffect
  const onRegionChangeRef = useRef(onRegionChange);
  useEffect(() => {
    onRegionChangeRef.current = onRegionChange;
  }, [onRegionChange]);

  const drawOverlay = (ws: WaveSurfer) => {
    const canvas = overlayCanvasRef.current;
    const parent = containerRef.current;
    if (!canvas || !parent) return;

    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = 150; // Must match wavesurfer height
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Only draw overlay if enabled
    if (!showActivationOverlay) return;

    const peaks = ws.getDecodedData()?.getChannelData(0);
    if (!peaks) return;

    const step = Math.ceil(peaks.length / width);
    const halfHeight = height / 2;

    ctx.fillStyle = '#fb923c'; // orange-400

    for (let i = 0; i < width; i++) {
        let max = 0;
        for (let j = 0; j < step; j++) {
            const sample = Math.abs(peaks[(i * step) + j] || 0);
            if (sample > max) max = sample;
        }

        if (max >= activationThreshold) {
            const barHeight = Math.max(1, max * height);
            ctx.fillRect(i, halfHeight - barHeight / 2, 1, barHeight);
        }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#64748b', // slate-500
      progressColor: '#f87171', // red-400
      height: 150,
      barWidth: 1,
      barGap: undefined, // Let wavesurfer decide
      cursorWidth: 2,
      cursorColor: '#f87171',
    });

    wavesurferRef.current = ws;

    const wsRegions = ws.registerPlugin(RegionsPlugin.create());

    // Clear all existing regions before creating a new one
    wsRegions.on('region-created', (region) => {
        console.log('[InteractiveWaveform] Region created:', region.start, '-', region.end);
        // Remove all other regions
        wsRegions.getRegions().forEach(r => {
            if (r.id !== region.id) {
                console.log('[InteractiveWaveform] Removing old region:', r.id);
                r.remove();
            }
        });
        // Style the region for better visibility
        region.setOptions({
            color: 'rgba(34, 211, 238, 0.4)', // cyan-500 with more opacity
            drag: true,
            resize: true,
        });
        onRegionChangeRef.current(region);
    });

    wsRegions.on('region-updated', (region) => {
        console.log('[InteractiveWaveform] Region updated:', region.start, '-', region.end);
        onRegionChangeRef.current(region);
    });

    wsRegions.on('region-removed', () => {
        console.log('[InteractiveWaveform] Region removed');
        onRegionChangeRef.current(null);
    });

    ws.on('ready', () => {
        console.log('[InteractiveWaveform] Waveform ready');
        setIsReady(true);
        wsRegions.enableDragSelection({
            color: 'rgba(34, 211, 238, 0.3)', // cyan-500 with opacity
        });
        drawOverlay(ws);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    ws.on('redraw', () => drawOverlay(ws));
    ws.on('zoom', () => drawOverlay(ws));

    // Sync with external audio element if provided
    if (audioRef?.current) {
        audioRef.current.addEventListener('play', () => {
            ws.play();
        });
        audioRef.current.addEventListener('pause', () => {
            ws.pause();
        });
        audioRef.current.addEventListener('seeked', () => {
            ws.seekTo(audioRef.current!.currentTime / ws.getDuration());
        });
    }

    return () => {
      try {
        ws.destroy();
      } catch (e) {
        // Ignore AbortError on cleanup
      }
    };
  }, []); // Empty dependency array ensures this runs only once

  useEffect(() => {
    if (wavesurferRef.current && audioUrl) {
        wavesurferRef.current.load(audioUrl);
    }
  }, [audioUrl]);

  // Redraw overlay when sensitivity or toggle changes
  useEffect(() => {
    if (wavesurferRef.current?.isReady) {
        drawOverlay(wavesurferRef.current);
    }
  }, [activationThreshold, showActivationOverlay]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleClearRegion = () => {
    console.log('[InteractiveWaveform] Clear region button clicked');
    if (wavesurferRef.current) {
      const ws = wavesurferRef.current;
      const regions = ws.getPlugin('regions');
      if (regions) {
        regions.getRegions().forEach((r: Region) => {
          console.log('[InteractiveWaveform] Clearing region:', r.id);
          r.remove();
        });
        onRegionChange(null);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative w-full h-[150px]">
        {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 z-20">
                <p className="text-slate-400">Loading waveform...</p>
            </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
        <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" />
      </div>

      {/* Integrated playback controls */}
      <div className="flex items-center justify-center space-x-3">
        <button
          onClick={handlePlayPause}
          disabled={!isReady}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2">
          <i className={`ph-bold ${isPlaying ? 'ph-pause' : 'ph-play'}`}></i>
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>
        <button
          onClick={handleClearRegion}
          disabled={!isReady}
          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2">
          <i className="ph-bold ph-x"></i>
          <span>Clear Selection</span>
        </button>
      </div>
    </div>
  );
};

export default InteractiveWaveform;
