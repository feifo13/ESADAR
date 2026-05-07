import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { apiFetch } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { articlePath } from '../../lib/routes.js';
import { useMobileMenu } from '../../contexts/MobileMenuContext.jsx';

const LEAD_STATUS_LABELS = { NEW: 'Nuevo', CONTACTED: 'Contactado', QUALIFIED: 'Calificado', ARCHIVED: 'Archivado' };
const SOURCE_LABELS = { CHECKOUT: 'Checkout', CONTACT_FORM: 'Contacto', MANUAL: 'Manual', OFFER: 'Oferta', NEWSLETTER: 'Newsletter', STOCK_ALERT: 'Alerta de stock', WISHLIST: 'Guardado', ABANDONED_CART: 'Carrito abandonado', PRODUCT_INTEREST: 'Interes de producto' };
const ALERT_STATUS_LABELS = { ACTIVE: 'Activa', PAUSED: 'Pausada', CONVERTED: 'Convertida', CANCELLED: 'Cancelada' };
const formatSource = (source) => SOURCE_LABELS[source] || source || 'Sin origen';
const formatPreferences = (preferences = {}) => ([...(preferences.preferredCategories || []), ...(preferences.preferredBrands || []), ...(preferences.preferredSizes || []), ...(preferences.preferredColors || [])].filter(Boolean));

export default function AdminLeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notifyMobileStatus } = useMobileMenu();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusForm, setStatusForm] = useState({ leadStatus: 'NEW', adminNotes: '' });

  useEffect(() => {
    let ignore = false;
    async function loadLead() {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/admin/leads/${id}`);
        if (ignore) return;
        setLead(response.lead || null);
        setStatusForm({ leadStatus: response.lead?.leadStatus || 'NEW', adminNotes: response.lead?.adminNotes || '' });
      } catch (err) {
        if (!ignore) notifyMobileStatus({ type: 'error', icon: 'error', message: err.message || 'No se pudo cargar el lead.' });
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadLead();
    return () => { ignore = true; };
  }, [id, notifyMobileStatus]);

  async function handleStatusSubmit(event) {
    event.preventDefault();
    if (!lead) return;
    try {
      setSaving(true);
      const response = await apiFetch(`/api/admin/leads/${lead.id}/status`, { method: 'PATCH', body: statusForm });
      setLead(response.lead || null);
      setStatusForm({ leadStatus: response.lead?.leadStatus || 'NEW', adminNotes: response.lead?.adminNotes || '' });
      notifyMobileStatus({ type: 'success', icon: 'success', message: 'Lead actualizado correctamente.' });
    } catch (err) {
      notifyMobileStatus({ type: 'error', icon: 'error', message: err.message || 'No se pudo actualizar el lead.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container page-stack admin-page-shell admin-detail-page admin-lead-detail-page">
      <AdminToolbar />
      <button type="button" className="ghost-button linklike account-order-detail-back" onClick={() => navigate(-1)}>Volver</button>
      <section className="section-card page-stack">
        {loading ? <p className="muted-copy">Cargando lead...</p> : null}
        {!loading && !lead ? <p className="muted-copy">Lead no encontrado.</p> : null}
        {lead ? (<>
          <div className="section-heading section-heading-wrap"><div><p className="section-kicker">Lead</p><h1>{lead.firstName} {lead.lastName}</h1></div><StatusBadge status={lead.leadStatus} labels={LEAD_STATUS_LABELS} /></div>
          <div className="admin-detail-meta admin-detail-meta--grid">
            <p className="summary-line"><span>Origen</span><strong>{formatSource(lead.source)}</strong></p><p className="summary-line"><span>Email</span><strong>{lead.email || 'Sin email'}</strong></p><p className="summary-line"><span>WhatsApp</span><strong>{lead.phone || 'Sin telefono'}</strong></p><p className="summary-line"><span>Instagram</span><strong>{lead.instagram || 'Sin Instagram'}</strong></p><p className="summary-line"><span>Alta</span><strong>{formatDate(lead.createdAt)}</strong></p><p className="summary-line"><span>Actualizacion</span><strong>{formatDate(lead.updatedAt)}</strong></p>
          </div>
          <div className="page-stack-sm"><p className="section-kicker">Preferencias</p><div className="preference-chip-list">{formatPreferences(lead.preferences).length ? formatPreferences(lead.preferences).map((item) => <span key={`${lead.id}-${item}`} className="preference-chip">{item}</span>) : <span className="muted-copy">Sin preferencias guardadas.</span>}</div>{lead.preferences?.notes ? <p className="muted-copy admin-detail-note">{lead.preferences.notes}</p> : null}</div>
          <div className="page-stack-sm"><p className="section-kicker">Alertas</p>{(lead.alerts || []).length ? <div className="history-list">{lead.alerts.map((alert) => <article key={alert.id} className="history-row"><div><strong>{alert.alertType}</strong><p className="muted-copy">{alert.articleTitle || 'Sin articulo asociado'} · {formatDate(alert.createdAt)}</p></div><div className="table-actions"><StatusBadge status={alert.status} labels={ALERT_STATUS_LABELS} />{alert.articleSlug ? <Link className="ghost-button" to={articlePath({ slug: alert.articleSlug, articleId: alert.articleId })}>Ver articulo</Link> : null}</div></article>)}</div> : <p className="muted-copy">Sin alertas asociadas.</p>}</div>
          <div className="page-stack-sm"><p className="section-kicker">Wishlists</p>{(lead.wishlists || []).length ? <div className="history-list">{lead.wishlists.map((wishlist) => <article key={wishlist.id} className="history-row"><strong>Wishlist #{wishlist.id}</strong><span>{wishlist.itemCount} prendas guardadas</span></article>)}</div> : <p className="muted-copy">Sin listas guardadas.</p>}</div>
          <form className="section-card nested-card page-stack-sm admin-detail-form-card" onSubmit={handleStatusSubmit} noValidate>
            <div className="stack-gap-sm">
              <p className="section-kicker">Seguimiento interno</p>
              <h2>Gestionar lead</h2>
              <p className="muted-copy">
                Actualiza el estado comercial y deja notas internas para el proximo seguimiento.
              </p>
            </div>
            <label className="field-group">
              <span>Estado</span>
              <select
                className="input"
                value={statusForm.leadStatus}
                onChange={(event) => setStatusForm((current) => ({ ...current, leadStatus: event.target.value }))}
              >
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span>Notas administrativas</span>
              <textarea
                className="input textarea admin-detail-form-textarea"
                value={statusForm.adminNotes}
                onChange={(event) => setStatusForm((current) => ({ ...current, adminNotes: event.target.value }))}
                placeholder="Observaciones, proximo paso o contexto comercial."
              />
            </label>
            <div className="admin-detail-form-actions">
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar seguimiento'}
              </button>
            </div>
          </form>
        </>) : null}
      </section>
    </div>
  );
}
