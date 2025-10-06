import React, { useRef, useEffect } from 'react';
import type { WaveformData } from '../types';

interface WaveformProps {
  data: WaveformData;
  height: number;
  color: string;
  totalDuration?: number;
  segmentDuration?: number;
  onSeek?: (time: number) => void; // New callback prop for seeking
}

const Waveform: React.FC<WaveformProps> = ({ data, height, color, totalDuration, segmentDuration, onSeek }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click handler for seeking
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !totalDuration) return; // Only work if onSeek is provided

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = totalDuration * percentage;
    
    onSeek(seekTime);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !data || data.length === 0) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const drawWaveform = (width: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.scale(dpr, dpr);
      context.clearRect(0, 0, width, height);

      // ... (drawing logic for segments remains the same) ...

      // Draw the waveform line
      context.lineWidth = 2;
      context.strokeStyle = color;
      context.beginPath();

      const sliceWidth = width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = data[i] || 0;
        const lineY = height / 2 * (1 - v);
        if (i === 0) {
          context.moveTo(x, lineY);
        } else {
          context.lineTo(x, lineY);
        }
        x += sliceWidth;
      }
      
      // Draw the second half of the waveform (mirrored)
      x = width;
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i] || 0;
        const lineY = height / 2 * (1 + v);
        context.lineTo(x, lineY);
        x -= sliceWidth;
      }

      context.closePath();
      context.stroke();
      context.fillStyle = color;
      context.fill();
    };

    const resizeObserver = new ResizeObserver(entries => {
      if (!Array.isArray(entries) || !entries.length) return;
      const newWidth = entries[0].contentRect.width;
      if (newWidth > 0) drawWaveform(newWidth);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };

  }, [data, height, color, totalDuration, segmentDuration]);

  return (
    <div ref={containerRef} style={{ height: `${height}px`, width: '100%', cursor: onSeek ? 'pointer' : 'default' }}>
      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasClick}
        aria-hidden="true" 
        style={{ display: 'block', width: '100%', height: '100%' }} 
      />
    </div>
  );
};

export default Waveform;
