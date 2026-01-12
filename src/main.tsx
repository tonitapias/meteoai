// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { PreferencesProvider } from './context/PreferencesContext';

// Assegurem a TypeScript que l'element 'root' existeix
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("No s'ha trobat l'element 'root' al HTML.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);