import { useState } from 'react';
import { apiFetch } from '../lib/api.js';

const initialState = {
  firstName: '',
  lastName: '',
  birthDate: '',
  phone: '',
  instagram: '',
  email: '',
  message: '',
};

export default function ContactPage() {
  const [form, setForm] = useState(initialState);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError('');

      await apiFetch('/api/public/contact-messages', {
        method: 'POST',
        body: {
          firstName: form.firstName,
          lastName: form.lastName,
          birthDate: form.birthDate || null,
          phone: form.phone || null,
          instagram: form.instagram || null,
          email: form.email || null,
          message: form.message,
        },
      });

      setSent(true);
      setForm(initialState);
    } catch (err) {
      setError(err.message || 'No se pudo enviar tu consulta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-shell">
      <form className="section-card auth-card" onSubmit={handleSubmit}>
        <p className="section-kicker">Contacto</p>
        <h1>Escríbenos</h1>
        <div className="form-grid-two">
          <label className="field-group"><span>Nombre</span><input className="input" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} required /></label>
          <label className="field-group"><span>Apellido</span><input className="input" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} required /></label>
          <label className="field-group"><span>Fecha de nacimiento</span><input className="input" type="date" value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></label>
          <label className="field-group"><span>Teléfono</span><input className="input" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
          <label className="field-group"><span>Instagram</span><input className="input" value={form.instagram} onChange={(event) => update('instagram', event.target.value)} /></label>
          <label className="field-group"><span>Email</span><input className="input" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
          <label className="field-group form-grid-span-two"><span>Consulta</span><textarea className="input textarea" value={form.message} onChange={(event) => update('message', event.target.value)} required /></label>
        </div>
        {error ? <p className="error-copy">{error}</p> : null}
        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar'}
        </button>
      </form>

      {sent ? (
        <div className="modal-backdrop" onClick={() => setSent(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h2>Consulta enviada</h2>
            <p>Gracias por escribir. Te responderemos desde administración.</p>
            <button type="button" className="button button-primary" onClick={() => setSent(false)}>Cerrar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
