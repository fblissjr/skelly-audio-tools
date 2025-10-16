#!/bin/bash

# Skelly Audio Tools - Performance Optimization Setup
# This script helps you set up the fastest inference backend for your system

set -e

echo "============================================================"
echo "  Skelly Audio Tools - Performance Optimization Setup"
echo "============================================================"
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo -e "${RED}ERROR: Must run from project root directory${NC}"
    exit 1
fi

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}Virtual environment not activated. Activating...${NC}"
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    else
        echo -e "${RED}ERROR: Virtual environment not found. Run 'uv venv' first.${NC}"
        exit 1
    fi
fi

echo "Step 1: Installing ONNX Runtime"
echo "--------------------------------"
echo "ONNX Runtime provides 2-5x speedup on CPU"
echo
uv pip install onnxruntime
echo -e "${GREEN}✓ ONNX Runtime installed${NC}"
echo

echo "Step 2: Exporting model to ONNX format"
echo "---------------------------------------"
cd vocal_model

if [ -f "model_vocals_tommy_optimized.onnx" ]; then
    echo -e "${YELLOW}ONNX model already exists. Skipping export.${NC}"
else
    echo "This may take a few minutes..."
    python export_onnx.py \
        --model_path model_vocals_tommy.safetensors \
        --config_path config_vocals_tommy.yaml \
        --output_path model_vocals_tommy.onnx
    echo -e "${GREEN}✓ Model exported to ONNX format${NC}"
fi
echo

cd ..

echo "Step 3: Optional optimizations"
echo "------------------------------"
echo
read -p "Install quantization tools for INT8 models? (2-4x additional speedup) [y/N]: " install_quant
if [[ $install_quant =~ ^[Yy]$ ]]; then
    uv pip install onnxruntime-tools
    echo -e "${GREEN}✓ Quantization tools installed${NC}"
    echo

    read -p "Create quantized model now? (takes 5-10 minutes) [y/N]: " create_quant
    if [[ $create_quant =~ ^[Yy]$ ]]; then
        cd vocal_model
        python separator_onnx.py --quantize model_vocals_tommy_optimized.onnx
        echo -e "${GREEN}✓ Quantized model created${NC}"
        cd ..
    fi
fi
echo

echo "Step 4: Remote CUDA setup (optional)"
echo "------------------------------------"
echo
read -p "Do you have a separate GPU server available? [y/N]: " has_cuda
if [[ $has_cuda =~ ^[Yy]$ ]]; then
    uv pip install httpx
    echo -e "${GREEN}✓ Remote client dependencies installed${NC}"
    echo
    echo "To set up the CUDA server:"
    echo "1. On the GPU server, run:"
    echo "   cd backend"
    echo "   python separator_remote.py --server --host 0.0.0.0 --port 8001"
    echo
    echo "2. On this machine, set the environment variable:"
    echo "   export REMOTE_CUDA_URL=http://your-gpu-server:8001"
    echo
fi

echo
echo "============================================================"
echo "  Setup Complete!"
echo "============================================================"
echo
echo "Recommended configuration:"
echo

if [[ $has_cuda =~ ^[Yy]$ ]]; then
    echo "  REMOTE_CUDA_URL=http://your-gpu-server:8001 \\"
    echo "  uvicorn main:app --host 127.0.0.1 --port 8000"
    echo
    echo "  Expected performance: 5-10x faster than baseline"
elif [[ $create_quant =~ ^[Yy]$ ]]; then
    echo "  USE_ONNX=1 QUANTIZED=1 \\"
    echo "  uvicorn main:app --host 127.0.0.1 --port 8000"
    echo
    echo "  Expected performance: 4-7x faster than baseline"
else
    echo "  USE_ONNX=1 \\"
    echo "  uvicorn main:app --host 127.0.0.1 --port 8000"
    echo
    echo "  Expected performance: 2-5x faster than baseline"
fi

echo
echo "To benchmark performance:"
echo "  python scripts/benchmark_separator.py --duration 60"
echo
echo "For more details, see:"
echo "  docs/PERFORMANCE_OPTIMIZATION.md"
echo
