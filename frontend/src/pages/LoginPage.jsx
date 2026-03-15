import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@miamicloset.test');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      await login(email, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-shell">
      <form className="section-card auth-card" onSubmit={handleSubmit}>
        <p className="section-kicker">Ingresar</p>
        <h1>Entrar a tu cuenta</h1>
        <p className="muted-copy">Si completas login o registro, vuelves directo a la landing.</p>

        <label className="field-group">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label className="field-group">
          <span>Password</span>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>

        {error ? <p className="error-copy">{error}</p> : null}

        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>

        <p className="muted-copy">¿No tienes cuenta? <Link to="/register">Crear usuario</Link></p>
      </form>
    </div>
  );
}
