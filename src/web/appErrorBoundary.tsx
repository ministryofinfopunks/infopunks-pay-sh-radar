import React from 'react';
import { BOOT_INITIALIZATION_DELAYED_LABEL } from './bootContext';
import './appErrorBoundary.css';

type ErrorBoundaryState = { hasError: boolean };

/** Keeps a failed route chunk or render from replacing Radar with a blank document. */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode; onReload?: () => void }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[radar-ui-error-boundary]', error);
  }

  retry = () => this.setState({ hasError: false });

  reload = () => {
    if (this.props.onReload) return this.props.onReload();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <main className="boot radar-error-boundary" role="alert" aria-live="assertive" aria-label="Infopunks Radar initialization delayed">
        <section className="panel">
          <h1>{BOOT_INITIALIZATION_DELAYED_LABEL}</h1>
          <button className="execute compact secondary" type="button" onClick={this.retry}>Retry</button>
          <button className="execute compact secondary" type="button" onClick={this.reload}>Reload</button>
        </section>
      </main>;
    }
    return this.props.children;
  }
}
