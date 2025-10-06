
export type WaveformData = number[];

export interface AudioSegment {
  id: number;
  name: string;
  blobUrl: string;
  duration: number;
  startTime: number;
  originalWaveform: WaveformData;
  processedWaveform: WaveformData;
  volume: number; // Volume multiplier, 1.0 is default
  fadeInDuration: number; // in seconds
  fadeOutDuration: number; // in seconds
}

export interface ProcessedAudioResult {
    segments: AudioSegment[];
    originalFullWaveform: WaveformData;
}

// Types for Skelly Controller
export interface LogEntry {
  id: number;
  type: 'tx' | 'rx' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

export interface SkellyStatus {
  deviceName: string;
  showMode: number | null;
  channels: number[];
  btName: string;
  volume: number | null;
  live: { 
    action: number | null;
    eye: number | null; 
  };
  capacity: {
    kb: number | null;
    files: number | null;
  };
}

export interface SkellyFile {
  serial: number;
  cluster: number;
  total: number;
  length: number;
  attr: number;
  eye: number | null;
  db: number | null;
  name: string;
}

export interface Waiter {
  prefix: string;
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
  timer: number;
}