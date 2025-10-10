import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from './FileUpload';
import ProcessingIndicator from './ProcessingIndicator';

interface VocalSeparationProps {
  onVocalsExtracted?: (vocalsFile: File, instrumentalFile: File) => void;
  audioFile?: File | null; // Optional pre-loaded audio file
}

const VocalSeparation: React.FC<VocalSeparationProps> = ({ onVocalsExtracted, audioFile }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [fileName, setFileName] = useState<string>('');
  const [separatedFiles, setSeparatedFiles] = useState<{ vocals: File; instrumental: File } | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setProcessingTime(0);
      interval = setInterval(() => {
        setProcessingTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  // Auto-process if audioFile is provided
  useEffect(() => {
    if (audioFile && !isProcessing && !separatedFiles) {
      handleFileChange(audioFile);
    }
  }, [audioFile]);

  const handleFileChange = useCallback(async (file: File | null) => {
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setError(null);
    setSeparatedFiles(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/separate-vocals", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Separation failed" }));
        throw new Error(errorData.detail || "Separation failed");
      }

      const blob = await response.blob();

      // Extract files from ZIP
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(blob);

      const vocalsBlob = await zip.file('vocals.wav')?.async('blob');
      const instrumentalBlob = await zip.file('instrumental.wav')?.async('blob');

      if (!vocalsBlob || !instrumentalBlob) {
        throw new Error('Failed to extract files from ZIP');
      }

      const vocalsFile = new File([vocalsBlob], 'vocals.wav', { type: 'audio/wav' });
      const instrumentalFile = new File([instrumentalBlob], 'instrumental.wav', { type: 'audio/wav' });

      setSeparatedFiles({ vocals: vocalsFile, instrumental: instrumentalFile });

    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadVocals = () => {
    if (separatedFiles && onVocalsExtracted) {
      onVocalsExtracted(separatedFiles.vocals, separatedFiles.instrumental);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
        <div className="text-center">
            <h2 className="text-xl font-bold text-slate-200">AI Vocal Separator</h2>
            <p className="text-slate-400">Separate vocals from instrumental, then process the vocals for perfect mouth sync.</p>
            <p className="text-sm text-slate-500 mt-2">⏱ Processing on CPU takes ~1 minute per minute of audio</p>
        </div>

        {!separatedFiles && !isProcessing && !audioFile && (
          <FileUpload onFileChange={handleFileChange} promptMessage="Click or drop an audio file here" />
        )}

        {isProcessing && (
            <div className="space-y-4">
              <ProcessingIndicator text={`Separating vocals from "${fileName}"...`} />
              <div className="text-center">
                <p className="text-slate-400 text-sm">Processing time: {formatTime(processingTime)}</p>
                <p className="text-slate-500 text-xs mt-1">This may take several minutes depending on file length</p>
              </div>
            </div>
        )}

        {separatedFiles && (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
              <p className="text-green-400 text-center font-semibold">✓ Separation complete!</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-200">🎤 Vocals</p>
                    <p className="text-sm text-slate-400">Isolated vocal track</p>
                  </div>
                  <button
                    onClick={() => downloadFile(separatedFiles.vocals)}
                    className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>

              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-200">🎸 Instrumental</p>
                    <p className="text-sm text-slate-400">Music without vocals</p>
                  </div>
                  <button
                    onClick={() => downloadFile(separatedFiles.instrumental)}
                    className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={handleLoadVocals}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                Load Vocals into Segmentation Tool →
              </button>
              <p className="text-xs text-slate-500">Process the vocals, then recombine with instrumental</p>
            </div>

            <button
              onClick={() => setSeparatedFiles(null)}
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
            >
              Separate Another File
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 text-center" role="alert">{error}</p>
          </div>
        )}
    </div>
  );
};

export default VocalSeparation;
