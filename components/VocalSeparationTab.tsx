import React, { useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import BatchYoloProcessor from './BatchYoloProcessor';

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL?.replace('/get-audio-url', '') || 'http://localhost:8000';

declare const JSZip: any;

type ProcessingMode = 'single' | 'batch';

const VocalSeparationTab: React.FC = () => {
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('single');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [separatedFiles, setSeparatedFiles] = useState<{
    vocals: File;
    instrumental: File;
  } | null>(null);

  // YOLO mode
  const [yoloMode, setYoloMode] = useState(false);
  const [yoloMixUrl, setYoloMixUrl] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string>('');

  // Volume controls
  const [vocalsVolume, setVocalsVolume] = useState(100);
  const [instrumentalVolume, setInstrumentalVolume] = useState(100);

  // Audio preview
  const [vocalsUrl, setVocalsUrl] = useState<string | null>(null);
  const [instrumentalUrl, setInstrumentalUrl] = useState<string | null>(null);

  const createYoloMix = useCallback(async (vocalsFile: File, instrumentalFile: File) => {
    setProcessingStep('Creating YOLO Mix: Boosting vocals and reducing instrumental...');

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Load both tracks
    const vocalsArrayBuffer = await vocalsFile.arrayBuffer();
    const instrumentalArrayBuffer = await instrumentalFile.arrayBuffer();

    const vocalsBuffer = await audioContext.decodeAudioData(vocalsArrayBuffer);
    const instrumentalBuffer = await audioContext.decodeAudioData(instrumentalArrayBuffer);

    // YOLO Mix settings:
    // - Vocals at 120% (boost them)
    // - Instrumental at 25% (quiet background)
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

        // Soft clipping to prevent distortion
        sample = Math.max(-1, Math.min(1, sample));
        mixedData[i] = sample;
      }
    }

    // Convert to WAV
    setProcessingStep('Creating YOLO Mix: Converting to WAV...');
    const wavBlob = await bufferToWave(mixedBuffer, sampleRate);
    const yoloUrl = URL.createObjectURL(wavBlob);
    setYoloMixUrl(yoloUrl);

    setProcessingStep('');
    return wavBlob;
  }, []);

  const bufferToWave = (buffer: AudioBuffer, sampleRate: number): Promise<Blob> => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels = [];
    let offset = 0;

    // Write WAV header
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

    // Write audio data
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

  const processAudioFile = useCallback(async (file: File, useYolo: boolean = false) => {
    setIsProcessing(true);
    setError(null);
    setProcessingTime(0);
    setSeparatedFiles(null);
    setYoloMixUrl(null);
    setProcessingStep('');

    const formData = new FormData();
    formData.append('file', file);

    // Start timer
    const startTime = Date.now();
    const interval = setInterval(() => {
      setProcessingTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      setProcessingStep('Separating vocals from instrumental using AI...');

      const response = await fetch(`${BACKEND_BASE_URL}/separate-vocals`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Separation failed' }));
        throw new Error(errorData.detail || 'Separation failed');
      }

      setProcessingStep('Extracting separated tracks from ZIP...');
      const blob = await response.blob();

      // Extract files from ZIP
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(blob);

      const vocalsBlob = await zipContent.file('vocals.wav').async('blob');
      const instrumentalBlob = await zipContent.file('instrumental.wav').async('blob');

      const vocalsFile = new File([vocalsBlob], 'vocals.wav', { type: 'audio/wav' });
      const instrumentalFile = new File([instrumentalBlob], 'instrumental.wav', { type: 'audio/wav' });

      setSeparatedFiles({ vocals: vocalsFile, instrumental: instrumentalFile });

      // Create preview URLs
      setVocalsUrl(URL.createObjectURL(vocalsFile));
      setInstrumentalUrl(URL.createObjectURL(instrumentalFile));

      // Create YOLO mix if requested
      if (useYolo) {
        await createYoloMix(vocalsFile, instrumentalFile);
      }

      setProcessingStep('');

    } catch (err: any) {
      console.error('Error separating vocals:', err);
      setError(err.message || 'Failed to separate vocals');
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
    }
  }, [createYoloMix]);

  const handleFileLoad = useCallback((file: File) => {
    setAudioFile(file);
    processAudioFile(file, yoloMode);
  }, [processAudioFile, yoloMode]);

  const handleDownload = (type: 'vocals' | 'instrumental' | 'both') => {
    if (!separatedFiles) return;

    if (type === 'vocals') {
      const url = URL.createObjectURL(separatedFiles.vocals);
      const a = document.createElement('a');
      a.href = url;
      a.download = separatedFiles.vocals.name;
      a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'instrumental') {
      const url = URL.createObjectURL(separatedFiles.instrumental);
      const a = document.createElement('a');
      a.href = url;
      a.download = separatedFiles.instrumental.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Download both as ZIP
      const zip = new JSZip();
      zip.file('vocals.wav', separatedFiles.vocals);
      zip.file('instrumental.wav', separatedFiles.instrumental);
      zip.generateAsync({ type: 'blob' }).then((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'separated_audio.zip';
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  };

  const handleReset = () => {
    setAudioFile(null);
    setSeparatedFiles(null);
    setError(null);
    setProcessingTime(0);
    if (vocalsUrl) URL.revokeObjectURL(vocalsUrl);
    if (instrumentalUrl) URL.revokeObjectURL(instrumentalUrl);
    setVocalsUrl(null);
    setInstrumentalUrl(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mode Selector */}
      <div className="flex justify-center space-x-2 border-b border-slate-700 pb-4">
        <button
          onClick={() => setProcessingMode('single')}
          className={`px-6 py-3 font-semibold rounded-lg transition-all duration-200 ${
            processingMode === 'single'
              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}>
          <i className="ph-bold ph-file-audio mr-2"></i>
          Single File
        </button>
        <button
          onClick={() => setProcessingMode('batch')}
          className={`px-6 py-3 font-semibold rounded-lg transition-all duration-200 ${
            processingMode === 'batch'
              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}>
          <i className="ph-bold ph-stack mr-2"></i>
          Batch Queue
        </button>
      </div>

      {/* Batch Mode */}
      {processingMode === 'batch' && <BatchYoloProcessor />}

      {/* Single Mode */}
      {processingMode === 'single' && (
        <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700">
          <div className="p-6 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-200">Vocal Separation Studio</h2>
              <p className="text-slate-400 mt-2">Separate vocals from music using AI for cleaner Skelly mouth movements</p>
            </div>

          {/* Upload Section */}
          {!audioFile && !isProcessing && (
            <>
              {/* YOLO Mode Toggle */}
              <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <i className="ph-bold ph-magic-wand text-2xl text-purple-400"></i>
                      <span className="text-lg font-bold text-purple-300">YOLO Mode</span>
                      <span className="px-2 py-0.5 bg-purple-500/30 text-purple-200 text-xs rounded-full font-semibold">SMART</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1 ml-8">
                      AI-powered smart mix: Vocals boosted to 120%, instrumental reduced to 25%
                    </p>
                    <p className="text-xs text-slate-500 mt-1 ml-8">
                      Perfect for Skelly - mouth moves only on vocals!
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={yoloMode}
                      onChange={(e) => setYoloMode(e.target.checked)}
                      className="w-6 h-6 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
                    />
                  </div>
                </label>
              </div>

              <FileUpload onFileChange={handleFileLoad} />
            </>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                {yoloMode && (
                  <div className="flex items-center space-x-2 text-purple-400">
                    <i className="ph-bold ph-magic-wand text-xl animate-pulse"></i>
                    <span className="font-bold">YOLO Mode Active</span>
                  </div>
                )}
                <p className="text-slate-300 font-semibold">{processingStep || 'Processing...'}</p>
                <div className="text-center">
                  <p className="text-slate-400 text-sm">Processing: {audioFile?.name}</p>
                  <p className="text-orange-400 font-mono text-lg mt-2">{processingTime}s elapsed</p>
                  {processingStep.includes('AI') && (
                    <p className="text-slate-500 text-xs mt-1">AI separation may take 1-2 minutes</p>
                  )}
                  {processingStep.includes('YOLO') && (
                    <p className="text-purple-400 text-xs mt-1">Creating smart mix for optimal Skelly performance...</p>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-red-600 animate-pulse"></div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400 text-center">{error}</p>
              <button
                onClick={handleReset}
                className="mt-4 w-full px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors">
                Try Again
              </button>
            </div>
          )}

          {/* Results */}
          {separatedFiles && !isProcessing && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-green-400">
                  <i className="ph-bold ph-check-circle text-2xl"></i>
                  <span className="font-semibold">Separation Complete!</span>
                </div>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm">
                  Process New File
                </button>
              </div>

              {/* YOLO Mix Player (if created) */}
              {yoloMixUrl && (
                <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-2 border-purple-500/70 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <i className="ph-bold ph-magic-wand text-2xl text-purple-400 animate-pulse"></i>
                      <h3 className="text-lg font-bold text-purple-300">YOLO Mix - Ready for Skelly!</h3>
                      <span className="px-2 py-0.5 bg-purple-500/30 text-purple-200 text-xs rounded-full font-semibold">OPTIMAL</span>
                    </div>
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = yoloMixUrl;
                        a.download = 'yolo_mix_skelly_ready.wav';
                        a.click();
                      }}
                      className="px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-500 transition-colors text-sm font-semibold">
                      <i className="ph-bold ph-download-simple mr-1"></i>
                      Download YOLO Mix
                    </button>
                  </div>
                  <audio controls src={yoloMixUrl} className="w-full" />
                  <div className="text-sm space-y-1 bg-slate-800/50 p-3 rounded-md">
                    <p className="text-purple-300 font-semibold">What's in this mix:</p>
                    <ul className="text-slate-400 space-y-1 ml-4">
                      <li className="flex items-center"><i className="ph-bold ph-check text-green-400 mr-2"></i>Vocals boosted to 120% volume</li>
                      <li className="flex items-center"><i className="ph-bold ph-check text-green-400 mr-2"></i>Instrumental reduced to 25% volume</li>
                      <li className="flex items-center"><i className="ph-bold ph-check text-green-400 mr-2"></i>Soft clipping to prevent distortion</li>
                      <li className="flex items-center"><i className="ph-bold ph-sparkle text-purple-400 mr-2"></i>Skelly's mouth will move primarily on vocals!</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Vocals Player */}
              <div className="p-4 bg-slate-700/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                    <i className="ph-bold ph-microphone mr-2 text-purple-400"></i>
                    Vocals Track
                  </h3>
                  <button
                    onClick={() => handleDownload('vocals')}
                    className="px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-500 transition-colors text-sm">
                    <i className="ph-bold ph-download-simple mr-1"></i>
                    Download
                  </button>
                </div>
                {vocalsUrl && (
                  <>
                    <audio controls src={vocalsUrl} className="w-full" />
                    <div>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <label className="font-medium text-slate-300">Volume</label>
                        <span className="font-mono text-orange-400">{vocalsVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="1"
                        value={vocalsVolume}
                        onChange={(e) => setVocalsVolume(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Instrumental Player */}
              <div className="p-4 bg-slate-700/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                    <i className="ph-bold ph-music-notes mr-2 text-blue-400"></i>
                    Instrumental Track
                  </h3>
                  <button
                    onClick={() => handleDownload('instrumental')}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm">
                    <i className="ph-bold ph-download-simple mr-1"></i>
                    Download
                  </button>
                </div>
                {instrumentalUrl && (
                  <>
                    <audio controls src={instrumentalUrl} className="w-full" />
                    <div>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <label className="font-medium text-slate-300">Volume</label>
                        <span className="font-mono text-orange-400">{instrumentalVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="1"
                        value={instrumentalVolume}
                        onChange={(e) => setInstrumentalVolume(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Download All Button */}
              <button
                onClick={() => handleDownload('both')}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105 shadow-lg">
                <i className="ph-bold ph-download-simple mr-2"></i>
                Download Both Tracks
              </button>

              {/* Info box */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                <p className="text-blue-300 text-sm">
                  <i className="ph-bold ph-info mr-2"></i>
                  <strong>Tip:</strong> Use the vocals track for clearer Skelly mouth movements. You can recombine tracks later in the segmentation tab.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VocalSeparationTab;
