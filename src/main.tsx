/**
 * Entry point của ứng dụng.
 * Import global styles và render App component.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const isDisconnectedProxyPortError = (event: ErrorEvent) =>
  event.message.includes('Attempting to use a disconnected port object') &&
  (event.filename.endsWith('/proxy.js') || event.filename.endsWith('\\proxy.js') || event.filename === 'proxy.js');

window.addEventListener('error', (event) => {
  if (!isDisconnectedProxyPortError(event)) return;

  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
