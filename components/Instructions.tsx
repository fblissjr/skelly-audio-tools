
import React from 'react';

const InstructionStep: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-start space-x-4">
    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
      <i className={`ph-bold ph-${icon} text-orange-400 text-2xl`}></i>
    </div>
    <div>
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="text-slate-400">{children}</p>
    </div>
  </div>
);

const Instructions: React.FC = () => {
  return (
    <section>
      <h2 className="text-2xl font-bold text-center mb-6 text-slate-200">How It Works</h2>
      <div className="grid md:grid-cols-3 gap-8">
        <InstructionStep icon="cassette-tape" title="1. Get Your Audio">
          Choose your source below. You can upload an audio file directly, or follow our guide to get audio from a YouTube video.
        </InstructionStep>
        <InstructionStep icon="sparkle" title="2. Process Your File">
          Once uploaded, the app will automatically normalize the volume to be loud and clear, then slice it into perfect 30-second segments.
        </InstructionStep>
        <InstructionStep icon="download-simple" title="3. Download & Record">
          Download the generated clips. Then, following your device's instructions, play each clip while recording it into the Decor Pro SVI app.
        </InstructionStep>
      </div>
    </section>
  );
};

export default Instructions;
