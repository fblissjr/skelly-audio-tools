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
  const [inputType, setInputType] = useState<'upload' | 'youtube'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [separationDecision, setSeparationDecision] = useState<'undecided' | 'separating' | 'skipped'>('undecided');

  // Core audio data state
  const [rawAudioBuffer, setRawAudioBuffer] = useState<AudioBuffer | null>(null);
  const [masterTrack, setMasterTrack] = useState<AudioSegment | null>(null);
  const [processedSegments, setProcessedSegments] = useState<AudioSegment[]>([]);
  const [instrumentalFile, setInstrumentalFile] = useState<File | null>(null);
  const [masterTrackFile, setMasterTrackFile] = useState<File | null>(null);

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
    setSeparationDecision('undecided');
    setInstrumentalFile(null);
    setMasterTrackFile(null);
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

    let audioFileToProcess = file;

    if (file.type.startsWith('video/')) {
        setIsExtracting(true);
        try {
            audioFileToProcess = await extractAudio(file, setExtractionProgress);
        } catch (err: any) {
            setError(`Failed to extract audio from video: ${err.message}`);
            resetState();
            setIsProcessing(false);
            return;
        } finally {
            setIsExtracting(false);
        }
    }

    // Store the audio file for vocal separation
    setMasterTrackFile(audioFileToProcess);
    await processAndLoadAudio(audioFileToProcess);

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

  const handleSegmentSeparateVocals = async (segmentId: number, segmentFile: File) => {
    try {
      // Call the vocal separation backend
      const formData = new FormData();
      formData.append("file", segmentFile);

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

      // Create blob URLs
      const vocalsBlobUrl = URL.createObjectURL(vocalsBlob);
      const instrumentalBlobUrl = URL.createObjectURL(instrumentalBlob);

      // Update the segment
      setProcessedSegments(prev => prev.map(seg => {
        if (seg.id === segmentId) {
          return {
            ...seg,
            originalMixBlobUrl: seg.blobUrl, // Store original
            blobUrl: vocalsBlobUrl, // Replace with vocals-only
            instrumentalBlobUrl: instrumentalBlobUrl,
            isSeparated: true,
          };
        }
        return seg;
      }));

    } catch (err: any) {
      setError(`Failed to separate vocals for segment: ${err.message}`);
    }
  };
  
  return (
    <div className="max-w-4xl w-full mx-auto">
      <Header />
      <main className="mt-8 space-y-12">
        <Instructions />

        {/* Step 1: Input Source Selection */}
        {!masterTrack && !isProcessing && (
          <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700">
            <div className="p-6 space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-200">Step 1: Select Audio Source</h2>
                <p className="text-slate-400 mt-2">Choose how you want to load your audio</p>
              </div>

              {/* Input Type Toggle */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setInputType('youtube')}
                  className={`px-6 py-3 font-semibold rounded-lg transition-all duration-200 ${
                    inputType === 'youtube'
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}>
                  YouTube URL
                </button>
                <button
                  onClick={() => setInputType('upload')}
                  className={`px-6 py-3 font-semibold rounded-lg transition-all duration-200 ${
                    inputType === 'upload'
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}>
                  Upload File
                </button>
              </div>

              {/* Input UI */}
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
                  <YouTubeHistory onLoad={handleLoadFromHistory} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {(isProcessing || youtube.status === 'fetching') && (
          <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700 p-6">
            <ProcessingIndicator
              text={isExtracting
                ? `Extracting audio from video... (${extractionProgress}%)`
                : (youtube.status === 'fetching' ? 'Fetching audio...' : 'Processing audio...')}
            />
          </div>
        )}

        {/* Errors */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}
        {youtube.error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 text-center">{youtube.error}</p>
          </div>
        )}

        {/* Optional: Vocal Separation Decision (shown after audio is loaded) */}
        {masterTrack && separationDecision === 'undecided' && (
          <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700">
            <div className="p-6 text-center space-y-4">
              <div>
                <h3 className="text-xl font-bold text-slate-200">Optional: Separate Vocals</h3>
                <p className="text-slate-400 mt-2">Use AI to isolate vocals from music before segmentation</p>
                <p className="text-sm text-slate-500 mt-1">This helps Skelly get cleaner vocal segments</p>
              </div>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setSeparationDecision('separating')}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105">
                  Separate Vocals
                </button>
                <button
                  onClick={() => setSeparationDecision('skipped')}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold rounded-lg transition-colors">
                  Skip - Continue to Segmentation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vocal Separation UI */}
        {masterTrack && separationDecision === 'separating' && (
          <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700">
            <div className="p-6">
              <VocalSeparation
                audioFile={masterTrackFile}
                onVocalsExtracted={(vocalsFile, instrumentalFileFromSeparation) => {
                  setSeparationDecision('skipped');
                  setInstrumentalFile(instrumentalFileFromSeparation);
                  handleFileLoad(vocalsFile);
                }}
              />
            </div>
          </div>
        )}

        {/* Step 2: Audio Segmentation Tools (shown after audio is loaded and separation is skipped/completed) */}
        {masterTrack && separationDecision === 'skipped' && (
          <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700">
            <div className="p-6 space-y-6">
              <div className="text-center border-b border-slate-700 pb-4">
                <h2 className="text-2xl font-bold text-slate-200">Step 2: Audio Segmentation</h2>
                <p className="text-slate-400 mt-2">Split your audio into segments for Skelly</p>
                {instrumentalFile && (
                  <div className="mt-3 inline-block px-4 py-2 bg-green-500/10 border border-green-500/50 rounded-lg">
                    <p className="text-green-400 text-sm">Instrumental track stored for recombination</p>
                  </div>
                )}
              </div>
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
              />
            </div>
          </div>
        )}

        {processedSegments.length > 0 && (
          <div className="animate-fade-in mt-12">
            <Results
              segments={processedSegments}
              onSegmentSettingsChange={handleSegmentSettingsChange}
              onSeparateVocals={handleSegmentSeparateVocals}
              globalInstrumentalFile={instrumentalFile}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default PrepPage;
