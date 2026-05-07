import { useState } from 'react';
import SeoHead from '../components/SeoHead.jsx';
import { useSiteSeo } from '../contexts/SiteSeoContext.jsx';
import { apiFetch } from '../lib/api.js';
import { useMobileMenu } from '../contexts/MobileMenuContext.jsx';
import { firstValidationMessage, getEmailValidationMessage, getRequiredValidationMessage, notifyFormStatus } from '../lib/validation.js';
import { toAbsoluteUrl } from '../lib/seo.js';

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
  const { site, pagesByRoute } = useSiteSeo();
  const { notifyMobileStatus } = useMobileMenu();
  const contactSeo = pagesByRoute['/contact'] || null;
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
      const validationMessage = firstValidationMessage(
        getRequiredValidationMessage(form.firstName, 'el nombre'),
        getRequiredValidationMessage(form.lastName, 'el apellido'),
        getEmailValidationMessage(form.email),
        getRequiredValidationMessage(form.message, 'la consulta'),
      );
      if (validationMessage) {
        setError(validationMessage);
        notifyFormStatus(notifyMobileStatus, 'error', validationMessage);
        return;
      }
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
      notifyFormStatus(notifyMobileStatus, 'success', 'Consulta enviada correctamente.');
      setForm(initialState);
    } catch (err) {
      const errorMessage = err.message || 'No se pudo enviar tu consulta';
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, 'error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container page-stack contact-page-shell">
      <SeoHead
        title={contactSeo?.title || `Contacto | ${site.name}`}
        description={contactSeo?.description || 'Consultanos por una prenda, talles, ingresos nuevos o formas de entrega.'}
        canonical={contactSeo?.canonicalUrl || toAbsoluteUrl('/contact', site)}
        url={toAbsoluteUrl('/contact', site)}
      />

      <form className="section-card auth-card contact-form-card" onSubmit={handleSubmit} noValidate>
        <p className="section-kicker">Contacto</p>
        <h1>Escribenos</h1>
        <p className="muted-copy">
          Consultanos por una prenda, talles, ingresos nuevos o formas de entrega.
        </p>
        <div className="form-grid-two">
          <label className="field-group"><span>Nombre</span><input className="input" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} required /></label>
          <label className="field-group"><span>Apellido</span><input className="input" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} required /></label>
          <label className="field-group"><span>Fecha de nacimiento</span><input className="input" type="date" value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></label>
          <label className="field-group"><span>Telefono</span><input className="input" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
          <label className="field-group"><span>Instagram</span><input className="input" value={form.instagram} onChange={(event) => update('instagram', event.target.value)} /></label>
          <label className="field-group"><span>Email</span><input className="input" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
          <label className="field-group form-grid-span-two"><span>Consulta</span><textarea className="input textarea" value={form.message} onChange={(event) => update('message', event.target.value)} required /></label>
        </div>
        {error ? <p className="error-copy">{error}</p> : null}
        <div className="contact-form-actions">
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>

      {sent ? (
        <div className="modal-backdrop" onClick={() => setSent(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h2>Consulta enviada</h2>
            <p>Gracias por escribir. Te responderemos desde administracion.</p>
            <button type="button" className="button button-primary" onClick={() => setSent(false)}>Cerrar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
