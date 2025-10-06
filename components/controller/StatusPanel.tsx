
import React from 'react';
import type { SkellyStatus } from '../../types';

interface StatusPanelProps {
  status: SkellyStatus;
}

const StatusItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="py-2">
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
    <p className="text-slate-200 font-medium">{value || '—'}</p>
  </div>
);

const StatusPanel: React.FC<StatusPanelProps> = ({ status }) => {
  return (
    <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700 p-4">
      <h3 className="text-lg font-bold text-slate-200 mb-2">Device Status</h3>
      <div className="grid grid-cols-2 gap-x-4 divide-y divide-slate-700/50">
        <StatusItem label="Device Name" value={status.deviceName} />
        <StatusItem label="Show Mode" value={status.showMode} />
        <StatusItem label="Volume" value={status.volume != null ? `${status.volume}%` : null} />
        <StatusItem label="BT Name" value={status.btName} />
        <StatusItem label="Capacity" value={status.capacity.kb != null ? `${status.capacity.kb} KB` : null} />
        <StatusItem label="Files" value={status.capacity.files} />
        <StatusItem label="Live Action" value={status.live.action} />
        <StatusItem label="Live Eye" value={status.live.eye} />
        <div className="col-span-2 py-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Channels</p>
            <p className="text-slate-200 font-medium">{status.channels.length > 0 ? status.channels.join(', ') : '—'}</p>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
