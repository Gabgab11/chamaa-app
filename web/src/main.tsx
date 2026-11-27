import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProvider } from './app/app-state';
import { NavProvider, type Route } from './app/nav';
import { createLocalBackend } from './data/localBackend';
import './styles/tokens.css';
import './styles/app.css';

async function start() {
  // Resolve the session before first paint so signed-in people land straight on Home.
  const user = await createLocalBackend(() => '').currentUser();
  const hash = location.hash.slice(1);
  const initial: Route = user ? 'home' : hash === 'signup' || hash === 'login' ? hash : 'welcome';
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProvider initialUser={user}>
        <NavProvider initial={initial}>
          <App />
        </NavProvider>
      </AppProvider>
    </StrictMode>,
  );
}

void start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
}
