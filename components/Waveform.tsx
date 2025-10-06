import React, { useRef, useEffect } from 'react';
import type { WaveformData } from '../types';

interface WaveformProps {
  data: WaveformData;
  height: number;
  color: string;
  totalDuration?: number;
  segmentDuration?: number;
}

const Waveform: React.FC<WaveformProps> = ({ data, height, color, totalDuration, segmentDuration }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !data || data.length === 0) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const drawWaveform = (width: number) => {
      // For HiDPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.scale(dpr, dpr);

      context.clearRect(0, 0, width, height);

      // Draw segment previews if duration is provided
      if (totalDuration && segmentDuration && totalDuration > 0) {
          const segmentWidthPx = (segmentDuration / totalDuration) * width;
          const numSegments = Math.ceil(totalDuration / segmentDuration);

          for (let i = 0; i < numSegments; i++) {
              const x = i * segmentWidthPx;

              // Draw alternating background color for segments
              if (i % 2 === 1) { 
                  context.fillStyle = 'rgba(0, 0, 0, 0.15)';
                  context.fillRect(x, 0, segmentWidthPx, height);
              }

              // Draw vertical line separator (starting after the first segment)
              if (i > 0) {
                  context.beginPath();
                  context.moveTo(x, 0);
                  context.lineTo(x, height);
                  context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                  context.lineWidth = 1;
                  context.stroke();
              }
          }
      }

      // Draw the waveform line
      context.lineWidth = 2;
      context.strokeStyle = color;
      context.beginPath();

      const sliceWidth = width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = data[i] || 0;
        
        const lineY = Math.max(height / 2 - (v * height / 2), height / 2 + (v * height / 2)) - (v * height);

        if (i === 0) {
          context.moveTo(x, height / 2);
        } else {
          context.lineTo(x, lineY);
        }
        x += sliceWidth;
      }
      context.lineTo(width, height / 2); // Connect back to the center line
      
      context.stroke();
    };

    const resizeObserver = new ResizeObserver(entries => {
      if (!Array.isArray(entries) || !entries.length) {
        return;
      }
      const newWidth = entries[0].contentRect.width;
      if (newWidth > 0) {
        drawWaveform(newWidth);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };

  }, [data, height, color, totalDuration, segmentDuration]);

  return (
    <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }}>
      <canvas ref={canvasRef} aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
};

export default Waveform;