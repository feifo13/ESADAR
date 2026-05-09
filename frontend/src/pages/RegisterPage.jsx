import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useMobileMenu } from '../contexts/MobileMenuContext.jsx';
import { firstValidationMessage, getEmailValidationMessage, getFriendlyErrorMessage, getMinLengthValidationMessage, getRequiredValidationMessage, notifyFormStatus } from '../lib/validation.js';

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
  const { notifyMobileStatus } = useMobileMenu();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const validationMessage = firstValidationMessage(
        getRequiredValidationMessage(form.firstName, 'el nombre'),
        getMinLengthValidationMessage(form.firstName, 2, 'el nombre'),
        getRequiredValidationMessage(form.lastName, 'el apellido'),
        getMinLengthValidationMessage(form.lastName, 2, 'el apellido'),
        getRequiredValidationMessage(form.birthDate, 'la fecha de nacimiento'),
        getRequiredValidationMessage(form.phone, 'el teléfono'),
        getRequiredValidationMessage(form.address, 'la dirección'),
        getRequiredValidationMessage(form.email, 'el email'),
        getEmailValidationMessage(form.email),
        getRequiredValidationMessage(form.password, 'el password'),
        getMinLengthValidationMessage(form.password, 6, 'el password'),
      );
      if (validationMessage) {
        setError(validationMessage);
        notifyFormStatus(notifyMobileStatus, 'error', validationMessage, { focusInvalidRoot: event.currentTarget });
        return;
      }
      setSubmitting(true);
      setError('');
      await register({
        ...form,
        birthDate: form.birthDate,
        address: form.address,
        phone: form.phone,
        instagram: form.instagram || null,
      });
      navigate('/', { replace: true });
    } catch (err) {
      const errorMessage = getFriendlyErrorMessage(err, 'No se pudo crear el usuario.');
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, 'error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-shell">
      <form className="section-card auth-card" onSubmit={handleSubmit} noValidate>
        <p className="section-kicker">Crear usuario</p>
        <h1>Tu cuenta para comprar más rápido</h1>

        <div className="form-grid-two">
          <label className="field-group">
            <span>Nombre</span>
            <input className="input" name="firstName" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} minLength="2" required />
          </label>
          <label className="field-group">
            <span>Apellido</span>
            <input className="input" name="lastName" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} minLength="2" required />
          </label>
          <label className="field-group">
            <span>Fecha de nacimiento</span>
            <input className="input" type="date" name="birthDate" value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} required />
          </label>
          <label className="field-group">
            <span>Teléfono</span>
            <input className="input" name="phone" value={form.phone} onChange={(event) => update('phone', event.target.value)} required />
          </label>
          <label className="field-group form-grid-span-two">
            <span>Dirección</span>
            <input className="input" name="address" value={form.address} onChange={(event) => update('address', event.target.value)} required />
          </label>
          <label className="field-group">
            <span>Instagram</span>
            <input className="input" name="instagram" value={form.instagram} onChange={(event) => update('instagram', event.target.value)} />
          </label>
          <label className="field-group">
            <span>Email</span>
            <input className="input" type="email" name="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
          </label>
          <label className="field-group form-grid-span-two">
            <span>Password</span>
            <input className="input" type="password" name="password" value={form.password} onChange={(event) => update('password', event.target.value)} minLength="6" required />
          </label>
        </div>

        <button className="button button-primary auth-submit-button" type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear cuenta'}
        </button>
        <p className="muted-copy">¿Ya tienes cuenta? <Link to="/login">Ingresar</Link></p>
      </form>
    </div>
  );
}
