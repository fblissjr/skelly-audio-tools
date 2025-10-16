import React, { useState, useCallback, useEffect } from 'react';
import { getAudio, getAllAudioRecords, deleteAudio } from '../services/database';

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL?.replace('/get-audio-url', '') || 'http://localhost:8000';

declare const JSZip: any;

interface AudioSource {
  id: string;
  name: string;
  file?: File;
  type: 'file' | 'youtube';
}

interface ProcessedAudio {
  id: string;
  sourceName: string;
  originalUrl: string;
  vocalsUrl: string;
  instrumentalUrl: string;
  yoloMixUrl: string;
  timestamp: number;
  stats: {
    originalPeakDb: number;
    vocalsPeakDb: number;
    yoloPeakDb: number;
    processingTime: number;
  };
}

interface QueueItem extends AudioSource {
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: string;
  error?: string;
  result?: ProcessedAudio;
}

const BatchYoloProcessor: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processedResults, setProcessedResults] = useState<ProcessedAudio[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showYouTubeHistory, setShowYouTubeHistory] = useState(false);
  const [youtubeCache, setYoutubeCache] = useState<any[]>([]);

  // Load YouTube cache
  useEffect(() => {
    loadYouTubeCache();
  }, []);

  const loadYouTubeCache = async () => {
    const records = await getAllAudioRecords();
    setYoutubeCache(records);
  };

  const addToQueue = useCallback((sources: AudioSource[]) => {
    const newItems: QueueItem[] = sources.map(source => ({
      ...source,
      status: 'pending',
      progress: 'Waiting in queue...'
    }));
    setQueue(prev => [...prev, ...newItems]);
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const sources: AudioSource[] = Array.from(files).map((file, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      name: file.name,
      file,
      type: 'file'
    }));

    addToQueue(sources);
  }, [addToQueue]);

  const addYouTubeFromCache = useCallback((videoId: string, title: string) => {
    const source: AudioSource = {
      id: `youtube-${videoId}`,
      name: title,
      type: 'youtube'
    };
    addToQueue([source]);
  }, [addToQueue]);

  const calculateAudioStats = async (audioBuffer: AudioBuffer): Promise<number> => {
    // Calculate peak dB
    let peak = 0;
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const data = audioBuffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        peak = Math.max(peak, Math.abs(data[i]));
      }
    }
    return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  };

  const processItem = async (item: QueueItem): Promise<ProcessedAudio> => {
    const startTime = Date.now();

    // Update progress
    const updateProgress = (msg: string) => {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: msg } : q));
    };

    updateProgress('Loading audio file...');

    // Get audio file
    let audioFile: File;
    if (item.type === 'file' && item.file) {
      audioFile = item.file;
    } else if (item.type === 'youtube') {
      // Load from IndexedDB
      const cached = await getAudio(item.id.replace('youtube-', ''));
      if (!cached) throw new Error('YouTube audio not found in cache');
      audioFile = new File([cached.data], `${cached.title}.mp3`, { type: 'audio/mpeg' });
    } else {
      throw new Error('Invalid audio source');
    }

    // Get original audio stats
    updateProgress('Analyzing original audio...');
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const originalArrayBuffer = await audioFile.arrayBuffer();
    const originalBuffer = await audioContext.decodeAudioData(originalArrayBuffer.slice(0));
    const originalPeakDb = await calculateAudioStats(originalBuffer);
    const originalUrl = URL.createObjectURL(audioFile);

    // Separate vocals
    updateProgress('Separating vocals using AI (this takes 1-2 minutes)...');
    const formData = new FormData();
    formData.append('file', audioFile);

    const response = await fetch(`${BACKEND_BASE_URL}/separate-vocals`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Vocal separation failed');
    }

    updateProgress('Extracting separated tracks...');
    const blob = await response.blob();
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(blob);

    const vocalsBlob = await zipContent.file('vocals.wav').async('blob');
    const instrumentalBlob = await zipContent.file('instrumental.wav').async('blob');

    const vocalsFile = new File([vocalsBlob], 'vocals.wav', { type: 'audio/wav' });
    const instrumentalFile = new File([instrumentalBlob], 'instrumental.wav', { type: 'audio/wav' });

    // Calculate vocals peak
    const vocalsArrayBuffer = await vocalsFile.arrayBuffer();
    const vocalsBuffer = await audioContext.decodeAudioData(vocalsArrayBuffer);
    const vocalsPeakDb = await calculateAudioStats(vocalsBuffer);

    // Create YOLO Mix
    updateProgress('Creating YOLO Mix (vocals 120%, instrumental 25%)...');
    const instrumentalArrayBuffer = await instrumentalFile.arrayBuffer();
    const instrumentalBuffer = await audioContext.decodeAudioData(instrumentalArrayBuffer);

    const vocalGain = 1.2;
    const instrumentalGain = 0.25;

    const maxLength = Math.max(vocalsBuffer.length, instrumentalBuffer.length);
    const numberOfChannels = Math.max(vocalsBuffer.numberOfChannels, instrumentalBuffer.numberOfChannels);
    const sampleRate = vocalsBuffer.sampleRate;

    const mixedBuffer = audioContext.createBuffer(numberOfChannels, maxLength, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const mixedData = mixedBuffer.getChannelData(channel);
      const vocalsData = channel < vocalsBuffer.numberOfChannels ? vocalsBuffer.getChannelData(channel) : null;
      const instData = channel < instrumentalBuffer.numberOfChannels ? instrumentalBuffer.getChannelData(channel) : null;

      for (let i = 0; i < maxLength; i++) {
        let sample = 0;
        if (vocalsData && i < vocalsBuffer.length) sample += vocalsData[i] * vocalGain;
        if (instData && i < instrumentalBuffer.length) sample += instData[i] * instrumentalGain;
        sample = Math.max(-1, Math.min(1, sample)); // Soft clip
        mixedData[i] = sample;
      }
    }

    const yoloPeakDb = await calculateAudioStats(mixedBuffer);

    // Convert to WAV
    updateProgress('Converting YOLO Mix to WAV...');
    const wavBlob = await bufferToWave(mixedBuffer, sampleRate);

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      id: item.id,
      sourceName: item.name,
      originalUrl,
      vocalsUrl: URL.createObjectURL(vocalsFile),
      instrumentalUrl: URL.createObjectURL(instrumentalFile),
      yoloMixUrl: URL.createObjectURL(wavBlob),
      timestamp: Date.now(),
      stats: {
        originalPeakDb,
        vocalsPeakDb,
        yoloPeakDb,
        processingTime
      }
    };
  };

  const bufferToWave = (buffer: AudioBuffer, sampleRate: number): Promise<Blob> => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels = [];
    let offset = 0;

    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };

    writeString('RIFF');
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, buffer.numberOfChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * buffer.numberOfChannels * 2, true); offset += 4;
    view.setUint16(offset, buffer.numberOfChannels * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString('data');
    view.setUint32(offset, length - offset - 4, true); offset += 4;

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let index = 0;
    while (index < buffer.length) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][index]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
      index++;
    }

    return Promise.resolve(new Blob([arrayBuffer], { type: 'audio/wav' }));
  };

  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;

    setIsProcessing(true);

    for (const item of queue) {
      if (item.status !== 'pending') continue;

      // Mark as processing
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' as const } : q));

      try {
        const result = await processItem(item);

        // Mark as completed
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed' as const, result } : q));
        setProcessedResults(prev => [...prev, result]);

      } catch (error: any) {
        console.error(`Error processing ${item.name}:`, error);
        setQueue(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'error' as const, error: error.message } : q
        ));
      }
    }

    setIsProcessing(false);
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const deleteResult = (id: string) => {
    const result = processedResults.find(r => r.id === id);
    if (result) {
      // Revoke blob URLs
      URL.revokeObjectURL(result.originalUrl);
      URL.revokeObjectURL(result.vocalsUrl);
      URL.revokeObjectURL(result.instrumentalUrl);
      URL.revokeObjectURL(result.yoloMixUrl);
    }
    setProcessedResults(prev => prev.filter(r => r.id !== id));
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const clearCompleted = () => {
    setQueue(prev => prev.filter(q => q.status !== 'completed' && q.status !== 'error'));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <i className="ph-bold ph-magic-wand text-3xl text-purple-400"></i>
              <h2 className="text-2xl font-bold text-purple-300">Batch YOLO Processor</h2>
              <span className="px-3 py-1 bg-purple-500/30 text-purple-200 text-sm rounded-full font-semibold">AUTO-MAGIC</span>
            </div>
            <p className="text-slate-400 mt-2">Queue multiple files and let YOLO mode process them automatically</p>
          </div>
        </div>
      </div>

      {/* Upload & Queue Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* File Upload */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <label className="block">
            <div className="flex items-center space-x-2 mb-2">
              <i className="ph-bold ph-upload-simple text-xl text-blue-400"></i>
              <span className="font-semibold text-slate-200">Upload Files</span>
            </div>
            <input
              type="file"
              multiple
              accept="audio/*,video/*"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
            <p className="text-xs text-slate-500 mt-1">Select multiple audio or video files</p>
          </div>
        </div>

        {/* YouTube Cache */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <button
            onClick={() => setShowYouTubeHistory(!showYouTubeHistory)}
            className="w-full flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <i className="ph-bold ph-youtube-logo text-xl text-red-400"></i>
              <span className="font-semibold text-slate-200">YouTube Cache ({youtubeCache.length})</span>
            </div>
            <i className={`ph-bold ph-caret-${showYouTubeHistory ? 'up' : 'down'} text-slate-400`}></i>
          </button>
          {showYouTubeHistory && youtubeCache.length > 0 && (
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {youtubeCache.map(record => (
                <div key={record.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-sm text-slate-300 truncate flex-1">{record.title}</span>
                  <button
                    onClick={() => addYouTubeFromCache(record.id, record.title)}
                    className="ml-2 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-500">
                    Add to Queue
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-200">
              Processing Queue ({queue.filter(q => q.status === 'pending').length} pending)
            </h3>
            <div className="flex space-x-2">
              {!isProcessing && queue.some(q => q.status === 'pending') && (
                <button
                  onClick={processQueue}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-500">
                  <i className="ph-bold ph-play mr-2"></i>
                  Start Processing
                </button>
              )}
              <button
                onClick={clearCompleted}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">
                Clear Completed
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {queue.map(item => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${
                  item.status === 'processing' ? 'bg-purple-900/20 border-purple-500' :
                  item.status === 'completed' ? 'bg-green-900/20 border-green-500' :
                  item.status === 'error' ? 'bg-red-900/20 border-red-500' :
                  'bg-slate-700/50 border-slate-600'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {item.status === 'processing' && <i className="ph-bold ph-spinner animate-spin text-purple-400"></i>}
                      {item.status === 'completed' && <i className="ph-bold ph-check-circle text-green-400"></i>}
                      {item.status === 'error' && <i className="ph-bold ph-x-circle text-red-400"></i>}
                      {item.status === 'pending' && <i className="ph-bold ph-clock text-slate-400"></i>}
                      <span className="font-semibold text-slate-200">{item.name}</span>
                      <span className="text-xs text-slate-500">({item.type})</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{item.progress}</p>
                    {item.error && <p className="text-sm text-red-400 mt-1">Error: {item.error}</p>}
                  </div>
                  {(item.status === 'pending' || item.status === 'error') && (
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 text-sm">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed Results */}
      {processedResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-200">Processed Files ({processedResults.length})</h3>
          {processedResults.map(result => (
            <ProcessedResult
              key={result.id}
              result={result}
              onDelete={deleteResult}
              onDownload={downloadFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Processed Result Component
const ProcessedResult: React.FC<{
  result: ProcessedAudio;
  onDelete: (id: string) => void;
  onDownload: (url: string, filename: string) => void;
}> = ({ result, onDelete, onDownload }) => {
  const [expanded, setExpanded] = useState(false);

  const formatDb = (db: number) => {
    if (db === -Infinity) return '-∞ dB';
    return `${db.toFixed(1)} dB`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center space-x-3 flex-1">
          <i className="ph-bold ph-waveform text-2xl text-purple-400"></i>
          <div>
            <h4 className="font-semibold text-slate-200">{result.sourceName}</h4>
            <p className="text-xs text-slate-500">Processed {formatTime(result.stats.processingTime)} ago</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Ready</span>
          <i className={`ph-bold ph-caret-${expanded ? 'up' : 'down'} text-slate-400`}></i>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-4 border-t border-slate-700 space-y-4">
          {/* Stats Comparison */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-700/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">Original Peak</p>
              <p className="text-lg font-mono text-slate-200">{formatDb(result.stats.originalPeakDb)}</p>
            </div>
            <div className="p-3 bg-purple-900/20 border border-purple-500/50 rounded-lg">
              <p className="text-xs text-purple-400 mb-1">Vocals Peak</p>
              <p className="text-lg font-mono text-purple-300">{formatDb(result.stats.vocalsPeakDb)}</p>
            </div>
            <div className="p-3 bg-green-900/20 border border-green-500/50 rounded-lg">
              <p className="text-xs text-green-400 mb-1">YOLO Mix Peak</p>
              <p className="text-lg font-mono text-green-300">{formatDb(result.stats.yoloPeakDb)}</p>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => onDownload(result.originalUrl, `original_${result.sourceName}`)}
              className="px-3 py-2 bg-slate-600 text-white rounded hover:bg-slate-500 text-sm">
              <i className="ph-bold ph-download-simple mr-1"></i>
              Original
            </button>
            <button
              onClick={() => onDownload(result.vocalsUrl, `vocals_${result.sourceName}`)}
              className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 text-sm">
              <i className="ph-bold ph-download-simple mr-1"></i>
              Vocals
            </button>
            <button
              onClick={() => onDownload(result.instrumentalUrl, `instrumental_${result.sourceName}`)}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm">
              <i className="ph-bold ph-download-simple mr-1"></i>
              Instrumental
            </button>
            <button
              onClick={() => onDownload(result.yoloMixUrl, `yolo_${result.sourceName}.wav`)}
              className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded hover:from-purple-500 hover:to-pink-500 text-sm font-semibold">
              <i className="ph-bold ph-magic-wand mr-1"></i>
              YOLO Mix
            </button>
          </div>

          {/* Audio Players */}
          <div className="space-y-2">
            <div className="p-3 bg-slate-700/50 rounded">
              <p className="text-xs text-slate-400 mb-2">YOLO Mix (Skelly-Ready)</p>
              <audio controls src={result.yoloMixUrl} className="w-full h-8" />
            </div>
          </div>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(result.id)}
            className="w-full px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 rounded hover:bg-red-600/30 text-sm">
            <i className="ph-bold ph-trash mr-2"></i>
            Delete from Results
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchYoloProcessor;
