import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import { apiFetch } from '../../lib/api.js';
import { formatCurrency } from '../../lib/format.js';
import { resolveAssetUrl } from '../../lib/api.js';

const ARTICLE_STATUS_LABELS = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
  RESERVED: 'Reservada',
  SOLD_OUT: 'Agotada',
};

export default function AdminArticlesPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadArticles(query = '') {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      params.set('sort', 'intake_desc');
      const response = await apiFetch(`/api/admin/articles?${params.toString()}`);
      setItems(response.items || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar artículos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArticles();
  }, []);

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administración</p>
            <h1>Artículos</h1>
          </div>
          <Link to="/admin/articles/new" className="button button-primary">Nuevo artículo</Link>
        </div>

        <div className="toolbar-inline">
          <input className="input" placeholder="Buscar artículo" value={search} onChange={(event) => setSearch(event.target.value)} />
          <button type="button" className="ghost-button" onClick={() => loadArticles(search)}>Buscar</button>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
        {loading ? <div className="centered-card">Cargando…</div> : null}

        <div className="admin-list">
          {items.map((article) => (
            <article key={article.id} className="admin-row-card">
              <img src={resolveAssetUrl(article.primaryImage)} alt={article.title} />
              <div>
                <p className="eyebrow">{article.categoryName}{article.brandName ? ` · ${article.brandName}` : ''}</p>
                <h3>{article.title}</h3>
                <p className="muted-copy">Estado: {ARTICLE_STATUS_LABELS[article.status] || article.status} · Stock disponible: {article.quantityAvailable}</p>
              </div>
              <div className="admin-row-actions">
                <strong>{formatCurrency(article.discountedPrice || article.salePrice)}</strong>
                <Link to={`/admin/articles/${article.id}/edit`} className="button button-secondary">Editar</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
