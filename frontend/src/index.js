import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { installErrorReporting } from './lib/errorReporter';

// Browser crashes are sent to the admin dashboard's error log
installErrorReporting();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
