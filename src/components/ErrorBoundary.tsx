import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface State {
  error: Error | null;
}

/** Last line of defence: a render error shows a recoverable screen, not a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center bg-bg p-10">
        <div className="max-w-md text-center">
          <p className="label">Непредвиденная ошибка</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Что-то пошло не по курсу.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Ваши рейсы и текущий отсчёт в безопасности — они хранятся отдельно от этого экрана. Перезагрузите
            интерфейс, чтобы продолжить.
          </p>
          <pre className="mt-5 max-h-32 overflow-auto rounded-lg bg-raised p-3 text-left text-xs text-faint">
            {this.state.error.message}
          </pre>
          <Button variant="primary" className="mt-6" onClick={() => window.location.reload()}>
            Перезагрузить интерфейс
          </Button>
        </div>
      </div>
    );
  }
}
