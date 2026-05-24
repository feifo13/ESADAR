import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { installClientErrorListeners } from './lib/clientLogger.js';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { CartProvider } from './contexts/CartContext.jsx';
import { LookupsProvider } from './contexts/LookupsContext.jsx';
import { SiteSeoProvider } from './contexts/SiteSeoContext.jsx';
import { WishlistProvider } from './contexts/WishlistContext.jsx';
import {
  applyMobileDebugClasses,
  syncMobileDebugFlagsFromUrl,
} from './lib/mobileDebugFlags.js';
import './index.css';
import './styles/rails.css';
import './styles/feedback.css';

if (typeof window !== 'undefined') {
  applyMobileDebugClasses(document.documentElement, syncMobileDebugFlagsFromUrl());

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  installClientErrorListeners();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LookupsProvider>
            <SiteSeoProvider>
              <WishlistProvider>
                <CartProvider>
                  <ErrorBoundary>
                    <App />
                  </ErrorBoundary>
                </CartProvider>
              </WishlistProvider>
            </SiteSeoProvider>
          </LookupsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
