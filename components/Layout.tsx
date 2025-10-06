
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activePage: 'prep' | 'controller';
  setPage: (page: 'prep' | 'controller') => void;
}

const NavItem: React.FC<{
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full px-3 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
      isActive
        ? 'bg-orange-500/10 text-orange-400'
        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
    }`}
    aria-current={isActive ? 'page' : undefined}
  >
    <i className={`ph-bold ${icon} text-xl mr-3`}></i>
    <span className="flex-1 text-left">{label}</span>
  </button>
);

const Layout: React.FC<LayoutProps> = ({ children, activePage, setPage }) => {
  return (
    <div className="flex w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <aside className="w-56 flex-shrink-0 pr-8">
        <div className="sticky top-8">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-6">
            SkellyTune
          </h1>
          <nav className="space-y-2">
            <NavItem
              icon="ph-cassette-tape"
              label="Audio Prep"
              isActive={activePage === 'prep'}
              onClick={() => setPage('prep')}
            />
            <NavItem
              icon="ph-skull"
              label="Controller"
              isActive={activePage === 'controller'}
              onClick={() => setPage('controller')}
            />
          </nav>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
};

export default Layout;
