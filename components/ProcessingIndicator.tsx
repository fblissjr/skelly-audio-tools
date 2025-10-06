
import React, { useState, useEffect } from 'react';

const messages = [
  "Waking the spirits...",
  "Tuning the bones...",
  "Calibrating the cacophony...",
  "Slicing and dicing the soundwaves...",
  "Summoning the audio specters...",
  "Applying spectral normalization...",
];

const ProcessingIndicator: React.FC = () => {
    const [message, setMessage] = useState(messages[0]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setMessage(prevMessage => {
                const currentIndex = messages.indexOf(prevMessage);
                const nextIndex = (currentIndex + 1) % messages.length;
                return messages[nextIndex];
            });
        }, 2500);

        return () => clearInterval(intervalId);
    }, []);

  return (
    <div className="text-center p-8 flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-orange-500 border-l-orange-500 border-b-orange-500/0 border-r-orange-500/0 rounded-full animate-spin"></div>
        </div>
        <p className="text-orange-300 transition-opacity duration-500">{message}</p>
    </div>
  );
};

export default ProcessingIndicator;
