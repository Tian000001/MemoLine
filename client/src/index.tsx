import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import RoutesComponent from './app.tsx';
import './index.css';
import { createPortal } from 'react-dom';
import { Toaster } from '@client/src/components/ui/sonner';

const Fallback = ({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
    <h1 className="text-xl font-semibold text-slate-100">页面出错了</h1>
    <pre className="max-w-lg overflow-auto rounded-lg bg-slate-900/60 p-4 text-left text-sm text-red-400">
      {error.message}
    </pre>
    <button
      onClick={resetErrorBoundary}
      className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-900"
    >
      重试
    </button>
  </div>
);

const MainApp = () => (
  <BrowserRouter>
    <ErrorBoundary FallbackComponent={Fallback}>
      <RoutesComponent />
      {createPortal(<Toaster />, document.body)}
    </ErrorBoundary>
  </BrowserRouter>
);

createRoot(document.getElementById('root')!).render(<MainApp />);
