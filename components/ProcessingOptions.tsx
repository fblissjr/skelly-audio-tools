import React from 'react';

interface ProcessingOptionsProps {
  options: {
    normalizationDb: number;
    compressionPreset: string;
  };
  setOptions: React.Dispatch<React.SetStateAction<{
    normalizationDb: number;
    compressionPreset: string;
  }>>;
}

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({ options, setOptions }) => {
  const handleNormalizationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOptions(prev => ({ ...prev, normalizationDb: parseFloat(e.target.value) }));
  };

  const handleCompressionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOptions(prev => ({ ...prev, compressionPreset: e.target.value }));
  };

  const compressionOptions = [
    { id: 'none', label: 'None', description: 'No compression. Preserves original dynamics.' },
    { id: 'light', label: 'Light', description: 'Gentle evening of volume levels.' },
    { id: 'medium', label: 'Medium', description: 'Good for most music to ensure consistent mouth movement.' },
    { id: 'heavy', label: 'Heavy', description: 'Maximizes volume for tracks with very quiet and loud parts.' },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-slate-100 text-center">Processing Options</h3>
      
      {/* Normalization Slider */}
      <div className="space-y-2">
        <label htmlFor="normalization" className="block font-semibold text-slate-300">
          Volume Boost (Normalization): <span className="font-mono text-orange-400">{options.normalizationDb.toFixed(1)} dB</span>
        </label>
        <input
          id="normalization"
          type="range"
          min="-6"
          max="0"
          step="0.5"
          value={options.normalizationDb}
          onChange={handleNormalizationChange}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <p className="text-sm text-slate-500">Controls the maximum volume of the final audio. 0 dB is loudest.</p>
      </div>

      {/* Compression Radio Buttons */}
      <div className="space-y-2">
         <label className="block font-semibold text-slate-300">Dynamic Compression</label>
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {compressionOptions.map(opt => (
              <div key={opt.id}>
                <input 
                    type="radio" 
                    id={`comp-${opt.id}`}
                    name="compression"
                    value={opt.id}
                    checked={options.compressionPreset === opt.id}
                    onChange={handleCompressionChange}
                    className="sr-only peer"
                />
                <label 
                    htmlFor={`comp-${opt.id}`}
                    title={opt.description}
                    className="block w-full p-3 text-center text-slate-300 bg-slate-700 rounded-lg border border-slate-600 cursor-pointer peer-checked:ring-2 peer-checked:ring-orange-500 peer-checked:border-transparent peer-checked:bg-slate-600 peer-checked:text-white transition-all"
                >
                    {opt.label}
                </label>
              </div>
            ))}
         </div>
         <p className="text-sm text-slate-500">Makes quiet parts louder to ensure consistent mouth movement.</p>
      </div>
    </div>
  );
};

export default ProcessingOptions;
