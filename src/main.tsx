import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { InGameOverlay } from './components/overlay/InGameOverlay';
import './index.css';

const isOverlay =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('overlay') === 'true';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isOverlay ? <InGameOverlay /> : <App />}
  </React.StrictMode>,
);
