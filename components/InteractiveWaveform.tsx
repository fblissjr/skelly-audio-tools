import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

interface InteractiveWaveformProps {
  audioUrl: string;
  onRegionChange: (region: Region | null) => void;
  activationThreshold: number;
}

const InteractiveWaveform: React.FC<InteractiveWaveformProps> = ({ audioUrl, onRegionChange, activationThreshold }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Use a ref to hold the latest callback function to avoid stale closures in the main useEffect
  const onRegionChangeRef = useRef(onRegionChange);
  useEffect(() => {
    onRegionChangeRef.current = onRegionChange;
  }, [onRegionChange]);

  const drawOverlay = (ws: WaveSurfer) => {
    const canvas = overlayCanvasRef.current;
    const parent = containerRef.current;
    if (!canvas || !parent) return;

    const peaks = ws.getDecodedData()?.getChannelData(0);
    if (!peaks) return;

    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = 150; // Must match wavesurfer height
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

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

    wsRegions.on('region-created', (region) => {
        wsRegions.getRegions().forEach(r => {
            if (r.id !== region.id) r.remove();
        });
        onRegionChangeRef.current(region);
    });

    wsRegions.on('region-updated', (region) => {
        onRegionChangeRef.current(region);
    });

    ws.on('ready', () => {
        setIsReady(true);
        wsRegions.enableDragSelection({});
        drawOverlay(ws);
    });

    ws.on('redraw', () => drawOverlay(ws));
    ws.on('zoom', () => drawOverlay(ws));

    return () => {
      ws.destroy();
    };
  }, []); // Empty dependency array ensures this runs only once

  useEffect(() => {
    if (wavesurferRef.current && audioUrl) {
        wavesurferRef.current.load(audioUrl);
    }
  }, [audioUrl]);

  // Redraw overlay when sensitivity changes
  useEffect(() => {
    if (wavesurferRef.current?.isReady) {
        drawOverlay(wavesurferRef.current);
    }
  }, [activationThreshold]);

  return (
    <div className="relative w-full h-[150px]">
        {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 z-20">
                <p className="text-slate-400">Loading waveform...</p>
            </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
        <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" />
    </div>
  );
};

export default InteractiveWaveform;
