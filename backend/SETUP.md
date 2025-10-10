# Vocal Separation Backend Setup

## Install Backend Dependencies
```bash
cd backend
uv pip install -r requirements.txt
```

## Convert Model to Safetensors

Choose ONE of the following:

**Option A: Standard Model (better quality)**
```bash
cd ..
python convert_checkpoint.py
```

**Option B: Quantized Model**
```bash
cd ..
python convert_checkpoint.py --quantize
```

### 4. Start the Backend

**If you used the standard model:**
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

**If you used the quantized model:**
```bash
cd backend
QUANTIZED=1 uvicorn main:app --host 0.0.0.0 --port 8000
```

## Testing the Endpoint

```bash
curl -X POST "http://localhost:8000/separate-vocals" \
  -F "file=@test_song.mp3" \
  --output separated.zip
```

## Troubleshooting

### Model not found error
Make sure you ran `python convert_checkpoint.py` from the project root.

### Out of memory
Use the quantized model or reduce chunk_size in `vocal_model/config.yaml`.
