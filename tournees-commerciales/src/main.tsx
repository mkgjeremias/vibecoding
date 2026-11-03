import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import { DataProvider } from './state/DataContext';
import { ProfilProvider } from './state/ProfilContext';

// Version publiée en page autonome : routage en mémoire (pas d'URL à réécrire côté serveur).
const Router = import.meta.env.VITE_ARTIFACT === '1' ? MemoryRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <DataProvider>
        <ProfilProvider>
          <App />
        </ProfilProvider>
      </DataProvider>
    </Router>
  </React.StrictMode>,
);
