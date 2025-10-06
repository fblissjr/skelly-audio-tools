import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="text-center">
      <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
        Bob the Skelly Audio Prep
      </h1>
      <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
        Normalize & split any audio file into 30-second clips, perfectly optimized for your audio-reactive Halloween decorations.
      </p>
    </header>
  );
};

export default Header;