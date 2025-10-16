import React from 'react';
import { InfoTooltip } from './Tooltip';

interface ProcessingOptionsProps {
  options: {
    normalizationDb: number;
    compressionPreset: string;
    noiseGateThreshold: number;
    jawSensitivity: number;
    showActivationOverlay: boolean;
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
            <label htmlFor="normalization" className="flex items-center font-semibold text-slate-300">
              Volume Boost (Normalization): <span className="font-mono text-orange-400 ml-2">{options.normalizationDb.toFixed(1)} dB</span>
              <InfoTooltip
                content={
                  <div className="space-y-1">
                    <p className="font-semibold">Normalization</p>
                    <p>Amplifies the entire audio to a target peak level. Higher values = louder output.</p>
                    <p className="text-xs text-slate-400 mt-2">Recommended: -1.0 dB (near maximum without distortion)</p>
                  </div>
                }
              />
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
            <label htmlFor="noiseGate" className="flex items-center font-semibold text-slate-300">
              Silence Cleanup (Noise Gate): <span className="font-mono text-orange-400 ml-2">{options.noiseGateThreshold === -100 ? 'Off' : `${options.noiseGateThreshold} dB`}</span>
              <InfoTooltip
                content={
                  <div className="space-y-1">
                    <p className="font-semibold">Noise Gate</p>
                    <p>Silences audio below a specific volume threshold. Useful for removing background noise.</p>
                    <p className="text-xs text-slate-400 mt-2">Recommended: -100 (off) unless you have noisy recordings</p>
                  </div>
                }
              />
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

           {/* Activation Visualization Overlay */}
           <div className="space-y-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600">
            <div className="flex items-center justify-between">
              <label htmlFor="showActivationOverlay" className="flex items-center font-semibold text-slate-300 cursor-pointer">
                <input
                  id="showActivationOverlay"
                  type="checkbox"
                  checked={options.showActivationOverlay}
                  onChange={(e) => handleOptionChange('showActivationOverlay', e.target.checked)}
                  className="w-4 h-4 text-orange-500 bg-slate-700 border-slate-600 rounded focus:ring-orange-500 focus:ring-2 mr-3"
                />
                Show Activation Overlay
                <InfoTooltip
                  content={
                    <div className="space-y-1">
                      <p className="font-semibold">Activation Visualization (Preview Only)</p>
                      <p>Displays an orange overlay on the waveform showing where audio exceeds the threshold.</p>
                      <p className="text-xs text-yellow-400 mt-2">⚠️ This is ONLY for visual reference. It does NOT affect the exported audio files.</p>
                      <p className="text-xs text-slate-400 mt-2">Actual mouth movement sensitivity must be configured in Skelly's hardware.</p>
                    </div>
                  }
                />
              </label>
            </div>

            {options.showActivationOverlay && (
              <div className="space-y-2 animate-fade-in">
                <label htmlFor="jawSensitivity" className="flex items-center text-sm text-slate-400">
                  Threshold: <span className="font-mono text-orange-400 ml-2">{options.jawSensitivity.toFixed(2)}</span>
                </label>
                <input
                  id="jawSensitivity"
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.01"
                  value={options.jawSensitivity}
                  onChange={(e) => handleOptionChange('jawSensitivity', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <p className="text-xs text-slate-500">
                  Lower = more sensitive (overlay shows more), Higher = less sensitive
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2 */}
        <div className="space-y-2">
          <label className="flex items-center font-semibold text-slate-300">
            Dynamic Compression
            <InfoTooltip
              content={
                <div className="space-y-1">
                  <p className="font-semibold">Dynamic Range Compression</p>
                  <p>Reduces the difference between loud and quiet parts, making overall volume more consistent.</p>
                  <p className="text-xs text-slate-400 mt-2"><strong>None:</strong> Preserves original dynamics</p>
                  <p className="text-xs text-slate-400"><strong>Light:</strong> Gentle evening out</p>
                  <p className="text-xs text-slate-400"><strong>Medium:</strong> Good for music (recommended)</p>
                  <p className="text-xs text-slate-400"><strong>Heavy:</strong> Maximum consistency for widely-varying volumes</p>
                </div>
              }
            />
          </label>
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