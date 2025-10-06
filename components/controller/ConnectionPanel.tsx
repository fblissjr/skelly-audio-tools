
import React from 'react';

interface ConnectionPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  nameFilter: string;
  setNameFilter: (filter: string) => void;
}

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  isConnected,
  isConnecting,
  connect,
  disconnect,
  nameFilter,
  setNameFilter,
}) => {
  const statusText = isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected';
  const statusColor = isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-200">Connection</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${statusColor} transition-colors`}></div>
          <span className="text-sm font-medium text-slate-300">{statusText}</span>
        </div>
      </div>
      
      {!isConnected && (
        <div className="mb-4">
            <label htmlFor="nameFilter" className="block text-sm font-medium text-slate-400 mb-1">
                Filter by name (optional)
            </label>
            <input
                id="nameFilter"
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Animated Skelly"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                disabled={isConnecting}
            />
        </div>
      )}

      <div className="flex space-x-2">
        {!isConnected ? (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="w-full px-4 py-2 font-bold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Scanning...' : 'Connect'}
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="w-full px-4 py-2 font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
};

export default ConnectionPanel;
