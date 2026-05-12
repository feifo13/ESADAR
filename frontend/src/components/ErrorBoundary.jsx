import { Component } from 'react';
import { logClientError } from '../lib/clientLogger.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    void logClientError(error, {
      type: 'ReactErrorBoundary',
      source: 'react-error-boundary',
      metadata: {
        componentStack: info?.componentStack || '',
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container page-stack error-boundary-shell">
          <section className="section-card centered-card">
            <p className="section-kicker">ESADAR</p>
            <h1>Algo no cargó correctamente</h1>
            <p className="muted-copy">Registramos el error para revisarlo. Recargá la página para intentar nuevamente.</p>
            <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
              Recargar
            </button>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
