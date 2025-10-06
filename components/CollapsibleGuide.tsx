import React, { useState } from 'react';

interface CollapsibleGuideProps {
  title: string;
  children: React.ReactNode;
}

const CollapsibleGuide: React.FC<CollapsibleGuideProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 text-left font-semibold text-slate-300 hover:bg-slate-800/50 transition-colors"
      >
        <span>{title}</span>
        <i className={`ph-bold ph-caret-down transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      {isOpen && (
        <div className="p-4 border-t border-slate-700 text-slate-400 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleGuide;
