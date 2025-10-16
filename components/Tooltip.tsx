import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', delay = 200 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          x: rect.left + rect.width / 2,
          y: rect.top + window.scrollY
        });
        setIsVisible(true);
      }
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getPositionStyles = (): React.CSSProperties => {
    if (!tooltipRef.current) return {};

    const tooltipHeight = tooltipRef.current.offsetHeight;
    const tooltipWidth = tooltipRef.current.offsetWidth;

    switch (position) {
      case 'top':
        return {
          left: `${coords.x - tooltipWidth / 2}px`,
          top: `${coords.y - tooltipHeight - 10}px`,
        };
      case 'bottom':
        return {
          left: `${coords.x - tooltipWidth / 2}px`,
          top: `${coords.y + 10}px`,
        };
      case 'left':
        return {
          left: `${coords.x - tooltipWidth - 10}px`,
          top: `${coords.y - tooltipHeight / 2}px`,
        };
      case 'right':
        return {
          left: `${coords.x + 10}px`,
          top: `${coords.y - tooltipHeight / 2}px`,
        };
      default:
        return {};
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex items-center"
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 text-sm text-white bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-xs animate-fade-in"
          style={getPositionStyles()}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-slate-900 border-slate-700 transform rotate-45 ${
              position === 'top' ? 'bottom-[-5px] left-1/2 -translate-x-1/2 border-r border-b' :
              position === 'bottom' ? 'top-[-5px] left-1/2 -translate-x-1/2 border-l border-t' :
              position === 'left' ? 'right-[-5px] top-1/2 -translate-y-1/2 border-r border-t' :
              'left-[-5px] top-1/2 -translate-y-1/2 border-l border-b'
            }`}
          />
        </div>
      )}
    </>
  );
};

export const InfoTooltip: React.FC<{ content: string | React.ReactNode; position?: 'top' | 'bottom' | 'left' | 'right' }> = ({ content, position }) => {
  return (
    <Tooltip content={content} position={position}>
      <i className="ph-bold ph-info text-slate-400 hover:text-orange-400 cursor-help transition-colors ml-2"></i>
    </Tooltip>
  );
};

export default Tooltip;
