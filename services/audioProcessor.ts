import type { AudioSegment, ProcessedAudioResult, WaveformData } from '../types';

const WAVEFORM_WIDTH = 400; // width in samples for segment waveforms
const FULL_WAVEFORM_WIDTH = 800; // width for the full track preview

function generateWaveformData(buffer: AudioBuffer, targetWidth: number): WaveformData {
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / targetWidth);
    const amps: number[] = [];
    for (let i = 0; i < targetWidth; i++) {
        const start = i * step;
        let max = 0;
        for (let j = 0; j < step; j++) {
            const sample = Math.abs(data[start + j] || 0);
            if (sample > max) {
                max = sample;
            }
        }
        amps.push(max);
    }
    return amps;
}

function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels: Float32Array[] = [];
  let i: number;
  let sample: number;
  let pos = 0;

  const writeString = (view: DataView, offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, pos, 'RIFF'); pos += 4;
  view.setUint32(pos, length - 8, true); pos += 4;
  writeString(view, pos, 'WAVE'); pos += 4;
  writeString(view, pos, 'fmt '); pos += 4;
  view.setUint32(pos, 16, true); pos += 4;
  view.setUint16(pos, 1, true); pos += 2;
  view.setUint16(pos, numOfChan, true); pos += 2;
  view.setUint32(pos, buffer.sampleRate, true); pos += 4;
  view.setUint32(pos, buffer.sampleRate * 2 * numOfChan, true); pos += 4;
  view.setUint16(pos, numOfChan * 2, true); pos += 2;
  view.setUint16(pos, 16, true); pos += 2;
  writeString(view, pos, 'data'); pos += 4;
  view.setUint32(pos, length - pos - 4, true); pos += 4;

  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = pos;

  for (i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

const compressionPresets: { [key: string]: DynamicsCompressorOptions } = {
    light: { threshold: -18, knee: 30, ratio: 2, attack: 0.01, release: 0.1 },
    medium: { threshold: -24, knee: 30, ratio: 4, attack: 0.003, release: 0.25 },
    heavy: { threshold: -30, knee: 30, ratio: 8, attack: 0.003, release: 0.25 },
};

export async function getAudioInfo(file: File): Promise<AudioBuffer> {
  const audioContext = new AudioContext();
  const fileBuffer = await file.arrayBuffer();
  const decodedBuffer = await audioContext.decodeAudioData(fileBuffer);
  audioContext.close();
  return decodedBuffer;
}

async function applyProcessingEffects(
    inputBuffer: AudioBuffer,
    options: { normalizationDb: number; compressionPreset: string; noiseGateThreshold?: number; }
): Promise<AudioBuffer> {
    let buffer = inputBuffer;

    // Apply noise gate first, if specified
    if (options.noiseGateThreshold && options.noiseGateThreshold > -100) {
        buffer = applyNoiseGate(buffer, options.noiseGateThreshold);
    }

    let peak = 0;
    for (let i = 0; i < buffer.numberOfChannels; i++) {
        const channelData = buffer.getChannelData(i);
        channelData.forEach(sample => {
            const absSample = Math.abs(sample);
            if (absSample > peak) peak = absSample;
        });
    }

    const targetAmplitude = 10 ** (options.normalizationDb / 20);
    const gainValue = peak > 0 ? targetAmplitude / peak : 1;

    const offlineContext = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    const gainNode = offlineContext.createGain();
    gainNode.gain.value = gainValue;
    let lastNode: AudioNode = gainNode;

    if (options.compressionPreset !== 'none') {
        const compressor = offlineContext.createDynamicsCompressor();
        const preset = compressionPresets[options.compressionPreset];
        if (preset) {
            compressor.threshold.setValueAtTime(preset.threshold || 0, 0);
            compressor.knee.setValueAtTime(preset.knee || 0, 0);
            compressor.ratio.setValueAtTime(preset.ratio || 1, 0);
            compressor.attack.setValueAtTime(preset.attack || 0, 0);
            compressor.release.setValueAtTime(preset.release || 0, 0);
        }
        gainNode.connect(compressor);
        lastNode = compressor;
    }
    
    source.connect(gainNode);
    lastNode.connect(offlineContext.destination);
    source.start(0);
    return await offlineContext.startRendering();
}

function applyNoiseGate(buffer: AudioBuffer, thresholdDb: number): AudioBuffer {
    const threshold = 10 ** (thresholdDb / 20);
    const chunk_size = 512; // Process in small chunks

    for (let i = 0; i < buffer.numberOfChannels; i++) {
        const channelData = buffer.getChannelData(i);
        for (let j = 0; j < channelData.length; j += chunk_size) {
            const chunkEnd = Math.min(j + chunk_size, channelData.length);
            const chunk = channelData.subarray(j, chunkEnd);

            let sum_squares = 0.0;
            for (let k = 0; k < chunk.length; k++) {
                sum_squares += chunk[k] * chunk[k];
            }
            const rms = Math.sqrt(sum_squares / chunk.length);

            if (rms < threshold) {
                // Silence this chunk
                for (let k = 0; k < chunk.length; k++) {
                    chunk[k] = 0;
                }
            }
        }
    }
    return buffer;
}

export async function processFullTrack(
    rawBuffer: AudioBuffer,
    processingOptions: { normalizationDb: number; compressionPreset: string; }
): Promise<AudioSegment> {
    const processedBuffer = await applyProcessingEffects(rawBuffer, processingOptions);
    const wavBlob = bufferToWav(processedBuffer);
    const blobUrl = URL.createObjectURL(wavBlob);

    return {
        id: 0,
        name: `Master_Track.wav`,
        blobUrl: blobUrl,
        duration: processedBuffer.duration,
        startTime: 0,
        originalWaveform: generateWaveformData(rawBuffer, FULL_WAVEFORM_WIDTH),
        processedWaveform: generateWaveformData(processedBuffer, FULL_WAVEFORM_WIDTH),
        volume: 1.0,
        fadeInDuration: 0,
        fadeOutDuration: 0,
    };
}

export async function extractSegment(
    processedMasterBuffer: AudioBuffer,
    options: { 
        startTime: number;
        endTime: number;
        segmentId: number;
    }
): Promise<AudioSegment> {
    const { startTime, endTime, segmentId } = options;
    const duration = endTime - startTime;

    if (duration <= 0) {
        throw new Error("End time must be after start time.");
    }

    const startSample = Math.floor(startTime * processedMasterBuffer.sampleRate);
    const endSample = Math.floor(endTime * processedMasterBuffer.sampleRate);
    const frameCount = endSample - startSample;
    
    const audioContext = new AudioContext();
    const slicedBuffer = audioContext.createBuffer(processedMasterBuffer.numberOfChannels, frameCount, processedMasterBuffer.sampleRate);

    for (let i = 0; i < processedMasterBuffer.numberOfChannels; i++) {
        slicedBuffer.copyToChannel(processedMasterBuffer.getChannelData(i).subarray(startSample, endSample), i);
    }
    audioContext.close();

    const wavBlob = bufferToWav(slicedBuffer);
    const blobUrl = URL.createObjectURL(wavBlob);

    return {
        id: segmentId,
        name: `Segment_${String(segmentId + 1).padStart(2, '0')}.wav`,
        blobUrl: blobUrl,
        duration: duration,
        startTime: startTime,
        originalWaveform: generateWaveformData(slicedBuffer, WAVEFORM_WIDTH),
        processedWaveform: generateWaveformData(slicedBuffer, WAVEFORM_WIDTH),
        volume: 1.0,
        fadeInDuration: 0,
        fadeOutDuration: 0,
    };
}

export async function autoSplitTrack(
    processedMasterBuffer: AudioBuffer
): Promise<AudioSegment[]> {
    const totalDuration = processedMasterBuffer.duration;
    const segmentDuration = 30;
    const numSegments = Math.ceil(totalDuration / segmentDuration);
    const segments: AudioSegment[] = [];

    for (let i = 0; i < numSegments; i++) {
        const startTime = i * segmentDuration;
        const endTime = Math.min(startTime + segmentDuration, totalDuration);

        if (endTime - startTime <= 0) continue;

        const segment = await extractSegment(processedMasterBuffer, {
            startTime,
            endTime,
            segmentId: i,
        });
        segments.push(segment);
    }

    return segments;
}

export async function applyEffectsToSegment(
    originalBlobUrl: string, 
    effects: { volume: number; fadeInDuration: number; fadeOutDuration: number; }
): Promise<Blob> {
    const { volume, fadeInDuration, fadeOutDuration } = effects;
    const audioContext = new AudioContext();
    const response = await fetch(originalBlobUrl);
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const offlineContext = new OfflineAudioContext(decodedBuffer.numberOfChannels, decodedBuffer.length, decodedBuffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = decodedBuffer;
    const gainNode = offlineContext.createGain();
    source.connect(gainNode);
    gainNode.connect(offlineContext.destination);
    const { duration } = decodedBuffer;
    const { gain } = gainNode;
    let effectiveFadeIn = Math.max(0, Math.min(fadeInDuration, duration));
    let effectiveFadeOut = Math.max(0, Math.min(fadeOutDuration, duration));
    if (effectiveFadeIn + effectiveFadeOut > duration) {
        effectiveFadeOut = duration - effectiveFadeIn;
    }
    const fadeOutStartTime = duration - effectiveFadeOut;
    gain.setValueAtTime(0, 0);
    if (effectiveFadeIn > 0) {
        gain.linearRampToValueAtTime(volume, effectiveFadeIn);
    } else {
        gain.setValueAtTime(volume, 0);
    }
    if (effectiveFadeOut > 0 && fadeOutStartTime > effectiveFadeIn) {
        gain.setValueAtTime(volume, fadeOutStartTime);
        gain.linearRampToValueAtTime(0, duration);
    }
    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();
    audioContext.close();
    return bufferToWav(renderedBuffer);
}
