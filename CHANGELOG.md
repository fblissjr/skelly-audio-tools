# Changelog

All notable changes to Skelly Audio Tools will be documented in this file.

## 1.1.1

### Added
- **Job Management System**: Track and cancel long-running backend operations
  - New endpoints: GET /jobs, GET /jobs/{id}, POST /jobs/{id}/cancel, DELETE /jobs/{id}
  - Job tracking for YouTube downloads and vocal separation
  - Progress monitoring (0-100%)
  - Cancellation support with cleanup of partial files
  - Job registry with status tracking (running/completed/failed/cancelled)
  - X-Job-ID header returned by /separate-vocals and /get-audio-url

- **Documentation**:
  - Created internal/backend/JOB_MANAGEMENT.md with full API reference
  - Frontend integration examples for polling and cancellation
  - Testing guide with manual and automated test examples

### Improved
- **Backend Architecture**: Better error handling with job state management
- **Resource Cleanup**: Automatic cleanup of temporary files on job cancellation
- **Logging**: Added job lifecycle logging (creation, progress, cancellation)

### Known Limitations
- Cancellation can only occur before/after vocal separation processing, not during
- Jobs are not persisted across server restarts
- No automatic cleanup of completed jobs (manual deletion required)
- Single-threaded processing (one vocal separation at a time)

## 1.1.0

### Added
- **Multiple Inference Backends**: Flexible vocal separation with automatic backend selection
  - **ONNX Runtime**: 2-5x faster CPU inference (enabled by default)
  - **INT8 Quantization**: Optional quantized models for 2-4x additional speedup
  - **Remote CUDA Support**: Offload processing to remote GPU server for 5-10x speedup
  - Automatic fallback chain: Remote CUDA → ONNX → PyTorch CPU

- **CPU Optimization**: Better multi-threading support
  - Automatic detection of CPU core count
  - Configurable thread count via `CPU_THREADS` environment variable
  - Optimized PyTorch and ONNX Runtime thread usage

- **New Scripts**:
  - `vocal_model/export_onnx.py`: Export PyTorch models to ONNX format
  - `vocal_model/separator_onnx.py`: Standalone ONNX-optimized separator
  - `backend/separator_remote.py`: Remote CUDA server and client
  - `scripts/benchmark_separator.py`: Performance benchmarking tool

### Improved
- **Performance**: Significant speedup on CPU-only systems
  - Baseline (PyTorch CPU): ~32s for 20s audio (~1.6x real-time)
  - ONNX Runtime: ~8-16s for 20s audio (~3-5x real-time) - estimated
  - ONNX + INT8: ~6-10s for 20s audio (~4-7x real-time) - estimated
  - Remote CUDA: ~2-4s for 20s audio (~10-15x real-time) - estimated

- **Configuration**: New environment variables for easy optimization
  - `USE_ONNX=1`: Enable ONNX Runtime (default: enabled)
  - `QUANTIZED=1`: Use INT8 quantized models (default: disabled)
  - `CPU_THREADS=N`: Set CPU thread count (default: auto-detect)
  - `REMOTE_CUDA_URL`: Remote CUDA server URL (e.g., http://gpu-server:8001)

- **Backend Architecture**: Unified separator interface with multiple backends
  - Transparent backend switching based on availability
  - Consistent API across all backends
  - Detailed logging of backend selection and performance

### Technical Details
- ONNX models support dynamic batch sizes and variable-length audio
- INT8 quantization uses dynamic quantization for model weights
- Remote CUDA server uses FastAPI with async file handling
- Benchmark script supports side-by-side performance comparison
- All backends return identical output format for compatibility

## 1.0.2

### Added
- **Setup Wizard (`setup.sh`)**: Interactive configuration tool
  - Detects your environment automatically
  - Guides through deployment scenarios (localhost, LAN, split servers, production)
  - Generates `.env` file with correct settings
  - Installs dependencies automatically
  - Validates required tools (Node.js, Python, uv)

- **Unified Start Script (`start.sh`)**: Single command for all modes
  - `./start.sh dev` - Full stack development mode
  - `./start.sh frontend` - Frontend only
  - `./start.sh backend` - Backend only
  - `./start.sh prod` - Production mode with PM2
  - Automatic dependency checking and venv setup

- **Interactive Tooltips**: Comprehensive explanations for all settings
  - Hover over info icons to see detailed explanations
  - Normalization: Peak level amplification explained
  - Compression: Dynamic range reduction with preset descriptions
  - Noise Gate: Silence removal for noisy recordings
  - Activation Overlay: Visual analysis tool clarification

### Changed
- **Jaw Sensitivity → Activation Visualization**: **BREAKING CHANGE**
  - Renamed and clarified purpose: This is ONLY for visual preview
  - Now an optional checkbox "Show Activation Overlay"
  - Displays orange overlay on waveform showing where audio exceeds threshold
  - **Warning**: Does NOT affect exported audio files
  - Hidden by default to avoid confusion
  - When enabled, threshold slider appears for adjusting visualization
  - Tooltip clearly explains this is preview-only

### Fixed
- **Region Selection UX**: Fixed buggy waveform region selection
  - Added "Clear Selection" button for easy region reset
  - Automatic cleanup of previous regions when creating new ones
  - Better visual feedback with region event logging

- **Audio Processing Feedback**: Added comprehensive visual progress indicators
  - Real-time status messages during audio processing
  - Display of current processing settings
  - Clear indication of what's happening at each stage

### Improved
- **Waveform UI Reorganization**: Complete redesign of segmentation workflow
  - Audio player controls integrated directly into waveform component
  - Region selection info moved next to waveform
  - Cleaner layout with better visual hierarchy

- **Logging System**: Comprehensive logging throughout application
  - **Frontend**: Console logging with tagged prefixes
  - **Backend**: Structured logging with timestamps to both console and daily log files
  - Log files: `backend/logs/backend_YYYYMMDD.log`

### Documentation
- Created `setup.sh` and `start.sh` with ASCII art banners
- Added inline comments explaining all configuration options
- See `/docs/UX_IMPROVEMENTS_1.0.2.md` for detailed rationale

## 1.0.0

### Added
- Initial release with full audio processing pipeline
- AI-powered vocal separation using Mel-Band RoFormer
- YOLO Mode for Skelly-optimized audio mixes
- Batch processing with queue management
- YouTube audio fetching and caching
- Audio segmentation (manual and automatic)
- Tab-based navigation (Audio Prep & Segmentation, Vocal Separation Studio)
