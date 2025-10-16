# Skelly Audio Tools - Technical Documentation

## Project Overview

Skelly Audio Tools is a full-stack web application designed to prepare audio files for the "Skelly" animatronic device. The system processes audio to create perfectly synchronized mouth movements by:

1. Loading audio from YouTube URLs or uploaded files
2. Optionally separating vocals from instrumental tracks using AI
3. Segmenting audio into individual mouth-movement chunks
4. Processing each segment with normalization, compression, and noise gating
5. Exporting segments in a format compatible with Skelly hardware

## Architecture

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for bundling
- Web Audio API for audio processing
- WaveSurfer.js for waveform visualization
- IndexedDB for client-side caching
- Tailwind CSS for styling

**Backend:**
- FastAPI (Python)
- PyTorch for ML vocal separation model
- yt-dlp for YouTube audio extraction
- Mel-Band RoFormer model for vocal separation
- File system caching for downloaded audio

### Project Structure

```
skelly-audio-tools/
├── backend/
│   ├── main.py                 # FastAPI server with endpoints
│   ├── separator.py            # Vocal separation wrapper
│   └── .cache/                 # YouTube download cache
├── vocal_model/                # ML model files (shared)
│   ├── mel_band_roformer.py    # Model architecture
│   ├── attend.py               # Attention mechanism
│   ├── separator.py            # High-level separator wrapper
│   ├── model_vocals_tommy.safetensors  # Current model (692 MB)
│   ├── config_vocals_tommy.yaml        # Model configuration
│   ├── melband_roformer_vocals.safetensors  # Legacy model
│   └── config.yaml             # Legacy config
├── pages/
│   └── PrepPage.tsx            # Main audio preparation interface
├── components/
│   ├── VocalSeparation.tsx     # AI vocal separator component
│   ├── MasterTrackEditor.tsx   # Waveform editor with region selection
│   ├── Results.tsx             # Segment display and download
│   ├── FileUpload.tsx          # Drag-and-drop file upload
│   └── ProcessingOptions.tsx   # Audio processing settings
├── services/
│   ├── audioProcessor.ts       # Core audio processing logic
│   ├── ffmpegService.ts        # Video-to-audio extraction
│   └── database.ts             # IndexedDB wrapper
├── hooks/
│   └── useYouTube.ts           # YouTube audio fetching hook
└── types.ts                    # TypeScript type definitions
```

## Key Features & Workflows

### 1. Audio Input Workflow

**Step 1: Source Selection**
- User chooses between YouTube URL or file upload
- YouTube mode:
  - Fetches audio via backend `/get-audio-url` endpoint
  - Caches in IndexedDB for instant re-access
  - Backend caches downloads in `.cache/` directory
- Upload mode:
  - Accepts audio files (MP3, WAV, M4A, etc.)
  - Accepts video files (MP4, MOV, etc.) and extracts audio via FFmpeg.js

**Step 2: Optional Vocal Separation**
- After audio loads, user can choose to separate vocals
- Uses Mel-Band RoFormer AI model on backend
- Returns ZIP with `vocals.wav` and `instrumental.wav`
- Instrumental track is stored for later recombination
- User can skip this step entirely

**Step 3: Audio Segmentation**
- Manual mode: Select regions on waveform, add as segments
- Auto mode: Automatically detect speech segments
- Each segment gets:
  - Normalization (default -1.0 dB)
  - Dynamic range compression
  - Optional noise gate
  - Fade in/out envelopes

**Step 4: Per-Segment Vocal Separation (Optional)**
- Any individual segment can be separated after segmentation
- Segment-specific instrumental track stored separately
- Enables fine-tuned control over problematic segments

**Step 5: Export**
- Download individual segments or all as ZIP
- Option to recombine vocals with instrumental
- Formats: WAV (for Skelly) or original format

## Technical Implementation

### Audio Processing Pipeline

#### 1. Audio Loading (`services/audioProcessor.ts`)

