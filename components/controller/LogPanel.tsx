
import React, { useRef, useEffect } from 'react';
import type { LogEntry } from '../../types';

interface LogPanelProps {
  log: LogEntry[];
  clearLog: () => void;
}

const logTypeClasses = {
  tx: 'text-green-400',
  rx: 'text-sky-400',
  warn: 'text-yellow-400',
  info: 'text-slate-400',
};

const LogPanel: React.FC<LogPanelProps> = ({ log, clearLog }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700 p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-slate-200">Log</h3>
        <button onClick={clearLog} className="px-2 py-1 text-xs font-semibold text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors">
          Clear
        </button>
      </div>
      <div
        ref={logContainerRef}
        className="flex-grow bg-slate-900/70 rounded-md p-2 overflow-y-auto font-mono text-xs"
        aria-live="polite"
      >
        {log.map((entry) => (
          <div key={entry.id} className="flex">
            <span className="text-slate-500 mr-2">{entry.timestamp}</span>
            <span className={`flex-shrink-0 font-bold w-8 ${logTypeClasses[entry.type]}`}>
              {`[${entry.type.toUpperCase()}]`}
            </span>
            <p className={`whitespace-pre-wrap break-all ${logTypeClasses[entry.type]}`}>
              {entry.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogPanel;
