
import type { SkellyStatus } from '../types';

export function crc8(bytes: Uint8Array): string {
    let crc = 0;
    for (const b of bytes) {
        let x = crc ^ b;
        for (let i = 0; i < 8; i++) {
            x = (x & 1) ? ((x >>> 1) ^ 0x8C) : (x >>> 1);
        }
        crc = x & 0xFF;
    }
    return crc.toString(16).toUpperCase().padStart(2, '0');
}

export function hexToBytes(hex: string): Uint8Array {
    if (!hex) return new Uint8Array();
    const clean = hex.replace(/\s+/g, '');
    if (clean.length % 2 !== 0) throw new Error('Hex length must be even');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.substring(i * 2, 2), 16);
    }
    return out;
}

export const bytesToHex = (u8: Uint8Array): string => Array.from(u8, b => b.toString(16).toUpperCase().padStart(2, '0')).join('');

export const intToHex = (n: number, bytes: number): string => (n >>> 0).toString(16).toUpperCase().padStart(bytes * 2, '0').slice(-bytes * 2);

export function buildCmd(tag: string, payloadHex = '', minBytes = 8): Uint8Array {
    const p = (payloadHex || '').replace(/\s+/g, '').toUpperCase();
    const minLen = Math.max(0, (minBytes | 0) * 2);
    const padded = p.length < minLen ? p + '0'.repeat(minLen - p.length) : p;
    const base = 'AA' + tag.toUpperCase() + padded;
    const crc = crc8(hexToBytes(base));
    return hexToBytes(base + crc);
}

const getAscii = (hs: string): string => {
      const clean = hs.replace(/[^0-9A-F]/gi,'');
      const u8 = hexToBytes(clean);
      let out = '';
      for (const b of u8) if (b>=32 && b<=126) out += String.fromCharCode(b);
      return out.trim();
};

export function parseNotify(hex: string, updateStatus: (update: Partial<SkellyStatus>) => void) {
    const starts = (s: string) => hex.startsWith(s);
    
    if (starts('BBE5')) {
        const vol = parseInt(hex.slice(4, 6), 16);
        updateStatus({ volume: vol });
    } else if (starts('BBE6')) {
        const len = parseInt(hex.slice(4, 6), 16);
        const nameHex = hex.slice(6, 6 + len * 2);
        const btName = getAscii(nameHex);
        updateStatus({ btName });
    } else if (starts('BBE1')) {
        const action = parseInt(hex.slice(4, 6), 16);
        const eyeIcon = parseInt(hex.slice(90, 92), 16);
        updateStatus({ live: { action, eye: eyeIcon } });
    } else if (starts('BBE0')) {
        const channels = [4, 6, 8, 10, 12, 14].map(i => parseInt(hex.slice(i, i + 2), 16));
        const showMode = parseInt(hex.slice(40, 42), 16);
        const nameLen = parseInt(hex.slice(56, 58), 16);
        const name = getAscii(hex.slice(58, 58 + nameLen * 2));
        updateStatus({ channels, showMode, deviceName: name });
    } else if (starts('BBD2')) {
        const capacityKB = parseInt(hex.slice(4, 12), 16);
        const count = parseInt(hex.slice(12, 14), 16);
        updateStatus({ capacity: { kb: capacityKB, files: count } });
    }
}
