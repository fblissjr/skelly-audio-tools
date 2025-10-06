import React, { useState, useMemo } from 'react';
import FileUpload from './FileUpload';

interface YouTubeGuideProps {
  onFileChange: (file: File | null) => void;
}

const YouTubeGuide: React.FC<YouTubeGuideProps> = ({ onFileChange }) => {
    const [youtubeUrl, setYoutubeUrl] = useState('');

    const videoId = useMemo(() => {
        if (!youtubeUrl) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = youtubeUrl.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }, [youtubeUrl]);
    
    const encodedUrl = encodeURIComponent(youtubeUrl);
    
    const services = [
        {
            name: 'YT5s',
            url: `https://yt5s.io/en/youtube-to-mp3?q=${encodedUrl}`,
            color: 'bg-sky-600 hover:bg-sky-700',
            note: "BROKEN",
        },
        {
            name: 'Cobalt',
            url: `https://cobalt.tools/?url=${encodedUrl}`,
            color: 'bg-red-600 hover:bg-red-700',
            note: 'Note: BOTH SERVICES, Cobalt and YT5S, do not work!!',
        },
    ];

    return (
        <div className="text-slate-300 space-y-6">
            <div className="space-y-2 text-center">
                <h3 className="text-xl font-bold text-slate-100">1. Enter YouTube URL</h3>
                <p className="text-slate-400 max-w-2xl mx-auto">
                    Paste the URL of the YouTube video you want to get audio from.
                </p>
            </div>

            <div className="flex justify-center">
                <div className="relative w-full max-w-lg">
                    <i className="ph-bold ph-link absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                        className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                        aria-label="YouTube URL"
                    />
                </div>
            </div>

            {videoId && (
                <div className="space-y-6 animate-fade-in">
                    <div className="space-y-2 text-center">
                        <h3 className="text-xl font-bold text-slate-100 mt-8">2. Get The Audio File</h3>
                        <p className="text-slate-400 max-w-2xl mx-auto">
                           Click a button below to use a third-party service to download the audio. If one service doesn't work, please try another. After downloading, return to this tab.
                        </p>
                    </div>

                    <div className="flex flex-col items-center space-y-4">
                       <img 
                           src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} 
                           alt="YouTube video thumbnail" 
                           className="rounded-lg shadow-lg border-2 border-slate-700"
                        />
                        <div className="w-full max-w-sm p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-3">
                          {services.map(service => (
                            <div key={service.name}>
                               <a
                                   href={service.url}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className={`inline-flex w-full items-center justify-center space-x-2 px-6 py-3 font-bold text-white ${service.color} rounded-lg transition-colors shadow-md transform hover:scale-105`}
                               >
                                   <i className="ph-bold ph-arrow-square-out"></i>
                                   <span>Get Audio from {service.name}</span>
                               </a>
                               {service.note && <p className="text-xs text-yellow-400 mt-1 text-center">{service.note}</p>}
                            </div>
                           ))}
                        </div>
                       <p className="text-xs text-slate-500">You will be taken to third-party websites which may contain ads.</p>
                    </div>
                     <div className="space-y-2 text-center">
                        <h3 className="text-xl font-bold text-slate-100 mt-8">3. Upload the Audio File</h3>
                        <p className="text-slate-400 max-w-2xl mx-auto">
                           Once you have the audio file, drop it below to see the processing options.
                        </p>
                    </div>

                    <div className="mt-4 border-t border-slate-700/50 pt-6">
                        <FileUpload onFileChange={onFileChange} promptMessage="Drop your downloaded audio file here" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default YouTubeGuide;