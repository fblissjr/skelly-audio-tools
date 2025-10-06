import React, { useRef, useState } from 'react';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  promptMessage?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, promptMessage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    onFileChange(file || null);
    
    // Reset input value to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types && event.dataTransfer.types.includes('Files')) {
        setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      onFileChange(event.dataTransfer.files[0]);
    }
  };
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const dropzoneClassName = `w-full max-w-lg px-6 py-10 border-2 border-dashed rounded-lg transition-all duration-300 flex flex-col items-center justify-center cursor-pointer text-center transform ${
    isDraggingOver
      ? 'border-orange-500 text-orange-400 scale-105 bg-slate-800/50 shadow-lg'
      : 'border-slate-600 text-slate-400 hover:border-orange-500 hover:text-orange-400'
  }`;

  return (
    <div className="flex flex-col items-center space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="audio/*"
        className="hidden"
      />
      
      <div
        onClick={handleButtonClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={dropzoneClassName}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === 'Enter' && handleButtonClick()}
      >
        <i className="ph-bold ph-music-notes-simple text-4xl mb-2"></i>
        <span>{promptMessage || 'Click or drop an audio file here'}</span>
        <span className="text-sm text-slate-500 mt-1">MP3, WAV, M4A, etc.</span>
      </div>
    </div>
  );
};

export default FileUpload;