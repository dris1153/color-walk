import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { ViewSettingsProvider } from './components/view-settings-provider';
import './styles/global.css';

const host = document.getElementById('root');
if (!host) throw new Error('missing #root');

createRoot(host).render(
  <StrictMode>
    <ViewSettingsProvider>
      <App />
    </ViewSettingsProvider>
  </StrictMode>,
);
