# Skelly Audio Tools - Technical Documentation

## Project Overview

Skelly Audio Tools is a full-stack web application for preparing audio files for the Skelly animatronic device. The system processes audio to create perfectly synchronized mouth movements.

**🚀 Quick Start:**
```bash
./setup.sh      # Interactive configuration wizard
./start.sh dev  # Start development environment
```

**📖 Documentation:**
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [Internal Documentation](internal/README.md) - Complete technical docs
- [Filename Refactoring](internal/FILENAME_REFACTOR_SUMMARY.md) - Metadata-based naming system
- [Job Management](internal/backend/JOB_MANAGEMENT.md) - Track/cancel operations
- [Caching System](internal/backend/CACHING_SYSTEM.md) - Two-layer caching
- [Model Upgrade](internal/vocal_model/MODEL_UPGRADE_2025-10.md) - Tommy's 12-layer model
- [Optimization](internal/vocal_model/OPTIMIZATION_README.md) - ONNX/CUDA performance
- [Hardware Setup](internal/hardware/SKELLY_DECOR_SVR_SETUP.md) - iRig 2 recording

## Core Workflow

1. **Audio Input**: YouTube URL or file upload (audio/video)
2. **Vocal Separation** (optional): AI-powered isolation using Mel-Band RoFormer
3. **YOLO Mode**: Smart mixing (vocals 120%, instrumental 25%)
4. **Segmentation**: Manual region selection or auto-split into 30s chunks
5. **Processing**: Normalization, compression, noise gate per segment
6. **Export**: Download with meaningful filenames based on source metadata

## Architecture

### Tech Stack

**Frontend:**
- React 18 + TypeScript + Vite
- Web Audio API for processing
- WaveSurfer.js for visualization
- IndexedDB for client-side caching
- Tailwind CSS

**Backend:**
- FastAPI (Python)
- PyTorch / ONNX Runtime for ML
- yt-dlp for YouTube extraction
- Mel-Band RoFormer for vocal separation
- Filesystem caching

### Project Structure

```
skelly-audio-tools/
├── backend/
│   ├── main.py                 # FastAPI server, job management
│   ├── separator.py            # Vocal separation wrapper
│   └── .cache/                 # YouTube download cache
├── vocal_model/                # ML model files
│   ├── mel_band_roformer.py    # Model architecture
│   ├── model_vocals_tommy.safetensors  # 12-layer model (692 MB)
│   └── config_vocals_tommy.yaml        # Model configuration
├── pages/
│   └── PrepPage.tsx            # Main app with tab navigation
├── components/
│   ├── VocalSeparationTab.tsx  # Vocal separation (single/batch)
│   ├── BatchYoloProcessor.tsx  # Batch queue processor
│   ├── MasterTrackEditor.tsx   # Waveform editor
│   ├── Results.tsx             # Segment display
│   └── ...
├── services/
│   ├── audioProcessor.ts       # Core audio processing
│   ├── filenameUtils.ts        # Metadata-based naming
│   ├── database.ts             # IndexedDB caching
│   └── ...
└── internal/                   # Technical documentation
```

## Key Features

### Metadata-Based Filenames (v1.1.2)

All downloads use meaningful names based on source metadata:

| Type | Pattern | Example |
|------|---------|---------|
| Master | `{title}_full_processed.wav` | `Never_Gonna_Give_You_Up_full_processed.wav` |
| Segment | `{title}_segment_01.wav` | `Never_Gonna_Give_You_Up_segment_01.wav` |
| Vocals | `{title}_vocals.wav` | `Never_Gonna_Give_You_Up_vocals.wav` |
| YOLO Mix | `{title}_yolo_mix.wav` | `Never_Gonna_Give_You_Up_yolo_mix.wav` |

**See:** [Filename Refactoring Guide](internal/FILENAME_REFACTOR_SUMMARY.md)

### Job Management (v1.1.1)

Track and cancel long-running operations:

```typescript
// Frontend: Get job ID from response
const response = await fetch('/separate-vocals', { method: 'POST', body: formData });
const jobId = response.headers.get('X-Job-ID');

// Poll for progress
const job = await fetch(`/jobs/${jobId}`).then(r => r.json());
console.log(`Progress: ${job.progress}%`);

// Cancel if needed
await fetch(`/jobs/${jobId}/cancel`, { method: 'POST' });
```

**API Endpoints:**
- `GET /jobs` - List all jobs
- `GET /jobs/{id}` - Get job status
- `POST /jobs/{id}/cancel` - Cancel running job
- `DELETE /jobs/{id}` - Remove completed job

**See:** [Job Management Guide](internal/backend/JOB_MANAGEMENT.md)

### Caching System

Two-layer architecture for optimal performance:

**Layer 1: Backend Filesystem** (`backend/.cache/`)
- Permanent storage of YouTube downloads
- Shared across all users
- Speed: ~10ms (disk read)

**Layer 2: Frontend IndexedDB** (browser)
- Instant access to previously loaded audio
- Per-user, per-browser
- Speed: ~1ms (instant!)

**Cache Flow:**
```
1st Request: Download (10-30s) → Cache both layers
2nd Request: Backend cache hit (~100ms)
3rd Request: IndexedDB hit (~1ms, instant!)
```

**See:** [Caching System Guide](internal/backend/CACHING_SYSTEM.md)

### Vocal Separation

