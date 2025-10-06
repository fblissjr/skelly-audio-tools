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

  // Use a ref to hold the latest callback function to avoid stale closures in the main useEffect
  const onRegionChangeRef = useRef(onRegionChange);
  useEffect(() => {
    onRegionChangeRef.current = onRegionChange;
  }, [onRegionChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#a8a29e',
      progressColor: '#fb923c',
      height: 150,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
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

    ws.on('interaction', () => {
        // This logic is to clear the region, but it might be better handled in the parent
    });

    ws.on('ready', () => {
        setIsReady(true);
        wsRegions.enableDragSelection({});
    });

    // The cleanup function will now only be called when the component truly unmounts
    return () => {
      ws.destroy();
    };
  }, []); // Empty dependency array ensures this runs only once

  useEffect(() => {
    if (wavesurferRef.current?.isReady && audioUrl) {
        wavesurferRef.current.load(audioUrl);
    } else if (wavesurferRef.current && audioUrl) {
        // If not ready, the 'ready' event will trigger the load
        // but we can load it here if it's the initial load
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
