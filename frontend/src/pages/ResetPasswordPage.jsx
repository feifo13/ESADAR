import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMobileMenu } from '../contexts/MobileMenuContext.jsx';
import { apiFetch } from '../lib/api.js';
import {
  firstValidationMessage,
  getFriendlyErrorMessage,
  getMinLengthValidationMessage,
  getRequiredValidationMessage,
  notifyFormStatus,
} from '../lib/validation.js';

export default function ResetPasswordPage() {
  const { notifyMobileStatus } = useMobileMenu();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(token ? '' : 'El link de recuperación no tiene token.');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = firstValidationMessage(
      token ? '' : 'El link de recuperación no tiene token.',
      getRequiredValidationMessage(password, 'la nueva contraseña'),
      getMinLengthValidationMessage(password, 6, 'la nueva contraseña'),
      getRequiredValidationMessage(confirmPassword, 'la confirmación de contraseña'),
      password === confirmPassword ? '' : 'Las contraseñas no coinciden.',
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
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      });
      const successMessage = response.message || 'Tu contraseña fue actualizada.';
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, 'success', successMessage);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      const errorMessage = getFriendlyErrorMessage(err, 'No se pudo actualizar la contraseña.');
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, 'error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-shell">
      <form className="section-card auth-card" onSubmit={handleSubmit} noValidate>
        <p className="section-kicker">Nueva contraseña</p>
        <h1>Crear nueva contraseña</h1>
        <p className="muted-copy">
          Elige una contraseña nueva para volver a entrar a tu cuenta.
        </p>

        <label className="field-group">
          <span>Nueva contraseña</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        <label className="field-group">
          <span>Confirmar contraseña</span>
          <input
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error ? <p className="error-copy">{error}</p> : null}
        {message ? <p className="success-copy">{message}</p> : null}

        <button className="button button-primary" type="submit" disabled={submitting || !token}>
          {submitting ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>

        {message ? (
          <p className="muted-copy">
            Ya puedes <Link to="/login">ingresar con tu nueva contraseña</Link>.
          </p>
        ) : (
          <p className="muted-copy">
            ¿Necesitas otro link? <Link to="/forgot-password">Pedir instrucciones nuevamente</Link>
          </p>
        )}
      </form>
    </div>
  );
}