```typescript
export const getAudioInfo = async (file: File): Promise<AudioBuffer>
```
- Decodes audio file to AudioBuffer using Web Audio API
- Extracts waveform data for visualization
- Returns buffer for further processing

#### 2. Full Track Processing

```typescript
export const processFullTrack = async (
  buffer: AudioBuffer,
  options: ProcessingOptions
): Promise<AudioSegment>
```
- Normalizes audio to target dB level
- Applies dynamic range compression
- Optional noise gate for reducing background noise
- Generates processed waveform for visualization
- Returns AudioSegment with blob URLs

#### 3. Segment Extraction

```typescript
export const extractSegment = async (
  buffer: AudioBuffer,
  params: { startTime: number; endTime: number; segmentId: number }
): Promise<AudioSegment>
```
- Extracts time slice from full audio buffer
- Processes segment with same pipeline as full track
- Applies fade in/out envelopes
- Creates downloadable blob

#### 4. Auto-Split Detection

```typescript
export const autoSplitTrack = async (
  buffer: AudioBuffer
): Promise<AudioSegment[]>
```
- Analyzes audio energy to detect speech segments
- Uses envelope following and threshold detection
- Automatically creates segments at speech boundaries
- Applies minimum/maximum segment duration rules

### Vocal Separation System

#### Backend Implementation (`backend/separator.py`)

The `VocalSeparator` class wraps the Mel-Band RoFormer model:

```python
class VocalSeparator:
    def __init__(self, quantized: bool = False):
        # Loads model from vocal_model/
        # Supports quantized mode for faster CPU inference

    def separate(self, audio_path: str) -> tuple:
        # Returns (vocals_path, instrumental_path, sample_rate)
        # Creates temporary WAV files
```

