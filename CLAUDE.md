# Skelly Audio Tools - Technical Documentation

## Project Overview

Skelly Audio Tools is a full-stack web application designed to prepare audio files for the "Skelly" animatronic device. The system processes audio to create perfectly synchronized mouth movements.

**🚀 Quick Start:**
```bash
./setup.sh      # Interactive configuration wizard
./start.sh dev  # Start development environment
```

**📖 Documentation Index:**
- [CHANGELOG.md](CHANGELOG.md) - Version history and release notes
- [Internal Documentation](internal/README.md) - Complete documentation index
  - **Backend:**
    - [Job Management](internal/backend/JOB_MANAGEMENT.md) - Track and cancel operations
    - [Caching System](internal/backend/CACHING_SYSTEM.md) - Two-layer caching architecture
    - [Testing with Cache](internal/backend/TESTING_CACHE.md) - Test using cached files
  - **Performance & Optimization:**
    - [Quick Start](internal/vocal_model/OPTIMIZATION_README.md) - ONNX/CUDA optimization guide
    - [Detailed Guide](internal/vocal_model/PERFORMANCE_OPTIMIZATION.md) - Complete optimization docs
    - [Technical Summary](internal/vocal_model/OPTIMIZATION_SUMMARY.md) - Performance benchmarks
  - **User Experience:**
    - [UX Improvements v1.0.2](internal/ux/UX_IMPROVEMENTS_1.0.2.md) - Major UI/UX overhaul (placeholder)
  - **Hardware:**
    - [Skelly Decor SVR Setup](internal/hardware/SKELLY_DECOR_SVR_SETUP.md) - iRig 2 recording (placeholder)

## Core Workflow

