export default function BulkArticleSubmitSummary({ result }) {
  if (!result) return null;

  return (
    <section className="section-card page-stack">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Resultado</p>
          <h2>Resumen de subida</h2>
        </div>
      </div>

      <div className="stats-kpi-grid stats-kpi-grid--compact">
        <article className="stats-kpi-card"><span>Total</span><strong>{result.summary?.total || 0}</strong></article>
        <article className="stats-kpi-card"><span>Creados</span><strong>{result.summary?.created || 0}</strong></article>
        <article className="stats-kpi-card"><span>Fallidos</span><strong>{result.summary?.failed || 0}</strong></article>
        <article className="stats-kpi-card"><span>Warnings</span><strong>{result.summary?.warnings || 0}</strong></article>
      </div>

      {(result.created || []).length ? (
        <div className="page-stack-sm">
          <h3>Creados</h3>
          {(result.created || []).map((item) => (
            <div key={`${item.rowNumber}-${item.articleId}`} className="history-row">
              <div>
                <strong>Articulo {item.rowNumber}: {item.title}</strong>
                <p className="muted-copy">ID {item.articleId} · Codigo {item.internalCode}</p>
              </div>
              <span>{(item.warnings || []).length ? `${item.warnings.length} warnings` : 'OK'}</span>
            </div>
          ))}
        </div>
      ) : null}

      {(result.failed || []).length ? (
        <div className="page-stack-sm">
          <h3>Fallidos</h3>
          {(result.failed || []).map((item) => (
            <div key={`${item.rowNumber}-${item.title}`} className="history-row">
              <div>
                <strong>Articulo {item.rowNumber}: {item.title || 'Sin titulo'}</strong>
                <p className="error-copy">{(item.errors || []).join(' · ')}</p>
              </div>
              <span>{(item.warnings || []).length ? `${item.warnings.length} warnings` : 'Sin warnings'}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
