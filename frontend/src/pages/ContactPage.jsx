import { useState } from 'react';

const initialState = {
  firstName: '',
  lastName: '',
  birthDate: '',
  phone: '',
  instagram: '',
  message: '',
};

export default function ContactPage() {
  const [form, setForm] = useState(initialState);
  const [sent, setSent] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSent(true);
    setForm(initialState);
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
          <label className="field-group form-grid-span-two"><span>Instagram</span><input className="input" value={form.instagram} onChange={(event) => update('instagram', event.target.value)} /></label>
          <label className="field-group form-grid-span-two"><span>Consulta</span><textarea className="input textarea" value={form.message} onChange={(event) => update('message', event.target.value)} required /></label>
        </div>
        <button className="button button-primary" type="submit">Enviar</button>
      </form>

      {sent ? (
        <div className="modal-backdrop" onClick={() => setSent(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h2>Consulta enviada</h2>
            <p>Gracias por escribir. Te responderemos desde el backoffice.</p>
            <button type="button" className="button button-primary" onClick={() => setSent(false)}>Cerrar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
