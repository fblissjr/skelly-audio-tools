import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

interface InteractiveWaveformProps {
  audioUrl: string;
  onRegionChange: (region: Region | null) => void;
}

const InteractiveWaveform: React.FC<InteractiveWaveformProps> = ({ audioUrl, onRegionChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#a8a29e', // stone-400
      progressColor: '#fb923c', // orange-400
      height: 150,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 2,
      cursorColor: '#f87171', // red-400
    });

    wavesurferRef.current = ws;

    const wsRegions = ws.registerPlugin(RegionsPlugin.create());

    let activeRegion: Region | null = null;

    // When a new region is created, ensure only one exists at a time
    wsRegions.on('region-created', (region) => {
        // Clear all other regions
        wsRegions.getRegions().forEach(r => {
            if (r.id !== region.id) {
                r.remove();
            }
        });
        activeRegion = region;
        onRegionChange(activeRegion);
    });

    // When a region is updated (dragged, resized)
    wsRegions.on('region-updated', (region) => {
        activeRegion = region;
        onRegionChange(activeRegion);
    });

    // Clear region on click outside
    ws.on('interaction', () => {
        if (activeRegion) {
            activeRegion.remove();
            activeRegion = null;
            onRegionChange(null);
        }
    });

    ws.on('ready', () => {
        setIsReady(true);
        // Enable region creation via dragging
        wsRegions.enableDragSelection({});
    });

    return () => {
      ws.destroy();
    };
  }, [onRegionChange]);

  useEffect(() => {
    if (wavesurferRef.current && audioUrl) {
      setIsReady(false);
      wavesurferRef.current.load(audioUrl);
    }
  }, [audioUrl]);

  return (
    <div className="relative w-full">
        {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 z-10">
                <p className="text-slate-400">Loading waveform...</p>
            </div>
        )}
        <div ref={containerRef} />
    </div>
  );
};

export default InteractiveWaveform;
