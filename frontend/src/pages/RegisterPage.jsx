import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const initialState = {
  firstName: '',
  lastName: '',
  birthDate: '',
  email: '',
  password: '',
  address: '',
  phone: '',
  instagram: '',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      await register({
        ...form,
        birthDate: form.birthDate || null,
        address: form.address || null,
        phone: form.phone || null,
        instagram: form.instagram || null,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo crear el usuario');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-shell">
      <form className="section-card auth-card" onSubmit={handleSubmit}>
        <p className="section-kicker">Crear usuario</p>
        <h1>Tu cuenta para comprar más rápido</h1>

        <div className="form-grid-two">
          <label className="field-group">
            <span>Nombre</span>
            <input className="input" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} required />
          </label>
          <label className="field-group">
            <span>Apellido</span>
            <input className="input" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} required />
          </label>
          <label className="field-group">
            <span>Fecha de nacimiento</span>
            <input className="input" type="date" value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} />
          </label>
          <label className="field-group">
            <span>Teléfono</span>
            <input className="input" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
          </label>
          <label className="field-group form-grid-span-two">
            <span>Dirección</span>
            <input className="input" value={form.address} onChange={(event) => update('address', event.target.value)} />
          </label>
          <label className="field-group">
            <span>Instagram</span>
            <input className="input" value={form.instagram} onChange={(event) => update('instagram', event.target.value)} />
          </label>
          <label className="field-group">
            <span>Email</span>
            <input className="input" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
          </label>
          <label className="field-group form-grid-span-two">
            <span>Password</span>
            <input className="input" type="password" value={form.password} onChange={(event) => update('password', event.target.value)} required />
          </label>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear cuenta'}
        </button>
        <p className="muted-copy">¿Ya tienes cuenta? <Link to="/login">Ingresar</Link></p>
      </form>
    </div>
  );
}
