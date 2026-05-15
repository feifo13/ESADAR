import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { apiFetch } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { focusValidationTarget } from '../../lib/validation.js';
import AppLoader from "../../components/AppLoader.jsx";

const CONTACT_STATUS_LABELS = {
  NEW: 'Nuevo',
  READ: 'Leido',
  REPLIED: 'Respondido',
  ARCHIVED: 'Archivado',
};

export default function AdminContactMessageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useNotification();
  const [message, setMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadMessage() {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/admin/contact-messages/${id}`);
        let loadedMessage = response.message || null;

        if (loadedMessage?.status === 'NEW') {
          const statusResponse = await apiFetch(
            `/api/admin/contact-messages/${loadedMessage.id}/status`,
            { method: 'PATCH', body: { status: 'READ' } },
          );
          loadedMessage = statusResponse.message || { ...loadedMessage, status: 'READ' };
        }

        if (!ignore) setMessage(loadedMessage);
      } catch (err) {
        if (!ignore) {
          notifyError(err.message || 'No se pudo cargar el contacto.');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMessage();
    return () => {
      ignore = true;
    };
  }, [id, notifyError]);

  async function updateStatus(nextStatus) {
    if (!message) return;

    try {
      setSaving(true);
      const response = await apiFetch(
        `/api/admin/contact-messages/${message.id}/status`,
        { method: 'PATCH', body: { status: nextStatus } },
      );
      setMessage(response.message || { ...message, status: nextStatus });
      notifySuccess('Estado actualizado.');
    } catch (err) {
      notifyError(err.message || 'No se pudo actualizar el contacto.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReplySubmit(event) {
    event.preventDefault();
    if (!message) return;

    if (!message.email) {
      notifyError('Este contacto no tiene email para responder.');
      return;
    }

    if (!replyText.trim()) {
      focusValidationTarget('contact-reply-message', event.currentTarget);
      notifyError('Escribe una respuesta antes de enviar.');
      return;
    }

    try {
      setSaving(true);
      const response = await apiFetch(`/api/admin/contact-messages/${message.id}/reply`, {
        method: 'POST',
        body: { replyMessage: replyText },
      });
      setMessage(response.message || null);
      setReplyText('');
      notifySuccess('Respuesta enviada correctamente.');
    } catch (err) {
      notifyError(err.message || 'No se pudo enviar la respuesta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container page-stack admin-page-shell admin-detail-page admin-contact-detail-page">
      <AdminToolbar />
      <button
        type="button"
        className="ghost-button linklike account-order-detail-back"
        onClick={() => navigate('/admin/contact-messages')}
      >
        Volver a contactos
      </button>

      <section className="section-card page-stack">
        {loading ? <AppLoader variant="card" label="Cargando contacto" /> : null}
        {!loading && !message ? <p className="muted-copy">Contacto no encontrado.</p> : null}

        {message ? (
          <>
            <div className="section-heading section-heading-wrap">
              <div>
                <p className="section-kicker">Contacto</p>
                <h1>{message.firstName} {message.lastName}</h1>
              </div>
              <StatusBadge status={message.status} labels={CONTACT_STATUS_LABELS} />
            </div>

            <div className="admin-detail-meta admin-detail-meta--grid">
              <p className="summary-line"><span>Email</span><strong>{message.email || 'Sin email'}</strong></p>
              <p className="summary-line"><span>Teléfono</span><strong>{message.phone || 'Sin teléfono'}</strong></p>
              <p className="summary-line"><span>Instagram</span><strong>{message.instagram || 'Sin Instagram'}</strong></p>
              <p className="summary-line"><span>Fecha</span><strong>{formatDate(message.createdAt)}</strong></p>
              <p className="summary-line"><span>Gestionado por</span><strong>{message.handledByName || 'Sin asignar'}</strong></p>
            </div>

            <div className="section-card nested-card page-stack-sm">
              <p className="section-kicker">Mensaje</p>
              <p className="dialog-copy">{message.message}</p>
            </div>

            <div className="table-actions">
              {message.status !== 'READ' ? (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={saving}
                  onClick={() => updateStatus('READ')}
                >
                  Marcar leido
                </button>
              ) : null}
              {message.status !== 'ARCHIVED' ? (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={saving}
                  onClick={() => updateStatus('ARCHIVED')}
                >
                  Archivar
                </button>
              ) : null}
            </div>

            <form
              className="section-card nested-card page-stack-sm admin-detail-form-card"
              onSubmit={handleReplySubmit}
              noValidate
            >
              <div className="stack-gap-sm">
                <p className="section-kicker">Respuesta</p>
                <h2>Responder por email</h2>
                <p className="muted-copy">
                  La respuesta se enviara al email del contacto y quedara registrada como gestionada.
                </p>
              </div>
              <label className="field-group">
                <span>Mensaje de respuesta</span>
                <textarea
                  className="input textarea admin-detail-form-textarea"
                  name="contact-reply-message"
                  data-validation-field="contact-reply-message"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder={
                    message.email
                      ? 'Escribe la respuesta para enviar por email.'
                      : 'Este contacto no tiene email para responder.'
                  }
                />
              </label>
              {!message.email ? (
                <p className="muted-copy">
                  Este contacto no tiene email asociado, por eso no se puede responder desde la app.
                </p>
              ) : null}
              <div className="admin-detail-form-actions">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving || !message.email}
                >
                  {saving ? 'Enviando...' : 'Enviar respuesta'}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
