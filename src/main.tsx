import '@fontsource-variable/inter';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// rAF does not run while the window is hidden, so this flips only after a real paint.
requestAnimationFrame(() =>
  requestAnimationFrame(() => setTimeout(() => document.documentElement.classList.add('motion-ready'), 400))
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
