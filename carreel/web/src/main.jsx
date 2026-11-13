import { StrictMode, useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/api.js';
import { SignInSheet } from './components/Sheets.jsx';
import Feed from './pages/Feed.jsx';
import Explore from './pages/Explore.jsx';
import Listing from './pages/Listing.jsx';
import Create from './pages/Create.jsx';
import { Lots, Lot } from './pages/Lots.jsx';
import { Profile, Me } from './pages/Profile.jsx';
import './styles.css';

function useToast() {
  const [msg, setMsg] = useState('');
  const t = useRef(null);
  const toast = useCallback((m) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(''), 2800);
  }, []);
  return [msg, toast];
}

function App() {
  const [msg, toast] = useToast();
  const { prompt } = useAuth();
  const loc = useLocation();
  const onFeed = loc.pathname === '/';
  return (
    <div className={`shell ${onFeed ? 'shell-feed' : ''}`}>
      <main>
        <Routes>
          <Route path="/" element={<Feed toast={toast} />} />
          <Route path="/explore" element={<Explore toast={toast} />} />
          <Route path="/listing/:id" element={<Listing toast={toast} />} />
          <Route path="/lots" element={<Lots toast={toast} />} />
          <Route path="/lots/:id" element={<Lot toast={toast} />} />
          <Route path="/u/:handle" element={<Profile toast={toast} />} />
          <Route path="/me" element={<Me toast={toast} />} />
          <Route path="/create" element={<Create toast={toast} />} />
          <Route path="*" element={<div className="page center pad"><p className="muted">Page not found.</p></div>} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end><span>🏠</span>Home</NavLink>
        <NavLink to="/explore"><span>🔍</span>Explore</NavLink>
        <NavLink to="/create" className="tab-create" aria-label="Post a listing"><span>＋</span></NavLink>
        <NavLink to="/lots"><span>🔨</span>Auctions</NavLink>
        <NavLink to="/me"><span>👤</span>Me</NavLink>
      </nav>
      {msg && <div className="toast" role="status">{msg}</div>}
      {prompt && <SignInSheet />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
