import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './authConfig';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// MSAL Browser 5.x requires async initialization before rendering.
msalInstance.initialize().then(() => {
  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
});

reportWebVitals();
