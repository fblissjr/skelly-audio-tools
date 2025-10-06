import React, { useRef, useEffect } from 'react';
import type { WaveformData } from '../types';

interface WaveformProps {
  data: WaveformData;
  width: number;
  height: number;
  color: string;
  totalDuration?: number;
  segmentDuration?: number;
}

const Waveform: React.FC<WaveformProps> = ({ data, width, height, color, totalDuration, segmentDuration }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const context = canvas.getContext('2d');
    if (!context) return;
    
    // For HiDPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
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
      const y = (1 - v) * height / 2;
      
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

  }, [data, width, height, color, totalDuration, segmentDuration]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
};

export default Waveform;