**Current Model (as of October 2025):**
- **Tommy's 12-Layer Mel-Band RoFormer**
- Source: [Aname-Tommy/Mel_Band_Roformer_Full_Scratch](https://huggingface.co/Aname-Tommy/Mel_Band_Roformer_Full_Scratch)
- 12-layer transformer with 320 dimensions
- 4x overlap for higher quality separation
- Processing: ~65s for 20s audio on CPU
- File: `vocal_model/model_vocals_tommy.safetensors` (692 MB)

**Model Architecture:**
- Mel-Band RoFormer (Rotary Transformer)
- Multi-head attention on mel-spectrogram bands
- Trained from scratch on custom dataset
- Much better separation quality than previous 6-layer model
- See `docs/MODEL_UPGRADE_2025-10.md` for upgrade details

#### Frontend Integration

**Component: `VocalSeparation.tsx`**
- Auto-processes when `audioFile` prop is provided
- Shows real-time processing timer
- Extracts files from ZIP response using JSZip
- Stores separated files as File objects
- Callback to parent with extracted files

**Usage in PrepPage:**
```typescript
<VocalSeparation
  audioFile={masterTrackFile}
  onVocalsExtracted={(vocalsFile, instrumentalFile) => {
    setSeparationDecision('skipped');
    setInstrumentalFile(instrumentalFile);
    handleFileLoad(vocalsFile);
  }}
/>
```

### YouTube Download & Caching System

#### Backend Caching (`backend/main.py`)

**Endpoint: `POST /get-audio-url`**

Flow:
1. Extract video ID from YouTube URL using yt-dlp metadata
2. Check `backend/.cache/` for existing file (video_id.ext)
3. If cached: serve FileResponse immediately
4. If not cached:
   - Download using yt-dlp to `.cache/video_id.%(ext)s`
   - Supports .m4a, .mp3, .webm, .opus formats
   - Serve FileResponse from newly downloaded file
5. Return with `X-Video-Title` header containing video title

**Benefits:**
- Eliminates streaming timeout issues
- Instant re-access of previously downloaded videos
- Reduces YouTube API load
- Persistent cache across server restarts

#### Frontend Caching (`hooks/useYouTube.ts`)

**Dual-layer caching strategy:**

1. **IndexedDB Check:** First checks browser database by video ID
2. **Backend Fetch:** If not in IndexedDB, fetches from backend (which checks its own cache)
3. **IndexedDB Store:** Saves fetched audio for future sessions

**Database schema (`services/database.ts`):**
```typescript
interface AudioRecord {
  id: string;        // YouTube video ID
  title: string;     // Video title
  data: ArrayBuffer; // Audio data
}
```

### Type System

#### Core Types (`types.ts`)

**AudioSegment:**
```typescript
export interface AudioSegment {
  id: number;                      // Unique segment identifier
  name: string;                    // Display name
  blobUrl: string;                 // URL for playback/download
  duration: number;                // Length in seconds
  startTime: number;               // Position in original track
  originalWaveform: WaveformData;  // Pre-processing waveform
  processedWaveform: WaveformData; // Post-processing waveform
  volume: number;                  // Volume multiplier (1.0 = default)
  fadeInDuration: number;          // Fade in time (seconds)
  fadeOutDuration: number;         // Fade out time (seconds)

  // Vocal separation state
  isSeparated?: boolean;           // Has been through vocal separation
  instrumentalBlobUrl?: string;    // Separated instrumental track
  originalMixBlobUrl?: string;     // Original before separation
}
```

**Processing Options:**
```typescript
interface ProcessingOptions {
  normalizationDb: number;       // Target dB level (-1.0 default)
  compressionPreset: string;     // 'light' | 'medium' | 'heavy'
  noiseGateThreshold: number;    // dB threshold (-100 = off)
  jawSensitivity: number;        // Activation threshold (0.25 default)
}
```

### State Management

**PrepPage State Flow:**

```typescript
// Input selection
const [inputType, setInputType] =
  useState<'upload' | 'youtube'>('youtube');

// Separation workflow
const [separationDecision, setSeparationDecision] =
  useState<'undecided' | 'separating' | 'skipped'>('undecided');

// Core audio data
const [rawAudioBuffer, setRawAudioBuffer] =
  useState<AudioBuffer | null>(null);
const [masterTrack, setMasterTrack] =
  useState<AudioSegment | null>(null);
const [processedSegments, setProcessedSegments] =
  useState<AudioSegment[]>([]);

// Separation files
const [instrumentalFile, setInstrumentalFile] =
  useState<File | null>(null);
const [masterTrackFile, setMasterTrackFile] =
  useState<File | null>(null);
```

**State Transitions:**

1. Initial: `inputType='youtube'`, `separationDecision='undecided'`, `masterTrack=null`
2. After load: `masterTrack` populated, `separationDecision='undecided'` triggers decision UI
3. User choice: `separationDecision='separating'` or `'skipped'`
4. After separation: `instrumentalFile` stored, `masterTrackFile` updated with vocals
5. Segmentation: `processedSegments` populated as user adds segments

### Audio Recombination

**Implementation in `Results.tsx`:**

The `recombineAudio()` function mixes vocals and instrumental:

```typescript
const recombineAudio = async (): Promise<Blob> => {
  const audioContext = new AudioContext();

  // 1. Load vocals buffer (current segment audio)
  const vocalsBuffer = await loadAudioBuffer(segment.blobUrl);

  // 2. Load instrumental buffer
  let instrumentalBuffer: AudioBuffer;
  if (segment.instrumentalBlobUrl) {
    // Segment-specific instrumental (from per-segment separation)
    instrumentalBuffer = await loadAudioBuffer(segment.instrumentalBlobUrl);
  } else if (globalInstrumentalFile) {
    // Extract segment from global instrumental track
    instrumentalBuffer = extractSegmentFromGlobal(
      globalInstrumentalFile,
      segment.startTime,
      segment.duration
    );
  }

  // 3. Mix buffers by summing samples
  const mixedBuffer = audioContext.createBuffer(
    numberOfChannels,
    maxLength,
    sampleRate
  );

  for (let channel = 0; channel < numberOfChannels; channel++) {
    for (let i = 0; i < maxLength; i++) {
      mixedBuffer.getChannelData(channel)[i] =
        (vocals[i] || 0) + (instrumental[i] || 0);
    }
  }

  // 4. Convert to WAV blob
  return bufferToWave(mixedBuffer, sampleRate);
};
```

**WAV Encoding (`bufferToWave()`):**
- Writes proper WAV header (RIFF, fmt, data chunks)
- Converts Float32 samples to Int16 PCM
- Interleaves multi-channel data
- Returns blob ready for download

## API Reference

### Backend Endpoints

#### `POST /get-audio-url`

Fetches audio from YouTube URL with caching.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response:**
- Content-Type: `audio/mp4`
- Headers: `X-Video-Title` (URL-encoded video title)
- Body: Audio file stream

**Caching:**
- Cache key: YouTube video ID
- Cache location: `backend/.cache/`
- Cache formats: .m4a, .mp3, .webm, .opus

#### `POST /separate-vocals`

Separates vocals from instrumental using AI model.

**Request:**
- Content-Type: `multipart/form-data`
- Field: `file` (audio file)

**Response:**
- Content-Type: `application/zip`
- ZIP contents:
  - `vocals.wav` - Isolated vocal track
  - `instrumental.wav` - Music without vocals

**Processing:**
- Model: Mel-Band RoFormer
- Mode: Set `QUANTIZED=1` env var for CPU optimization
- Duration: ~1 minute per minute of audio on CPU

**Error Handling:**
- 503: Model not loaded
- 500: Processing error

## Component Reference

### PrepPage

**Path:** `pages/PrepPage.tsx`

**Purpose:** Main orchestration component for entire workflow

**Key Functions:**
- `handleFileLoad(file)` - Processes uploaded or fetched audio
- `handleYouTubeFetch()` - Fetches audio from YouTube URL
- `handleAddSegment()` - Creates segment from selected region
- `handleAutoSplit()` - Auto-detects and creates segments
- `handleSegmentSeparateVocals(segmentId, file)` - Separates individual segment

**Render Flow:**
1. Step 1: Input selection (YouTube/Upload) - always visible first
2. Processing indicator during load
3. Optional separation decision screen
4. Step 2: Segmentation tools (after separation decision)
5. Results display with download options

### VocalSeparation

**Path:** `components/VocalSeparation.tsx`

**Props:**
```typescript
interface VocalSeparationProps {
  audioFile?: File | null;  // Auto-process if provided
  onVocalsExtracted?: (vocals: File, instrumental: File) => void;
}
```

**Features:**
- Auto-processing via useEffect when audioFile provided
- Real-time processing timer
- ZIP extraction using JSZip
- Download individual tracks
- "Load Vocals" button to continue workflow

### MasterTrackEditor

**Path:** `components/MasterTrackEditor.tsx`

**Purpose:** Interactive waveform editor with region selection

**Features:**
- WaveSurfer.js integration
- Visual threshold line for jaw sensitivity
- Region selection and editing
- "Add Segment" button for manual segmentation
- "Auto Split" button for automatic detection

**Props:**
- `masterTrack` - Full audio segment
- `selectedRegion` - Currently selected time range
- `activationThreshold` - Visual threshold overlay
- `onRegionChange` - Callback when region selected
- `onAddSegment` - Callback to create segment
- `onAutoSplit` - Callback for auto-split

### Results

**Path:** `components/Results.tsx`

**Purpose:** Display, manage, and download processed segments

**Features per segment:**
- Audio playback with WaveSurfer
- Waveform visualization (original + processed)
- Volume control
- Fade in/out adjustment
- "Separate Vocals" button (if not already separated)
- "Recombine with Instrumental" toggle (if separated)
- Download individual segment
- Delete segment

**Download modes:**
1. Vocals only (if separated)
2. Recombined with instrumental (if checkbox enabled)
3. Original mix (if not separated)

**Bulk actions:**
- "Download All" - Creates ZIP with all segments
- Respects recombination settings per segment

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.13
- uv (Python package manager)

### Installation

1. **Clone repository:**
```bash
git clone <repo-url>
cd skelly-audio-tools
```

2. **Install frontend dependencies:**
```bash
npm install
```

3. **Setup Python environment:**
```bash
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -r backend/requirements.txt
```

4. **Download vocal separation model:**
   - Place model files in `backend/vocal_model/melband_roformer_model/`
   - Requires: `model.safetensors` and `config.yaml`

### Running Development Servers

**Frontend (port 5173):**
```bash
npm run dev
```

**Backend (port 8000):**
```bash
cd backend
source ../.venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
```

### Environment Variables

**Backend:**
- No environment variables currently in use (quantized mode removed in October 2025 upgrade)

**Frontend:**
- Configured via Vite - see `vite.config.ts`

## Key Algorithms

### Normalization

```typescript
function normalize(channelData: Float32Array, targetDb: number): Float32Array {
  // 1. Find peak absolute value
  let peak = 0;
  for (let i = 0; i < channelData.length; i++) {
    peak = Math.max(peak, Math.abs(channelData[i]));
  }

  // 2. Calculate target amplitude from dB
  const targetAmp = Math.pow(10, targetDb / 20);

  // 3. Calculate gain multiplier
  const gain = peak > 0 ? targetAmp / peak : 1;

  // 4. Apply gain to all samples
  const normalized = new Float32Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    normalized[i] = channelData[i] * gain;
  }

  return normalized;
}
```

### Dynamic Range Compression

```typescript
function compress(
  channelData: Float32Array,
  preset: 'light' | 'medium' | 'heavy'
): Float32Array {
  const params = {
    light:  { threshold: 0.7, ratio: 2, knee: 0.1 },
    medium: { threshold: 0.5, ratio: 4, knee: 0.1 },
    heavy:  { threshold: 0.3, ratio: 8, knee: 0.1 }
  }[preset];

  const compressed = new Float32Array(channelData.length);

  for (let i = 0; i < channelData.length; i++) {
    const input = Math.abs(channelData[i]);
    let output = input;

    if (input > params.threshold) {
      // Calculate compression
      const excess = input - params.threshold;
      output = params.threshold + (excess / params.ratio);
    }

    // Preserve sign
    compressed[i] = Math.sign(channelData[i]) * output;
  }

  return compressed;
}
```

### Noise Gate

```typescript
function applyNoiseGate(
  channelData: Float32Array,
  thresholdDb: number
): Float32Array {
  if (thresholdDb <= -100) return channelData; // Disabled

  const threshold = Math.pow(10, thresholdDb / 20);
  const gated = new Float32Array(channelData.length);

  for (let i = 0; i < channelData.length; i++) {
    gated[i] = Math.abs(channelData[i]) > threshold
      ? channelData[i]
      : 0;
  }

  return gated;
}
```

### Envelope Detection (for Auto-Split)

```typescript
function detectEnvelope(
  channelData: Float32Array,
  windowSize: number
): Float32Array {
  const envelope = new Float32Array(channelData.length);

  for (let i = 0; i < channelData.length; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize && (i + j) < channelData.length; j++) {
      sum += Math.abs(channelData[i + j]);
    }
    envelope[i] = sum / windowSize;
  }

  return envelope;
}
```

## Performance Considerations

### Frontend

1. **Audio Buffer Management:**
   - Use blob URLs for audio playback
   - Revoke blob URLs when components unmount
   - Don't store large buffers in React state

2. **Waveform Rendering:**
   - Downsample waveform data for visualization
   - Typical: 1 point per 100-1000 samples
   - Store downsampled data, not full buffer

3. **IndexedDB:**
   - Async operations don't block UI
   - Automatic persistence across sessions
   - Storage quota: ~50% of available disk space

### Backend

1. **Vocal Separation:**
   - CPU-bound: ~1 min processing per 1 min audio
   - Memory: ~2GB for model + inference
   - Use quantized model for 2-3x speedup on CPU
   - Consider GPU deployment for production

2. **YouTube Caching:**
   - First download: 5-30 seconds (depends on video)
   - Cached access: <100ms
   - Storage: ~1-5MB per minute of audio
   - Manual cleanup required for `.cache/` directory

3. **File Operations:**
   - All I/O operations are async
   - Background cleanup of temporary files
   - ZIP creation is CPU-bound but fast (<1s)

## Troubleshooting

### YouTube Download Issues

**Symptom:** Download spins forever or times out

**Causes:**
- yt-dlp needs updating
- YouTube changed API
- Network connectivity

**Solutions:**
```bash
# Update yt-dlp
uv pip install --upgrade yt-dlp

# Clear cache
rm -rf backend/.cache/*

# Check backend logs for errors
```

### Vocal Separation Fails

**Symptom:** 503 error or "Model not loaded"

**Causes:**
- Model files missing
- Incorrect file paths
- Insufficient memory

**Solutions:**
```bash
# Verify model files exist
ls -lh backend/vocal_model/melband_roformer_model/

# Check model loading in logs
# Should see: "✓ Vocal separator ready!"

# Try quantized mode for less memory
QUANTIZED=1 uvicorn main:app --host 127.0.0.1 --port 8000
```

### Audio Processing Errors

**Symptom:** "Failed to load audio" or "Failed to extract segment"

**Causes:**
- Unsupported audio format
- Corrupted file
- Browser compatibility

**Solutions:**
- Convert to MP3 or WAV before upload
- Try different browser (Chrome recommended)
- Check browser console for detailed errors

### Waveform Not Displaying

**Symptom:** Blank waveform or "Loading..."

**Causes:**
- WaveSurfer.js initialization failed
- Audio buffer not decoded
- Invalid blob URL

**Solutions:**
- Check browser console for errors
- Verify audio file is valid
- Try reloading the page

## Future Enhancements

### Planned Features

1. **Multi-track Mixing:**
   - Support for background music tracks
   - Volume balancing between vocals and music
   - Real-time preview of mix

2. **Advanced Segmentation:**
   - Word-level segmentation using speech-to-text
   - Phoneme detection for precise mouth sync
   - Custom split points based on transcript

3. **Export Formats:**
   - Direct export to Skelly hardware format
   - Metadata file with timing information
   - Project save/load functionality

4. **Performance:**
   - Web Workers for audio processing
   - GPU acceleration for vocal separation (WebGPU)
   - Streaming processing for large files

5. **UI/UX:**
   - Keyboard shortcuts for common actions
   - Undo/redo support
   - Batch processing multiple files

### Known Limitations

1. **Browser Compatibility:**
   - Requires modern browser with Web Audio API support
   - Best performance in Chrome/Edge
   - Safari has limited AudioContext support

2. **File Size:**
   - Frontend processing limited by browser memory
   - Recommend max 30 minutes of audio
   - Large files may cause browser to slow down

3. **Vocal Separation:**
   - CPU-only inference takes ~65s for 20s audio (October 2025 model)
   - Quality depends on source material
   - Works best with clear vocals and instrumental separation
   - Trade-off: 4.4x slower than legacy model but much better quality

4. **Cache Management:**
   - No automatic cleanup of `.cache/` directory
   - No size limits on IndexedDB cache
   - Manual intervention required for disk space

## Credits

- **Current Vocal Model:** [Tommy's Mel-Band RoFormer](https://huggingface.co/Aname-Tommy/Mel_Band_Roformer_Full_Scratch) by Aname-Tommy
- **Model Architecture:** Mel-Band RoFormer from [lucidrains/BS-RoFormer](https://github.com/lucidrains/BS-RoFormer)
- **Model Research:** [MVSep.com](https://mvsep.com/) leaderboard & [ZFTurbo Training Framework](https://github.com/ZFTurbo/Music-Source-Separation-Training)
- **WaveSurfer.js:** [WaveSurfer.js](https://wavesurfer-js.org/)
- **yt-dlp:** [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **FastAPI:** [FastAPI](https://fastapi.tiangolo.com/)
- **PyTorch:** [PyTorch](https://pytorch.org/)

## License

See LICENSE file for details.