1. Loading audio from YouTube URLs or uploaded files
2. Batch processing multiple files with automatic YOLO mode optimization
3. AI-powered vocal separation using Mel-Band RoFormer model
4. Smart mixing: vocals boosted to 120%, instrumental reduced to 25%
5. Segmenting audio into individual mouth-movement chunks
6. Processing each segment with normalization, compression, and noise gating
7. Exporting segments individually with full cache management

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
│   └── PrepPage.tsx            # Main app with tab navigation
├── components/
│   ├── VocalSeparationTab.tsx  # Vocal separation with single/batch modes
│   ├── BatchYoloProcessor.tsx  # [NEW] Batch queue processor with YOLO mode
│   ├── MasterTrackEditor.tsx   # Waveform editor with region selection
│   ├── Results.tsx             # Segment display with vocal volume controls
│   ├── FileUpload.tsx          # Drag-and-drop file upload
│   └── ProcessingOptions.tsx   # Audio processing settings
├── services/
│   ├── audioProcessor.ts       # Core audio processing logic
│   ├── ffmpegService.ts        # Video-to-audio extraction
│   └── database.ts             # IndexedDB with getAllAudioRecords()
├── hooks/
│   └── useYouTube.ts           # YouTube audio fetching hook
└── types.ts                    # TypeScript type definitions
```

## Key Features & Workflows

### Tab-Based Navigation

The app now uses a clean tab interface:

1. **Audio Prep & Segmentation Tab**: Main workflow for audio loading and segmentation
2. **Vocal Separation Studio Tab**: Dedicated tab for AI vocal separation with single/batch modes

---

### 1. Vocal Separation Studio (NEW!)

#### Single File Mode

**Step 1: Enable YOLO Mode (Optional)**
- Toggle YOLO Mode checkbox for automatic optimization
- YOLO Mode: Vocals at 120%, instrumental at 25%
- Ensures Skelly's mouth moves primarily on vocals

**Step 2: Upload Audio**
- Drag & drop or select audio/video file
- Processing happens automatically

**Step 3: AI Processing**
- Real-time progress indicators show:
  - "Separating vocals from instrumental using AI..."
  - "Extracting separated tracks from ZIP..."
  - "Creating YOLO Mix..." (if enabled)
- Shows elapsed time and processing stage

**Step 4: Results**
- If YOLO Mode enabled: Get "YOLO Mix - Ready for Skelly!" file
- Individual tracks available: Vocals, Instrumental, Original
- Volume controls for previewing each track (0-200%)
- Download any track individually
- Visual explanations of what's in each mix

#### Batch Queue Mode (NEW!)

**Step 1: Add Files to Queue**
Multiple input methods:
- **Upload Files**: Select multiple audio/video files
- **YouTube Cache**: Add previously downloaded YouTube audio
- **Mix & Match**: Combine files from any source

**Step 2: Review Queue**
Each item shows:
- File name and type (file/youtube)
- Status: Pending → Processing → Completed/Error
- Real-time progress messages

**Step 3: Start Processing**
- Click "Start Processing" button
- Queue processes automatically, one by one
- Each file goes through full YOLO pipeline:
  1. Load audio
  2. Analyze original (calculate peak dB)
  3. AI vocal separation
  4. Analyze vocals (calculate peak dB)
  5. Create YOLO mix (vocals 120%, instrumental 25%)
  6. Analyze YOLO mix (calculate peak dB)

**Step 4: Manage Results**
For each processed file:
- **Expandable cards** with stats
- **Visual comparison**: Original vs Vocals vs YOLO Mix peak dB
- **Four download options**:
  - Original audio
  - Vocals only
  - Instrumental only
  - YOLO Mix (Skelly-optimized!)
- **Delete button**: Remove from results and free memory
- **Processing time**: Shows how long it took

**Queue Controls:**
- Clear Completed: Remove finished items
- Remove: Delete individual pending items
- Delete: Remove processed results

---

### 2. Audio Prep & Segmentation Workflow

**Step 1: Source Selection**
- User chooses between YouTube URL or file upload
- YouTube mode:
  - Fetches audio via backend `/get-audio-url` endpoint
  - Caches in IndexedDB for instant re-access
  - Backend caches downloads in `.cache/` directory
- Upload mode:
  - Accepts audio files (MP3, WAV, M4A, etc.)
  - Accepts video files (MP4, MOV, etc.) and extracts audio via FFmpeg.js

**Step 2: Audio Segmentation**
- Manual mode: Select regions on waveform, add as segments
- Auto mode: Automatically detect speech segments
- Each segment gets:
  - Normalization (default -1.0 dB)
  - Dynamic range compression
  - Optional noise gate
  - Fade in/out envelopes

**Step 3: Per-Segment Vocal Separation (Optional)**
- Any individual segment can be separated after segmentation
- Segment-specific instrumental track stored separately
- Enables fine-tuned control over problematic segments

**Step 4: Segment Management & Export**
- Volume control per segment (0-200%)
- Vocal volume control when recombining (0-200%)
- Fade in/out adjustment
- Download individual segments (no ZIP files!)
- Delete unwanted segments
- Recombine with instrumental option

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

**Current Model (as of December 2024):**
- **Tommy's 12-Layer Mel-Band RoFormer**
- Source: [Aname-Tommy/Mel_Band_Roformer_Full_Scratch](https://huggingface.co/Aname-Tommy/Mel_Band_Roformer_Full_Scratch)
- 12-layer transformer with 320 dimensions
- **2x overlap (optimized December 2024)** - 2x faster than 4x
- Processing: ~32s for 20s audio on CPU
- File: `vocal_model/model_vocals_tommy.safetensors` (692 MB)

**Model Architecture:**
- Mel-Band RoFormer (Rotary Transformer)
- Multi-head attention on mel-spectrogram bands
- Trained from scratch on custom dataset
- Much better separation quality than previous 6-layer model
- See `docs/MODEL_UPGRADE_2025-10.md` for upgrade details

**Performance Optimization:**
- Changed `num_overlap: 4` to `num_overlap: 2` in `config_vocals_tommy.yaml`
- 2x speed improvement with negligible quality loss
- Before: ~65s for 20s audio | After: ~32s for 20s audio

**Multiple Backend Support (v1.1.0):**
- **ONNX Runtime**: 2-5x faster CPU inference (enabled by default)
- **INT8 Quantization**: Additional 2-4x speedup with ~99% quality
- **Remote CUDA**: 5-10x faster via remote GPU server
- **Automatic Fallback**: Remote CUDA → ONNX → PyTorch CPU
- See: [Optimization Quick Start](internal/vocal_model/OPTIMIZATION_README.md)

**Environment Variables:**
```bash
USE_ONNX=1              # Enable ONNX Runtime (default: enabled)
QUANTIZED=1             # Use INT8 quantized model
CPU_THREADS=4           # Set CPU thread count
REMOTE_CUDA_URL=http://gpu:8001  # Remote GPU server
```

**Performance Comparison (i5-6500, 4 cores):**
| Backend | Time (20s audio) | Speedup |
|---------|-----------------|---------|
| PyTorch CPU | ~32s | 1x (baseline) |
| ONNX Runtime | ~8-16s | 2-4x |
| ONNX + INT8 | ~6-10s | 3-5x |
| Remote CUDA | ~2-4s | 8-16x |

---

### YOLO Mode System (NEW!)

YOLO Mode is an intelligent audio optimization system designed specifically for Skelly animatronic performances. It ensures mouth movements are triggered primarily by vocals, not background music.

#### What YOLO Mode Does

1. **AI Vocal Separation**: Uses Mel-Band RoFormer to isolate vocals from instrumental
2. **Smart Mixing**:
   - Vocals boosted to **120%** volume
   - Instrumental reduced to **25%** volume
   - Soft clipping applied to prevent distortion
3. **Statistical Analysis**: Calculates peak dB for original, vocals, and YOLO mix
4. **Visual Feedback**: Shows before/after comparison stats

#### YOLO Mix Algorithm

```typescript
const createYoloMix = async (vocalsBuffer: AudioBuffer, instrumentalBuffer: AudioBuffer) => {
  const vocalGain = 1.2;       // 120% boost
  const instrumentalGain = 0.25; // 25% reduction

  for (let channel = 0; channel < numberOfChannels; channel++) {
    for (let i = 0; i < maxLength; i++) {
      let sample = 0;
      if (vocalsData) sample += vocalsData[i] * vocalGain;
      if (instData) sample += instData[i] * instrumentalGain;

      // Soft clipping prevents distortion
      sample = Math.max(-1, Math.min(1, sample));
      mixedData[i] = sample;
    }
  }
};
```

#### When to Use YOLO Mode

- **Songs with prominent instrumentals**: Ensures Skelly's mouth doesn't move during guitar solos or drum fills
- **Background music scenes**: Vocals stay audible over music
- **Batch processing**: Automatically optimizes multiple files with consistent settings
- **Quick setup**: One-click optimization, no manual mixing required

#### YOLO Mode Workflow

**Single File:**
1. Check "YOLO Mode" checkbox
2. Upload audio file
3. AI separates vocals (1-2 minutes)
4. YOLO mix created automatically
5. Download "YOLO Mix - Ready for Skelly!" file

**Batch Queue:**
1. Add multiple files to queue
2. YOLO mode enabled by default
3. Each file processes automatically:
   - AI separation
   - Statistical analysis
   - YOLO mix creation
4. Download individual YOLO mixes

#### Frontend Integration

**Component: `VocalSeparationTab.tsx`**
- Single/Batch mode toggle
- YOLO Mode checkbox with explanation
- Real-time progress indicators:
  - "Separating vocals from instrumental using AI..."
  - "Creating YOLO Mix: Boosting vocals and reducing instrumental..."
  - "Creating YOLO Mix: Converting to WAV..."
- Stats display: Original vs Vocals vs YOLO Mix peak dB

**Component: `BatchYoloProcessor.tsx`**
- Queue management system
- Per-file YOLO processing
- Statistical comparison for each result
- Individual download/delete controls

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
- Model: Mel-Band RoFormer (12-layer, 2x overlap for speed)
- CPU-optimized: ~32s for 20s audio (2x faster than 4x overlap)
- Duration: ~1.5 minutes per minute of audio on CPU

**Error Handling:**
- 503: Model not loaded
- 500: Processing error

## Component Reference

### PrepPage

**Path:** `pages/PrepPage.tsx`

**Purpose:** Main app container with tab navigation system

**State:**
- `activeTab`: 'prep' | 'separation' - Controls which tab is visible

**Key Functions:**
- `handleFileLoad(file)` - Processes uploaded or fetched audio
- `handleYouTubeFetch()` - Fetches audio from YouTube URL
- `handleAddSegment()` - Creates segment from selected region
- `handleAutoSplit()` - Auto-detects and creates segments
- `handleSegmentSeparateVocals(segmentId, file)` - Separates individual segment

**Render Flow:**
1. Tab navigation (Audio Prep & Segmentation | Vocal Separation Studio)
2. Conditional rendering based on activeTab
3. Prep tab: Input selection → Segmentation → Results
4. Separation tab: Single/Batch mode selection → Processing

---

### VocalSeparationTab (NEW!)

**Path:** `components/VocalSeparationTab.tsx`

**Purpose:** Dual-mode vocal separation interface

**State:**
- `processingMode`: 'single' | 'batch' - Controls single file or batch queue mode
- `yoloMode`: boolean - Enables YOLO auto-optimization
- `processingStep`: string - Current processing step for progress display

**Single File Mode Features:**
- YOLO Mode toggle with clear explanation
- Real-time progress with step-by-step messages
- Vocal and instrumental volume controls (0-200%)
- Individual track downloads
- YOLO Mix preview with specs

**Batch Mode:**
- Renders `<BatchYoloProcessor />` component
- See BatchYoloProcessor section below

---

### BatchYoloProcessor (NEW!)

**Path:** `components/BatchYoloProcessor.tsx`

**Purpose:** Queue-based batch processing system with YOLO auto-optimization

**State:**
```typescript
interface QueueItem {
  id: string;
  name: string;
  type: 'file' | 'youtube';
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: string;
  error?: string;
  result?: ProcessedAudio;
}

