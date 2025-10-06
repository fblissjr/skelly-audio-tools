
import React, { useState, useEffect, useCallback } from 'react';
import { processAudio, getAudioInfo } from '../services/audioProcessor';
import type { AudioSegment, WaveformData, ProcessedAudioResult } from '../types';
import Header from '../components/Header';
import Instructions from '../components/Instructions';
import FileUpload from '../components/FileUpload';
import ProcessingOptions from '../components/ProcessingOptions';
import Waveform from '../components/Waveform';
import ProcessingIndicator from '../components/ProcessingIndicator';
import Results from '../components/Results';
import YouTubeGuide from '../components/YouTubeGuide';

const PrepPage: React.FC = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [processedSegments, setProcessedSegments] = useState<AudioSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'upload' | 'youtube'>('upload');
  const [originalFullWaveform, setOriginalFullWaveform] = useState<WaveformData | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  const [processingOptions, setProcessingOptions] = useState({
    normalizationDb: -1.0,
    compressionPreset: 'medium',
  });

  useEffect(() => {
    // Cleanup blob URLs to prevent memory leaks
    return () => {
      processedSegments.forEach(segment => URL.revokeObjectURL(segment.blobUrl));
    };
  }, [processedSegments]);

  const resetState = () => {
    setAudioFile(null);
    setProcessedSegments([]);
    setError(null);
    setOriginalFullWaveform(null);
    setAudioDuration(null);
  };
  
  const handleFileChange = useCallback(async (file: File | null) => {
    resetState();
    if (!file) {
      return;
    }

    setIsPreviewLoading(true);
    setError(null);
    setAudioFile(file);

    try {
      const { waveform, duration } = await getAudioInfo(file);
      setOriginalFullWaveform(waveform);
      setAudioDuration(duration);
    } catch (err) {
      console.error('Failed to generate audio preview:', err);
      setError('Could not read audio file. It may be corrupted or in an unsupported format.');
      resetState();
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);


  const handleProcessAudio = useCallback(async () => {
    if (!audioFile) {
      setError('Please select an audio file first.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setProcessedSegments([]);

    try {
      // We pass the already generated waveform to avoid generating it twice
      const result: ProcessedAudioResult = await processAudio(audioFile, processingOptions, originalFullWaveform);
      setProcessedSegments(result.segments);
    } catch (err) {
      console.error('Audio processing failed:', err);
      setError('Failed to process audio. The file might be corrupted or in an unsupported format.');
    } finally {
      setIsProcessing(false);
    }
  }, [audioFile, processingOptions, originalFullWaveform]);

  const handleSegmentVolumeChange = (segmentId: number, volume: number) => {
    setProcessedSegments(prevSegments =>
      prevSegments.map(segment =>
        segment.id === segmentId ? { ...segment, volume } : segment
      )
    );
  };
  
  return (
    <div className="max-w-4xl w-full mx-auto">
      <Header />
      <main className="mt-8 space-y-12">
        <Instructions />

        <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700">
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => { setInputType('upload'); resetState(); }}
              className={`flex-1 p-4 font-semibold text-center transition-colors duration-200 rounded-tl-xl ${
                inputType === 'upload'
                  ? 'bg-slate-700/50 text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:bg-slate-700/30'
              }`}
              aria-pressed={inputType === 'upload'}
            >
              <i className="ph-bold ph-upload-simple mr-2"></i>
              Upload Audio File
            </button>
            <button
              onClick={() => { setInputType('youtube'); resetState(); }}
              className={`flex-1 p-4 font-semibold text-center transition-colors duration-200 rounded-tr-xl ${
                inputType === 'youtube'
                  ? 'bg-slate-700/50 text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:bg-slate-700/30'
              }`}
              aria-pressed={inputType === 'youtube'}
            >
              <i className="ph-bold ph-youtube-logo mr-2"></i>
              From YouTube URL
            </button>
          </div>
          
          <div className="p-6">
            {inputType === 'upload' ? (
              <FileUpload onFileChange={handleFileChange} />
            ) : (
              <YouTubeGuide onFileChange={handleFileChange} />
            )}
            
            {audioFile && (
              <div className="mt-6 border-t border-slate-700/50 pt-6 space-y-8 animate-fade-in">
                <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <i className="ph-fill ph-file-audio text-2xl text-orange-400 flex-shrink-0"></i>
                    <span className="text-slate-200 truncate" title={audioFile.name}>{audioFile.name}</span>
                  </div>
                  <button onClick={() => handleFileChange(null)} className="p-1 rounded-full hover:bg-slate-600 transition-colors">
                    <i className="ph-bold ph-x text-lg text-slate-400"></i>
                  </button>
                </div>
                
                {isPreviewLoading && <ProcessingIndicator />}

                {originalFullWaveform && audioDuration && !isPreviewLoading && (
                  <div className="space-y-8">
                    <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
                      <h3 className="text-lg font-semibold text-center text-slate-300 mb-2">Track Preview with 30s Segments</h3>
                      <div className="bg-slate-700/50 rounded-md p-2">
                        <Waveform 
                          data={originalFullWaveform} 
                          width={800} 
                          height={80} 
                          color="#a8a29e"
                          totalDuration={audioDuration}
                          segmentDuration={30}
                        />
                      </div>
                    </div>

                    <ProcessingOptions options={processingOptions} setOptions={setProcessingOptions} />

                    <div className="flex flex-col items-center">
                      <button
                        onClick={handleProcessAudio}
                        disabled={isProcessing}
                        className="w-full max-w-sm px-8 py-3 text-lg font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 rounded-lg shadow-lg hover:from-orange-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <i className="ph-bold ph-sparkle"></i>
                          <span>{isProcessing ? 'Processing...' : 'Normalize & Split Audio'}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-red-400 mt-4 text-center" role="alert">{error}</p>}
          </div>
        </div>

        {isProcessing && <ProcessingIndicator />}
        
        {processedSegments.length > 0 && (
          <div className="animate-fade-in">
            <Results 
              segments={processedSegments} 
              onSegmentVolumeChange={handleSegmentVolumeChange} 
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default PrepPage;
