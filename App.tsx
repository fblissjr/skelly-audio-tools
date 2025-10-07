
import React, { useState } from 'react';
import Layout from './components/Layout';
import PrepPage from './pages/PrepPage';
import ControllerPage from './pages/ControllerPage';
import Footer from './components/Footer';

import SequencerPage from './pages/SequencerPage';

type Page = 'prep' | 'controller' | 'sequencer';

const App: React.FC = () => {
  const [page, setPage] = useState<'prep' | 'controller'>('prep');

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-200 flex flex-col">
      <div className="flex-grow flex">
        <Layout activePage={page} setPage={setPage}>
          {page === 'prep' && <PrepPage />}
          {page === 'controller' && <ControllerPage />}
          {page === 'sequencer' && <SequencerPage />}
        </Layout>
      </div>
      <Footer />
    </div>
  );
};

export default App;
