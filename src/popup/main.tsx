import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('FormPilot: #root container is missing from popup/index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
