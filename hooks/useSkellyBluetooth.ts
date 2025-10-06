
import { useState, useRef, useCallback, useEffect } from 'react';
import type { LogEntry, SkellyStatus, Waiter } from '../types';
import { buildCmd, bytesToHex, parseNotify } from '../utils/bleUtils';
import { toast } from '../components/controller/Toast';

const SERVICE_UUID = '0000ae00-0000-1000-8000-00805f9b34fb';
const WRITE_UUID   = '0000ae01-0000-1000-8000-00805f9b34fb';
const NOTIFY_UUID  = '0000ae02-0000-1000-8000-00805f9b34fb';

const initialStatus: SkellyStatus = {
    deviceName: '',
    showMode: null,
    channels: [],
    btName: '',
    volume: null,
    live: { action: null, eye: null },
    capacity: { kb: null, files: null },
};

let logIdCounter = 0;

export default function useSkellyBluetooth() {
    // FIX: Use `any` for BluetoothDevice as type definitions are likely missing in this environment.
    const [device, setDevice] = useState<any | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [nameFilter, setNameFilter] = useState('Animated Skelly');
    const [log, setLog] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<SkellyStatus>(initialStatus);

    // FIX: Use `any` for BluetoothRemoteGATTCharacteristic as type definitions are likely missing.
    const writeCharRef = useRef<any | null>(null);
    // FIX: Use `any` for BluetoothRemoteGATTCharacteristic as type definitions are likely missing.
    const notifyCharRef = useRef<any | null>(null);
    const waitersRef = useRef<Waiter[]>([]);

    const addLog = useCallback((type: LogEntry['type'], message: string) => {
        setLog(prev => [
            ...prev.slice(-200), // Keep log from growing too large
            {
                id: logIdCounter++,
                type,
                message,
                timestamp: new Date().toLocaleTimeString(),
            },
        ]);
    }, []);

    const clearLog = useCallback(() => setLog([]), []);

    const onDisconnect = useCallback(() => {
        addLog('warn', 'Device disconnected.');
        setIsConnected(false);
        setIsConnecting(false);
        setDevice(null);
        writeCharRef.current = null;
        notifyCharRef.current = null;
        setStatus(initialStatus);
        // Clear any pending waiters
        waitersRef.current.forEach(w => {
            clearTimeout(w.timer);
            w.reject(new Error('Disconnected'));
        });
        waitersRef.current = [];
    }, [addLog]);

    const handleWaiters = useCallback((hex: string) => {
        waitersRef.current = waitersRef.current.filter(w => {
            if (hex.startsWith(w.prefix)) {
                clearTimeout(w.timer);
                w.resolve(hex);
                return false; // remove from list
            }
            return true;
        });
    }, []);

    const onNotify = useCallback((event: Event) => {
        // FIX: Use `any` for BluetoothRemoteGATTCharacteristic as type definitions are likely missing.
        const target = event.target as any;
        const value = target.value;
        if (!value) return;

        const hex = bytesToHex(new Uint8Array(value.buffer));
        addLog('rx', hex);

        try {
            parseNotify(hex, (newStatus) => {
                 setStatus(prev => ({...prev, ...newStatus}));
            });
            handleWaiters(hex);
        } catch (err) {
            console.error("Error parsing notification:", err);
            addLog('warn', `Error parsing notification: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, [addLog, handleWaiters]);

    const connect = useCallback(async () => {
        // FIX: Cast navigator to `any` to access the `bluetooth` property without type definitions.
        if (!(navigator as any).bluetooth) {
            toast.error("Web Bluetooth is not supported on this browser.");
            addLog('warn', 'Web Bluetooth not supported.');
            return;
        }

        try {
            addLog('info', 'Requesting Bluetooth device...');
            setIsConnecting(true);

            // FIX: Cast navigator to `any` to access the `bluetooth` property without type definitions.
            const bleDevice = await (navigator as any).bluetooth.requestDevice({
                filters: [{ namePrefix: nameFilter }],
                optionalServices: [SERVICE_UUID],
            });

            addLog('info', `Found: ${bleDevice.name}. Connecting to GATT server...`);
            setDevice(bleDevice);

            bleDevice.addEventListener('gattserverdisconnected', onDisconnect);
            const server = await bleDevice.gatt?.connect();
            addLog('info', 'GATT server connected. Getting service...');

            const service = await server?.getPrimaryService(SERVICE_UUID);
            addLog('info', 'Service found. Getting characteristics...');
            
            const writeChar = await service?.getCharacteristic(WRITE_UUID);
            const notifyChar = await service?.getCharacteristic(NOTIFY_UUID);

            if (!writeChar || !notifyChar) {
                throw new Error("Required characteristics not found.");
            }

            writeCharRef.current = writeChar;
            notifyCharRef.current = notifyChar;

            await notifyChar.startNotifications();
            notifyChar.addEventListener('characteristicvaluechanged', onNotify);

            setIsConnected(true);
            setIsConnecting(false);
            addLog('info', '✅ Successfully connected and listening for notifications.');
            toast.success(`Connected to ${bleDevice.name || 'Skelly'}`);

        } catch (error) {
            console.error("Connection failed:", error);
            const message = error instanceof Error ? error.message : String(error);
            addLog('warn', `Connection failed: ${message}`);
            toast.error(`Connection failed: ${message}`);
            setIsConnecting(false);
            onDisconnect();
        }
    }, [nameFilter, onDisconnect, onNotify, addLog]);

    const disconnect = useCallback(async () => {
        if (device?.gatt?.connected) {
            addLog('info', 'Disconnecting...');
            device.gatt.disconnect();
        }
        onDisconnect();
    }, [device, onDisconnect, addLog]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (device?.gatt?.connected) {
                device.gatt.disconnect();
            }
        };
    }, [device]);

    const send = useCallback(async (cmdBytes: Uint8Array) => {
        if (!isConnected || !writeCharRef.current) {
            addLog('warn', 'Cannot send: Not connected.');
            toast.error('Not connected');
            return;
        }
        try {
            const hex = bytesToHex(cmdBytes);
            addLog('tx', hex);
            await writeCharRef.current.writeValue(cmdBytes);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            addLog('warn', `Send error: ${message}`);
            toast.error(`Send error: ${message}`);
        }
    }, [isConnected, addLog]);
    
    const sendCommand = useCallback((tag: string, payloadHex = '', minBytes = 8) => {
        try {
            const cmd = buildCmd(tag, payloadHex, minBytes);
            return send(cmd);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            addLog('warn', `Invalid command: ${message}`);
            toast.error(`Invalid command: ${message}`);
        }
    }, [send, addLog]);

    return {
        isConnected,
        isConnecting,
        device,
        log,
        status,
        nameFilter,
        setNameFilter,
        connect,
        disconnect,
        clearLog,
        sendCommand
    };
}