**Current Model:** Tommy's 12-Layer Mel-Band RoFormer
- Source: [Aname-Tommy/Mel_Band_Roformer_Full_Scratch](https://huggingface.co/Aname-Tommy/Mel_Band_Roformer_Full_Scratch)
- 12-layer transformer, 320 dimensions
- 2x overlap (optimized)
- 692 MB safetensors format

**Performance (i5-6500, 4 cores):**
| Backend | Time (20s audio) | Speedup |
|---------|------------------|---------|
| PyTorch CPU | ~32s | 1x baseline |
| ONNX Runtime | ~8-16s | 2-4x faster |
| ONNX + INT8 | ~6-10s | 3-5x faster |
| Remote CUDA | ~2-4s | 8-16x faster |

**Environment Variables:**
```bash
USE_ONNX=1              # Enable ONNX Runtime (default: enabled)
QUANTIZED=1             # Use INT8 quantized model
CPU_THREADS=4           # Set CPU thread count
REMOTE_CUDA_URL=http://gpu:8001  # Remote GPU server
```

**See:**
- [Model Upgrade Details](internal/vocal_model/MODEL_UPGRADE_2025-10.md)
- [Optimization Guide](internal/vocal_model/OPTIMIZATION_README.md)

### YOLO Mode

Intelligent audio optimization for animatronics:

**What it does:**
1. Separates vocals from instrumental
2. Boosts vocals to 120%
3. Reduces instrumental to 25%
4. Recombines for optimal mouth movement

**Why:**
- Ensures mouth moves primarily on vocals, not background music
- Maintains audio quality while emphasizing speech
- Prevents jaw flutter from percussion

**Modes:**
- **Single File**: Process one audio file at a time
- **Batch Queue**: Process multiple files in sequence with progress tracking

## API Reference

### Backend Endpoints

**Audio Processing:**
- `POST /get-audio-url` - Fetch YouTube audio (with caching)
- `POST /separate-vocals` - AI vocal separation (returns ZIP)

**Job Management:**
- `GET /jobs` - List all jobs
- `GET /jobs/{id}` - Job status
- `POST /jobs/{id}/cancel` - Cancel job
- `DELETE /jobs/{id}` - Delete job record

### Frontend Services

**Audio Processing:** `services/audioProcessor.ts`
- `processFullTrack()` - Apply normalization/compression to full track
- `extractSegment()` - Extract time slice from master track
- `autoSplitTrack()` - Auto-detect and split into segments
- `applyEffectsToSegment()` - Apply volume/fade effects

**Filename Generation:** `services/filenameUtils.ts`
- `sanitizeFilename()` - Remove invalid characters, limit length
- `generateFilename()` - Standard naming for all file types
- `getSourceTitle()` - Extract title from metadata

**Caching:** `services/database.ts`
- `saveAudio()` - Store audio in IndexedDB
- `getAudio()` - Retrieve cached audio by video ID
- `getAllAudioRecords()` - List all cached audio
- `deleteAudio()` - Remove from cache

## Development

### Prerequisites

- Node.js 18+
- Python 3.13
- uv (Python package manager)

### Setup

```bash
# Clone and install
git clone <repo-url>
cd skelly-audio-tools
npm install

# Setup Python environment
uv venv
source .venv/bin/activate
uv pip install -r backend/requirements.txt

# Configure
./setup.sh    # Interactive wizard

# Run
./start.sh dev  # Full stack with auto-reload
```

### Environment Variables

**Backend:**
```bash
USE_ONNX=1              # ONNX Runtime (default: enabled)
QUANTIZED=1             # INT8 quantization
CPU_THREADS=4           # CPU thread count
REMOTE_CUDA_URL=...     # Remote GPU server URL
```

**Frontend (Vite):**
```bash
VITE_BACKEND_URL=http://localhost:8000/get-audio-url
```

## Testing

### With Cached Files

```bash
# Test with cached YouTube audio
python scripts/test_with_cache.py

# Benchmark all backends
python scripts/benchmark_separator.py --all
```

### Hardware Setup Testing

For iRig 2 recording chain setup and testing:
- See [Skelly Decor SVR Setup Guide](internal/hardware/SKELLY_DECOR_SVR_SETUP.md)

## Troubleshooting

### Common Issues

**YouTube Downloads Fail:**
```bash
# Update yt-dlp
uv pip install --upgrade yt-dlp

# Clear cache
rm -rf backend/.cache/*
```

**Vocal Separation Slow:**
```bash
# Enable ONNX optimization
USE_ONNX=1 ./start.sh backend

# Or use quantized model
QUANTIZED=1 USE_ONNX=1 ./start.sh backend
```

**Job Stuck/Unresponsive:**
```bash
# List active jobs
curl http://localhost:8000/jobs

# Cancel specific job
curl -X POST http://localhost:8000/jobs/{job_id}/cancel

# Restart backend
./start.sh stop
./start.sh backend
```

## Credits

- **Vocal Model:** [Tommy's Mel-Band RoFormer](https://huggingface.co/Aname-Tommy/Mel_Band_Roformer_Full_Scratch) by Aname-Tommy
- **Model Architecture:** [BS-RoFormer](https://github.com/lucidrains/BS-RoFormer) by lucidrains
- **Model Training:** [ZFTurbo Framework](https://github.com/ZFTurbo/Music-Source-Separation-Training)
- **WaveSurfer.js:** [wavesurfer-js.org](https://wavesurfer-js.org/)
- **yt-dlp:** [github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)

## License

See LICENSE file for details.
