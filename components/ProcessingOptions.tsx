import React from 'react';

interface ProcessingOptionsProps {
  options: {
    normalizationDb: number;
    compressionPreset: string;
    noiseGateThreshold: number;
    jawSensitivity: number;
  };
  setOptions: (options: any) => void;
}

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({ options, setOptions }) => {
  const handleOptionChange = (key: string, value: any) => {
    setOptions((prev: any) => ({ ...prev, [key]: value }));
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1 */}
        <div className="space-y-6">
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
              onChange={(e) => handleOptionChange('normalizationDb', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>

          {/* Silence Cleanup Slider */}
          <div className="space-y-2">
            <label htmlFor="noiseGate" className="block font-semibold text-slate-300">
              Silence Cleanup (Noise Gate): <span className="font-mono text-orange-400">{options.noiseGateThreshold === -100 ? 'Off' : `${options.noiseGateThreshold} dB`}</span>
            </label>
            <input
              id="noiseGate"
              type="range"
              min="-100"
              max="0"
              step="1"
              value={options.noiseGateThreshold}
              onChange={(e) => handleOptionChange('noiseGateThreshold', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>

           {/* Jaw Sensitivity Slider */}
           <div className="space-y-2">
            <label htmlFor="jawSensitivity" className="block font-semibold text-slate-300">
              Jaw Sensitivity Threshold: <span className="font-mono text-orange-400">{options.jawSensitivity.toFixed(2)}</span>
            </label>
            <input
              id="jawSensitivity"
              type="range"
              min="0.05"
              max="1.0"
              step="0.01"
              value={options.jawSensitivity}
              onChange={(e) => handleOptionChange('jawSensitivity', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>
        </div>

        {/* Column 2 */}
        <div className="space-y-2">
          <label className="block font-semibold text-slate-300">Dynamic Compression</label>
          <div className="grid grid-cols-2 gap-2">
              {compressionOptions.map(opt => (
                <div key={opt.id}>
                  <input 
                      type="radio" 
                      id={`comp-${opt.id}`}
                      name="compression"
                      value={opt.id}
                      checked={options.compressionPreset === opt.id}
                      onChange={(e) => handleOptionChange('compressionPreset', e.target.value)}
                      className="sr-only peer"
                  />
                  <label 
                      htmlFor={`comp-${opt.id}`}
                      title={opt.description}
                      className="block w-full h-full p-3 text-center text-slate-300 bg-slate-700 rounded-lg border border-slate-600 cursor-pointer peer-checked:ring-2 peer-checked:ring-orange-500 peer-checked:border-transparent peer-checked:bg-slate-600 peer-checked:text-white transition-all"
                  >
                      {opt.label}
                  </label>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingOptions;