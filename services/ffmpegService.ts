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

    await ffmpeg.writeFile(videoFile.name, videoFile);

    // Run FFmpeg command to extract audio as MP3
    // -i: input file
    // -vn: no video output
    // -acodec libmp3lame: use MP3 codec
    // -q:a 2: audio quality (0-9, lower is better)
    await ffmpeg.exec(['-i', videoFile.name, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', 'output.mp3']);

    const data = await ffmpeg.readFile('output.mp3');
    const audioFileBlob = new Blob([data], { type: 'audio/mpeg' });
    
    return new File([audioFileBlob], 'extracted_audio.mp3', { type: 'audio/mpeg' });
}
