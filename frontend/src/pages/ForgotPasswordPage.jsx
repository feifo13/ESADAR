import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMobileMenu } from '../contexts/MobileMenuContext.jsx';
import { apiFetch } from '../lib/api.js';
import {
  firstValidationMessage,
  getEmailValidationMessage,
  getFriendlyErrorMessage,
  getRequiredValidationMessage,
  notifyFormStatus,
} from '../lib/validation.js';

export default function ForgotPasswordPage() {
  const { notifyMobileStatus } = useMobileMenu();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = firstValidationMessage(
      getRequiredValidationMessage(email, 'el email'),
      getEmailValidationMessage(email),
    );

    if (validationMessage) {
      setError(validationMessage);
      setMessage('');
      notifyFormStatus(notifyMobileStatus, 'error', validationMessage);
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setMessage('');
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
      });
      const successMessage = response.message || 'Si el email existe, te enviamos instrucciones para recuperar tu contraseña.';
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, 'success', successMessage);
    } catch (err) {
      const errorMessage = getFriendlyErrorMessage(err, 'No se pudo enviar la recuperación de contraseña.');
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, 'error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-shell">
      <form className="section-card auth-card" onSubmit={handleSubmit} noValidate>
        <p className="section-kicker">Recuperar acceso</p>
        <h1>Olvidaste tu contraseña</h1>
        <p className="muted-copy">
          Escribe tu email y te enviaremos instrucciones para crear una nueva contraseña.
        </p>

        <label className="field-group">
          <span>Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        {error ? <p className="error-copy">{error}</p> : null}
        {message ? <p className="success-copy">{message}</p> : null}

        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar instrucciones'}
        </button>

        <p className="muted-copy">
          ¿Recordaste tu contraseña? <Link to="/login">Volver a ingresar</Link>
        </p>
      </form>
    </div>
  );
}
