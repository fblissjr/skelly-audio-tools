import React, { useState, useEffect, useCallback } from 'react';
import { getAudioInfo, processFullTrack, extractSegment, autoSplitTrack } from '../services/audioProcessor';
import type { AudioSegment } from '../types';
import { useYouTube } from '../hooks/useYouTube';
import Header from '../components/Header';
import Instructions from '../components/Instructions';
import FileUpload from '../components/FileUpload';
import ProcessingOptions from '../components/ProcessingOptions';
import ProcessingIndicator from '../components/ProcessingIndicator';
import Results from '../components/Results';
import MasterTrackEditor from '../components/MasterTrackEditor';
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

const PrepPage: React.FC = () => {
  // Input state
  const [inputType, setInputType] = useState<'upload' | 'youtube'>('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Core audio data state
  const [rawAudioBuffer, setRawAudioBuffer] = useState<AudioBuffer | null>(null);
  const [masterTrack, setMasterTrack] = useState<AudioSegment | null>(null);
  const [processedSegments, setProcessedSegments] = useState<AudioSegment[]>([]);

  // UI state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  
  const youtube = useYouTube();

  const [processingOptions, setProcessingOptions] = useState({
    normalizationDb: -1.0,
    compressionPreset: 'medium',
  });

  const resetState = useCallback(() => {
    setRawAudioBuffer(null);
    setMasterTrack(null);
    setProcessedSegments([]);
    setError(null);
    youtube.reset();
  }, [youtube]);

  const handleFileLoad = useCallback(async (file: File) => {
    resetState();
    setIsProcessing(true);
    setError(null);

    try {
      const buffer = await getAudioInfo(file);
      setRawAudioBuffer(buffer);
      const master = await processFullTrack(buffer, processingOptions);
      setMasterTrack(master);
    } catch (err: any) {
      setError(`Failed to load audio: ${err.message}`);
      resetState();
    } finally {
      setIsProcessing(false);
    }
  }, [resetState, processingOptions]);

  const handleYouTubeFetch = async () => {
      const audioBuffer = await youtube.fetchAudio(youtubeUrl);
      if (audioBuffer) {
          const file = new File([audioBuffer], "youtube_audio.mp3", { type: "audio/mpeg" });
          handleFileLoad(file);
      }
  };

  const handleAddSegment = async () => {
    if (!masterTrack || !selectedRegion) return;
    setIsProcessing(true);
    try {
        // We need to re-decode the master track blob to get its buffer for slicing
        const masterBuffer = await getAudioInfo(new File([await (await fetch(masterTrack.blobUrl)).blob()], masterTrack.name));
        const newSegment = await extractSegment(masterBuffer, {
            startTime: selectedRegion.start,
            endTime: selectedRegion.end,
            segmentId: processedSegments.length,
        });
        setProcessedSegments(prev => [...prev, newSegment]);
    } catch (err: any) {
        setError(`Failed to extract segment: ${err.message}`);
    }
    setIsProcessing(false);
  };

  const handleAutoSplit = async () => {
    if (!masterTrack) return;
    setIsProcessing(true);
    try {
        const masterBuffer = await getAudioInfo(new File([await (await fetch(masterTrack.blobUrl)).blob()], masterTrack.name));
        const segments = await autoSplitTrack(masterBuffer);
        setProcessedSegments(segments);
    } catch (err: any) { 
        setError(`Failed to auto-split: ${err.message}`);
    }
    setIsProcessing(false);
  };

  const handleMasterTrackSettingsChange = (settings: any) => {
      if (!masterTrack) return;
      setMasterTrack({ ...masterTrack, ...settings });
  }

  const handleSegmentSettingsChange = (id: number, settings: any) => {
    setProcessedSegments(prev => prev.map(seg => seg.id === id ? { ...seg, ...settings } : seg));
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
              }`}>
              <i className="ph-bold ph-upload-simple mr-2"></i>
              Upload Audio File
            </button>
            <button
              onClick={() => { setInputType('youtube'); resetState(); }}
              className={`flex-1 p-4 font-semibold text-center transition-colors duration-200 rounded-tr-xl ${
                inputType === 'youtube'
                  ? 'bg-slate-700/50 text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:bg-slate-700/30'
              }`}>
              <i className="ph-bold ph-youtube-logo mr-2"></i>
              From YouTube URL
            </button>
          </div>

          <div className="p-6">
            {!masterTrack && !isProcessing && (
              <>
                {inputType === 'upload' && <FileUpload onFileChange={handleFileLoad} />}
                {inputType === 'youtube' && (
                    <div className="space-y-4">
                        <p className="text-center text-slate-400">Paste a YouTube URL below to fetch its audio.</p>
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                placeholder="e.g., https://www.youtube.com/watch?v=..."
                                className="w-full pl-4 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                                disabled={youtube.status === 'fetching'}
                            />
                            <button 
                                onClick={handleYouTubeFetch}
                                disabled={!youtubeUrl || youtube.status === 'fetching'}
                                className="px-6 py-2 font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 rounded-lg shadow-lg hover:from-orange-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
                                Fetch Audio
                            </button>
                        </div>
                    </div>
                )}
              </>
            )}

            {(isProcessing || youtube.status === 'fetching') && <ProcessingIndicator text={youtube.status === 'fetching' ? 'Fetching audio...' : 'Processing audio...'} />}
            {error && <p className="text-red-400 mt-4 text-center" role="alert">{error}</p>}
            {youtube.error && <p className="text-red-400 mt-4 text-center" role="alert">{youtube.error}</p>}

            {masterTrack && (
              <div className="space-y-6">
                <ProcessingOptions options={processingOptions} setOptions={setProcessingOptions} />
                <MasterTrackEditor 
                    masterTrack={masterTrack}
                    isProcessing={isProcessing}
                    selectedRegion={selectedRegion}
                    onRegionChange={setSelectedRegion}
                    onAddSegment={handleAddSegment}
                    onAutoSplit={handleAutoSplit}
                    onSettingsChange={handleMasterTrackSettingsChange}
                />
              </div>
            )}
          </div>
        </div>
        
        {processedSegments.length > 0 && (
          <div className="animate-fade-in mt-12">
            <Results segments={processedSegments} onSegmentSettingsChange={handleSegmentSettingsChange} />
          </div>
        )}
      </main>
    </div>
  );
};

export default PrepPage;
