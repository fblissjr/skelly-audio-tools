import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null;

async function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpeg) {
        return ffmpeg;
    }

    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

    ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg log]', message);
    });

    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
    });

    return ffmpeg;
}

export async function extractAudio(videoFile: File, progressCallback: (progress: number) => void): Promise<File> {
    const ffmpeg = await getFFmpeg();

    ffmpeg.on('progress', ({ progress }) => {
        progressCallback(Math.round(progress * 100));
    });

    // Use a sanitized filename to avoid issues with special characters
    const inputFileName = 'input' + videoFile.name.substring(videoFile.name.lastIndexOf('.'));
    await ffmpeg.writeFile(inputFileName, new Uint8Array(await videoFile.arrayBuffer()));

    // Run FFmpeg command to extract audio as MP3
    // -i: input file
    // -vn: no video output
    // -b:a 192k: audio bitrate 192kbps (good quality, smaller file)
    // -ar 44100: sample rate 44.1kHz
    await ffmpeg.exec([
        '-i', inputFileName,
        '-vn',
        '-b:a', '192k',
        '-ar', '44100',
        'output.mp3'
    ]);

    const data = await ffmpeg.readFile('output.mp3');
    const audioFileBlob = new Blob([data.buffer], { type: 'audio/mpeg' });

    // Clean up
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile('output.mp3');

    return new File([audioFileBlob], 'extracted_audio.mp3', { type: 'audio/mpeg' });
}
