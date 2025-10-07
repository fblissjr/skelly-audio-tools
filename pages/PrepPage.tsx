import React, { useState, useEffect, useCallback } from 'react';
import { getAudioInfo, processFullTrack, extractSegment, autoSplitTrack } from '../services/audioProcessor';
import { extractAudio } from '../services/ffmpegService';
import type { AudioSegment } from '../types';
import { useYouTube } from '../hooks/useYouTube';
import Header from '../components/Header';
import Instructions from '../components/Instructions';
import FileUpload from '../components/FileUpload';
import ProcessingOptions from '../components/ProcessingOptions';
import ProcessingIndicator from '../components/ProcessingIndicator';
import Results from '../components/Results';
import { getAudio } from '../services/database';
import YouTubeHistory from '../components/YouTubeHistory';
import VocalSeparation from '../components/VocalSeparation';
import MasterTrackEditor from '../components/MasterTrackEditor';
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

const PrepPage: React.FC = () => {
  // Input state
  const [inputType, setInputType] = useState<'upload' | 'youtube'>('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [processingMode, setProcessingMode] = useState<'segmentation' | 'separation'>('segmentation');

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
    noiseGateThreshold: -100, // Off by default
    jawSensitivity: 0.25, // Default activation threshold
  });

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState(0);

  const resetState = useCallback(() => {
    setRawAudioBuffer(null);
    setMasterTrack(null);
    setProcessedSegments([]);
    setError(null);
    youtube.reset();
    setIsExtracting(false);
    setExtractionProgress(0);
  }, [youtube]);

  const processAndLoadAudio = useCallback(async (audioFile: File) => {
    try {
      const buffer = await getAudioInfo(audioFile);
      setRawAudioBuffer(buffer);
      const master = await processFullTrack(buffer, processingOptions);
      setMasterTrack(master);
    } catch (err: any) {
      setError(`Failed to load audio: ${err.message}`);
      resetState();
    }
  }, [resetState, processingOptions]);

  const handleFileLoad = useCallback(async (file: File) => {
    resetState();
    setIsProcessing(true);
    setError(null);

    if (file.type.startsWith('video/')) {
        setIsExtracting(true);
        try {
            const audioFile = await extractAudio(file, setExtractionProgress);
            await processAndLoadAudio(audioFile);
        } catch (err: any) {
            setError(`Failed to extract audio from video: ${err.message}`);
            resetState();
        } finally {
            setIsExtracting(false);
        }
    } else {
        await processAndLoadAudio(file);
    }

    setIsProcessing(false);
  }, [resetState, processAndLoadAudio]);

  const handleYouTubeFetch = async () => {
      const audioBuffer = await youtube.fetchAudio(youtubeUrl);
      if (audioBuffer) {
          const file = new File([audioBuffer], "youtube_audio.mp3", { type: "audio/mpeg" });
          handleFileLoad(file);
      }
  };

  const handleLoadFromHistory = async (id: string) => {
    try {
        const record = await getAudio(id);
        if (record) {
            const file = new File([record.data], `${record.title}.mp3`, { type: "audio/mpeg" });
            handleFileLoad(file);
        }
    } catch (err: any) {
        setError(`Failed to load from history: ${err.message}`);
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
              onClick={() => setProcessingMode('segmentation')}
              className={`flex-1 p-4 font-semibold text-center transition-colors duration-200 rounded-tl-xl ${
                processingMode === 'segmentation'
                  ? 'bg-slate-700/50 text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:bg-slate-700/30'
              }`}>
              Segmentation Tools
            </button>
            <button
              onClick={() => setProcessingMode('separation')}
              className={`flex-1 p-4 font-semibold text-center transition-colors duration-200 rounded-tr-xl ${
                processingMode === 'separation'
                  ? 'bg-slate-700/50 text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:bg-slate-700/30'
              }`}>
              AI Vocal Separation
            </button>
          </div>

          <div className="p-6">
            {processingMode === 'separation' && <VocalSeparation />}
            {processingMode === 'segmentation' && (
              <>
                {!masterTrack && !isProcessing && (
                  <>
                    {inputType === 'upload' && <FileUpload onFileChange={handleFileLoad} />}
                    {inputType === 'youtube' && (/* YouTube UI */)}
                  </>
                )}

                {(isProcessing || youtube.status === 'fetching') && (
                <ProcessingIndicator 
                    text={isExtracting 
                        ? `Extracting audio from video... (${extractionProgress}%)` 
                        : (youtube.status === 'fetching' ? 'Fetching audio...' : 'Processing audio...')}
                />
            )}
                {error && <p>{error}</p>}
                {youtube.error && <p>{youtube.error}</p>}

                {masterTrack && (
                  <div className="space-y-6">
                    <ProcessingOptions options={processingOptions} setOptions={setProcessingOptions} />
                                    <MasterTrackEditor 
                                        masterTrack={masterTrack}
                                        isProcessing={isProcessing}
                                        selectedRegion={selectedRegion}
                                        activationThreshold={processingOptions.jawSensitivity}
                                        onRegionChange={setSelectedRegion}
                                        onAddSegment={handleAddSegment}
                                        onAutoSplit={handleAutoSplit}
                                        onSettingsChange={handleMasterTrackSettingsChange}
                                    />                  </div>
                )}
              </>
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
