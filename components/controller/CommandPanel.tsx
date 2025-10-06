
import React, { useState } from 'react';
import type useSkellyBluetooth from '../../hooks/useSkellyBluetooth';
import { intToHex } from '../../utils/bleUtils';

type SkellyHook = ReturnType<typeof useSkellyBluetooth>;

interface CommandPanelProps {
  ble: SkellyHook;
}

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700 p-4">
    <h3 className="text-lg font-bold text-slate-200 mb-4">{title}</h3>
    {children}
  </div>
);

const CommandButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button
        onClick={onClick}
        className="px-4 py-2 text-sm font-semibold bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
    >
        {children}
    </button>
);

const CommandPanel: React.FC<CommandPanelProps> = ({ ble }) => {
    const [volume, setVolume] = useState(50);

    const handleSetVolume = () => {
        const volValue = Math.max(0, Math.min(100, volume));
        // The device expects a value from 0-255, but the UI shows 0-100.
        // The original JS app maps 100% to a value of 255. Let's replicate that.
        const deviceVolume = Math.round((volValue / 100) * 255);
        ble.sendCommand?.('FA', intToHex(deviceVolume, 1), 8);
    };

    if (!ble.isConnected) {
        return (
            <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700 p-8 flex items-center justify-center text-center h-full">
                <div className="max-w-xs">
                    <i className="ph-bold ph-plugs text-5xl text-slate-600 mb-4"></i>
                    <h3 className="text-xl font-bold text-slate-300">Not Connected</h3>
                    <p className="text-slate-400 mt-2">
                        Please connect to a Skelly device using the connection panel to access controls.
                    </p>
                </div>
            </div>
        );
    }
    
  return (
    <div className="space-y-4">
      <Card title="Quick Queries">
        <div className="flex flex-wrap gap-2">
            <CommandButton onClick={() => ble.sendCommand('E0', '', 8)}>Get Device Params</CommandButton>
            <CommandButton onClick={() => ble.sendCommand('E1', '', 8)}>Get Live Mode</CommandButton>
            <CommandButton onClick={() => ble.sendCommand('E5', '', 8)}>Get Volume</CommandButton>
            <CommandButton onClick={() => ble.sendCommand('E6', '', 8)}>Get BT Name</CommandButton>
            <CommandButton onClick={() => ble.sendCommand('EE', '', 8)}>Get Version</CommandButton>
            <CommandButton onClick={() => ble.sendCommand('D2', '', 8)}>Get Capacity</CommandButton>
        </div>
      </Card>
      <Card title="Media & Volume">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <h4 className="font-semibold text-slate-300">Playback</h4>
                <div className="flex flex-wrap gap-2">
                    <CommandButton onClick={() => ble.sendCommand('FC', '01', 8)}>Play</CommandButton>
                    <CommandButton onClick={() => ble.sendCommand('FC', '00', 8)}>Pause</CommandButton>
                    <CommandButton onClick={() => ble.sendCommand('FD', '01', 8)}>Enable Classic BT</CommandButton>
                </div>
            </div>
            <div className="space-y-2">
                <label htmlFor="volume" className="font-semibold text-slate-300">
                    Volume: <span className="font-mono text-orange-400">{volume}%</span>
                </label>
                <div className="flex items-center gap-2">
                     <input
                        id="volume"
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                     />
                    <CommandButton onClick={handleSetVolume}>Set</CommandButton>
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default CommandPanel;
