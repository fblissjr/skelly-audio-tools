import React, { useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import ProcessingIndicator from './ProcessingIndicator';

const VocalSeparation: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (file: File | null) => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/separate-vocals", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Separation failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "separated_audio.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return (
    <div className="space-y-6">
        <div className="text-center">
            <h2 className="text-xl font-bold text-slate-200">AI Vocal Separator</h2>
            <p className="text-slate-400">Upload an audio file to separate the vocals from the instrumental track.</p>
        </div>
        {isProcessing ? (
            <ProcessingIndicator text="Separating vocals... This may take a moment." />
        ) : (
            <FileUpload onFileChange={handleFileChange} />
        )}
        {error && <p className="text-red-400 mt-4 text-center" role="alert">{error}</p>}
    </div>
  );
};

export default VocalSeparation;
