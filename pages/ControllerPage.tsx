
import React from 'react';
import useSkellyBluetooth from '../hooks/useSkellyBluetooth';
import ConnectionPanel from '../components/controller/ConnectionPanel';
import StatusPanel from '../components/controller/StatusPanel';
import LogPanel from '../components/controller/LogPanel';
import { ToastContainer } from '../components/controller/Toast';
import CommandPanel from '../components/controller/CommandPanel';

const ControllerPage: React.FC = () => {
  const ble = useSkellyBluetooth();

  return (
    <div className="w-full h-full flex flex-col space-y-4">
        <h2 className="text-3xl font-bold text-slate-100">Skelly Controller</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-grow">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-4 flex flex-col">
                <ConnectionPanel
                    isConnected={ble.isConnected}
                    isConnecting={ble.isConnecting}
                    connect={ble.connect}
                    disconnect={ble.disconnect}
                    nameFilter={ble.nameFilter}
                    setNameFilter={ble.setNameFilter}
                />
                <StatusPanel status={ble.status} />
                <div className="flex-grow min-h-[200px]">
                    <LogPanel log={ble.log} clearLog={ble.clearLog} />
                </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-4">
                <CommandPanel ble={ble} />
            </div>
        </div>
        <ToastContainer />
    </div>
  );
};

export default ControllerPage;
