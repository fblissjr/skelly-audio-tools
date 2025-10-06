import type { AudioSegment, ProcessedAudioResult, WaveformData } from '../types';

const WAVEFORM_WIDTH = 400; // width in samples for segment waveforms
const FULL_WAVEFORM_WIDTH = 800; // width for the full track preview

/**
 * Generates an array of peak values from an AudioBuffer for waveform visualization.
 * @param buffer The AudioBuffer to analyze.
 * @param targetWidth The desired number of data points for the waveform.
 * @returns An array of numbers (0-1) representing audio peaks.
 */
function generateWaveformData(buffer: AudioBuffer, targetWidth: number): WaveformData {
    const data = buffer.getChannelData(0); // Use the first channel
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


/**
 * Decodes an audio file and returns its waveform data and duration.
 */
export async function getAudioInfo(file: File): Promise<{ waveform: WaveformData; duration: number }> {
  const audioContext = new AudioContext();
  const fileBuffer = await file.arrayBuffer();
  const decodedBuffer = await audioContext.decodeAudioData(fileBuffer);
  
  const waveform = generateWaveformData(decodedBuffer, FULL_WAVEFORM_WIDTH);
  const duration = decodedBuffer.duration;

  await audioContext.close();

  return { waveform, duration };
}


/**
 * Encodes an AudioBuffer into a WAV file format Blob.
 */
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

/**
 * Processes an audio file by normalizing, compressing, and splitting it into 30-second segments.
 */
export async function processAudio(
    file: File, 
    options: { normalizationDb: number; compressionPreset: string; },
    originalFullWaveform?: WaveformData | null
): Promise<ProcessedAudioResult> {
  const audioContext = new AudioContext();
  const fileBuffer = await file.arrayBuffer();
  const decodedBuffer = await audioContext.decodeAudioData(fileBuffer);

  // Use provided waveform if available, otherwise generate it.
  const finalOriginalFullWaveform = originalFullWaveform || generateWaveformData(decodedBuffer, FULL_WAVEFORM_WIDTH);

  let peak = 0;
  for (let i = 0; i < decodedBuffer.numberOfChannels; i++) {
    const channelData = decodedBuffer.getChannelData(i);
    channelData.forEach(sample => {
      const absSample = Math.abs(sample);
      if (absSample > peak) peak = absSample;
    });
  }

  const targetAmplitude = 10 ** (options.normalizationDb / 20);
  const gainValue = peak > 0 ? targetAmplitude / peak : 1;

  const totalDuration = decodedBuffer.duration;
  const segmentDuration = 30;
  const numSegments = Math.ceil(totalDuration / segmentDuration);
  const segments: AudioSegment[] = [];

  for (let i = 0; i < numSegments; i++) {
    const startTime = i * segmentDuration;
    const currentSegmentDuration = Math.min(segmentDuration, totalDuration - startTime);

    if (currentSegmentDuration <= 0) continue;
    
    const frameCount = Math.ceil(currentSegmentDuration * decodedBuffer.sampleRate);
    const offlineContext = new OfflineAudioContext(decodedBuffer.numberOfChannels, frameCount, decodedBuffer.sampleRate);

    const source = offlineContext.createBufferSource();
    source.buffer = decodedBuffer;

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
    
    source.start(0, startTime, currentSegmentDuration);

    const renderedBuffer = await offlineContext.startRendering();

    const wavBlob = bufferToWav(renderedBuffer);
    const blobUrl = URL.createObjectURL(wavBlob);
    
    // Generate waveform for the original segment slice
    const originalSegmentBuffer = audioContext.createBuffer(
        decodedBuffer.numberOfChannels, 
        frameCount, 
        decodedBuffer.sampleRate
    );
    for(let chan = 0; chan < decodedBuffer.numberOfChannels; chan++) {
        const sourceData = decodedBuffer.getChannelData(chan);
        const segmentData = sourceData.subarray(
            Math.floor(startTime * decodedBuffer.sampleRate),
            Math.floor((startTime + currentSegmentDuration) * decodedBuffer.sampleRate)
        );
        originalSegmentBuffer.copyToChannel(segmentData, chan);
    }

    segments.push({
        id: i,
        name: `Part_${String(i + 1).padStart(2, '0')}.wav`,
        blobUrl: blobUrl,
        duration: currentSegmentDuration,
        startTime: startTime,
        originalWaveform: generateWaveformData(originalSegmentBuffer, WAVEFORM_WIDTH),
        processedWaveform: generateWaveformData(renderedBuffer, WAVEFORM_WIDTH),
        volume: 1.0,
        fadeInDuration: 0,
        fadeOutDuration: 0,
    });
  }

  return { segments, originalFullWaveform: finalOriginalFullWaveform };
}

/**
 * Applies volume, fade-in, and fade-out adjustments to an audio blob.
 * @param originalBlobUrl The URL of the blob to process.
 * @param effects An object containing volume, fadeInDuration, and fadeOutDuration.
 * @returns A new Blob with the effects applied.
 */
export async function applyEffectsToSegment(
    originalBlobUrl: string, 
    effects: { volume: number; fadeInDuration: number; fadeOutDuration: number; }
): Promise<Blob> {
    const { volume, fadeInDuration, fadeOutDuration } = effects;

    const audioContext = new AudioContext();
    const response = await fetch(originalBlobUrl);
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const offlineContext = new OfflineAudioContext(
        decodedBuffer.numberOfChannels,
        decodedBuffer.length,
        decodedBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = decodedBuffer;

    const gainNode = offlineContext.createGain();

    source.connect(gainNode);
    gainNode.connect(offlineContext.destination);
    
    const { duration } = decodedBuffer;
    const { gain } = gainNode;

    // Sanitize fade durations
    let effectiveFadeIn = Math.max(0, Math.min(fadeInDuration, duration));
    let effectiveFadeOut = Math.max(0, Math.min(fadeOutDuration, duration));

    if (effectiveFadeIn + effectiveFadeOut > duration) {
        // Fades overlap, prioritize fade-in and shorten fade-out
        effectiveFadeOut = duration - effectiveFadeIn;
    }

    const fadeOutStartTime = duration - effectiveFadeOut;

    // Schedule gain changes
    gain.setValueAtTime(0, 0); // Start at silence
    if (effectiveFadeIn > 0) {
        gain.linearRampToValueAtTime(volume, effectiveFadeIn);
    } else {
        gain.setValueAtTime(volume, 0); // No fade in, jump immediately to target volume
    }

    if (effectiveFadeOut > 0 && fadeOutStartTime > effectiveFadeIn) {
        // Ensure volume is stable before fade out begins
        gain.setValueAtTime(volume, fadeOutStartTime);
        gain.linearRampToValueAtTime(0, duration);
    }

    source.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    await audioContext.close();

    return bufferToWav(renderedBuffer);
}