interface ProcessedAudio {
  id: string;
  sourceName: string;
  originalUrl: string;
  vocalsUrl: string;
  instrumentalUrl: string;
  yoloMixUrl: string;
  stats: {
    originalPeakDb: number;
    vocalsPeakDb: number;
    yoloPeakDb: number;
    processingTime: number;
  };
}
```

**Key Functions:**
- `addToQueue(sources)` - Add files/YouTube audio to queue
- `processQueue()` - Process all pending items sequentially
- `processItem(item)` - Full YOLO pipeline for one file:
  1. Load audio
  2. Calculate original peak dB
  3. AI vocal separation
  4. Calculate vocals peak dB
  5. Create YOLO mix (vocals 120%, instrumental 25%)
  6. Calculate YOLO mix peak dB
- `calculateAudioStats(buffer)` - Measure peak amplitude in dB
- `deleteResult(id)` - Remove result and revoke blob URLs
- `downloadFile(url, filename)` - Download individual track

**Features:**
- Multiple input sources: file upload, YouTube cache
- YouTube history dropdown with "Add to Queue" buttons
- Real-time queue status updates
- Expandable result cards with stats comparison
- Four download options per result
- Individual file management (delete)
- Queue controls (Start, Clear Completed, Remove)
- Memory management via blob URL cleanup

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
- Volume control (0-200%)
- **[NEW]** Vocal volume control (0-200%) when recombining
- Fade in/out adjustment
- "Separate Vocals" button (if not already separated)
- "Recombine with Instrumental" toggle (if separated)
- Download individual segment (WAV format)
- Delete segment

**Vocal Volume Control (NEW!):**
- Appears when "Recombine with Instrumental" is checked
- Slider range: 0-200%
- Default: 100%
- Applied during `recombineAudio()` mixing:
  ```typescript
  sample += vocalsData[i] * vocalVolume;
  ```
- Allows fine-tuning vocal prominence in the mix

**Download modes:**
1. Vocals only (if separated)
2. Recombined with instrumental at custom vocal volume (if checkbox enabled)
3. Original mix (if not separated)

**Bulk actions:**
- "Download All" - Creates ZIP with all segments
- Respects recombination and vocal volume settings per segment

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
   - **CPU Performance (Optimized):**
     - ~32 seconds for 20 seconds of audio
     - ~1.5 minutes per 1 minute of audio
     - Optimization: 2x overlap (down from 4x) for 2x speed boost
     - Config: `vocal_model/config_vocals_tommy.yaml` - `num_overlap: 2`
   - **Memory:** ~2GB for model + inference
   - **Model:** Tommy's 12-layer Mel-Band RoFormer
   - **Quality:** Still excellent with 2x overlap
   - **GPU:** Would be ~5-10x faster, recommended for production

2. **Batch Processing:**
   - Processes files sequentially to avoid memory issues
   - Each file: ~1.5 minutes per minute of audio
   - Example: 8 files × 3 minutes each = ~36 minutes total
   - Progress tracked per file with real-time updates
   - Failed files don't stop the queue

3. **YouTube Caching:**
   - First download: 5-30 seconds (depends on video)
   - Cached access: <100ms via IndexedDB
   - Storage: ~1-5MB per minute of audio
   - Backend cache: `.cache/` directory (manual cleanup)
   - Frontend cache: IndexedDB (managed via delete buttons)

4. **File Operations:**
   - All I/O operations are async
   - Background cleanup of temporary files
   - No ZIP files in new workflow (individual downloads)
   - Blob URL management for memory efficiency

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

### Recent Features (December 2024)

1. **✓ Tab-Based Navigation:**
   - Clean separation between Vocal Separation and Audio Prep
   - Easy switching between workflows
   - No more confusing decision screens

2. **✓ YOLO Mode:**
   - Automatic vocal optimization (vocals 120%, instrumental 25%)
   - Perfect for Skelly - mouth moves primarily on vocals
   - Clear visual feedback on what's happening
   - Stats show before/after comparison

3. **✓ Batch Processing:**
   - Queue system for processing multiple files
   - Supports file upload + YouTube cache
   - Sequential processing with progress tracking
   - Individual file management (download/delete)

4. **✓ Vocal Volume Control:**
   - Adjust vocal level in recombined mixes (0-200%)
   - Available in both segmentation and batch modes
   - Real-time preview

5. **✓ Performance Optimization:**
   - 2x faster vocal separation (2x overlap instead of 4x)
   - ~32 seconds for 20 seconds of audio
   - No quality loss

6. **✓ Individual Downloads:**
   - No more ZIP files
   - Download any track individually
   - Better file management

### Planned Features

1. **Advanced Segmentation:**
   - Word-level segmentation using speech-to-text
   - Phoneme detection for precise mouth sync
   - Custom split points based on transcript

2. **Export Formats:**
   - Direct export to Skelly hardware format
   - Metadata file with timing information
   - Project save/load functionality

3. **Performance:**
   - Web Workers for audio processing
   - GPU acceleration for vocal separation (WebGPU)
   - Streaming processing for large files
   - Parallel batch processing (multiple files at once)

4. **UI/UX:**
   - Keyboard shortcuts for common actions
   - Undo/redo support
   - Drag & drop reordering in batch queue
   - Batch download all results

### Known Limitations

1. **Browser Compatibility:**
   - Requires modern browser with Web Audio API support
   - Best performance in Chrome/Edge
   - Safari has limited AudioContext support

2. **File Size:**
   - Frontend processing limited by browser memory
   - Recommend max 30 minutes of audio per file
   - Large files may cause browser to slow down
   - Batch mode handles large queues well (sequential processing)

3. **Vocal Separation:**
   - CPU-only inference: ~32s for 20s audio (optimized December 2024)
   - Quality depends on source material
   - Works best with clear vocals and instrumental separation
   - Sequential batch processing (one at a time to avoid memory issues)

4. **Cache Management:**
   - Backend `.cache/` directory requires manual cleanup
   - Frontend IndexedDB has delete buttons per result
   - No automatic size limits (uses available browser storage)

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
