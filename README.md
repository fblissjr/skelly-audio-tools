# BOB the Skelly

This project provides a web-based interface for preparing audio files and controlling a "Skelly" Bluetooth device.

The primary purpose of this tool is to process audio files for use with the Skelly device. This involves normalizing volume, applying compression, and splitting the audio into segments. It also provides a direct interface for controlling the device via Bluetooth.

## Installation and Usage

**1. Frontend:**

```sh
npm install
npm run dev
```

**2. Python Backend:**

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
