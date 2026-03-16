import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import { apiFetch } from '../../lib/api.js';
import { BRAND_OPTIONS, CATEGORY_OPTIONS, SIZE_OPTIONS } from '../../constants/lookups.js';

function toFormState(article) {
  return {
    internalCode: article?.internalCode || '',
    slug: article?.slug || '',
    title: article?.title || '',
    categoryId: article?.categoryId || CATEGORY_OPTIONS[0].id,
    brandId: article?.brandId || '',
    sizeId: article?.sizeId || '',
    sizeText: article?.sizeText || '',
    measurementsText: article?.measurementsText || '',
    description: article?.description || '',
    purchasePriceItem: article?.purchasePriceItem ?? 0,
    purchasePriceShipping: article?.purchasePriceShipping ?? 0,
    purchasePriceCourier: article?.purchasePriceCourier ?? 0,
    salePrice: article?.salePrice ?? 0,
    discountType: article?.discountType || 'NONE',
    discountValue: article?.discountValue ?? 0,
    allowOffers: Boolean(article?.allowOffers),
    isFeatured: Boolean(article?.isFeatured),
    intakeDate: article?.intakeDate ? String(article.intakeDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
    quantityTotal: article?.quantityTotal ?? 1,
    quantityAvailable: article?.quantityAvailable ?? 1,
    quantityReserved: article?.quantityReserved ?? 0,
    quantitySold: article?.quantitySold ?? 0,
    status: article?.status || 'ACTIVE',
    originNotes: article?.originNotes || '',
  };
}

export default function AdminArticleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(toFormState(null));
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let ignore = false;
    if (!id) return undefined;

    async function loadArticle() {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/admin/articles/${id}`);
        if (!ignore) setForm(toFormState(response.article));
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudo cargar el artículo');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticle();
    return () => {
      ignore = true;
    };
  }, [id]);

  const totalPurchasePrice = useMemo(
    () => Number(form.purchasePriceItem || 0) + Number(form.purchasePriceShipping || 0) + Number(form.purchasePriceCourier || 0),
    [form.purchasePriceItem, form.purchasePriceShipping, form.purchasePriceCourier],
  );

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        brandId: form.brandId ? Number(form.brandId) : null,
        sizeId: form.sizeId ? Number(form.sizeId) : null,
        purchasePriceItem: Number(form.purchasePriceItem),
        purchasePriceShipping: Number(form.purchasePriceShipping),
        purchasePriceCourier: Number(form.purchasePriceCourier),
        salePrice: Number(form.salePrice),
        discountValue: Number(form.discountValue),
        allowOffers: form.discountType !== 'NONE' && Number(form.discountValue) > 0 ? false : Boolean(form.allowOffers),
        isFeatured: Boolean(form.isFeatured),
        quantityTotal: Number(form.quantityTotal),
        quantityAvailable: Number(form.quantityAvailable),
        quantityReserved: Number(form.quantityReserved),
        quantitySold: Number(form.quantitySold),
        sizeText: form.sizeText || null,
        measurementsText: form.measurementsText || null,
        description: form.description || null,
        originNotes: form.originNotes || null,
      };

      const response = await apiFetch(isEdit ? `/api/admin/articles/${id}` : '/api/admin/articles', {
        method: isEdit ? 'PUT' : 'POST',
        body: payload,
      });

      const articleId = response.article.id;

      if (images.length) {
        const formData = new FormData();
        Array.from(images).forEach((file) => formData.append('images', file));
        await apiFetch(`/api/admin/articles/${articleId}/images`, { method: 'POST', body: formData });
      }

      setMessage(isEdit ? 'Artículo actualizado correctamente.' : 'Artículo creado correctamente.');
      if (!isEdit) {
        navigate(`/admin/articles/${articleId}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'No se pudo guardar el artículo');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="container section-card centered-card">Cargando artículo…</div>;
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />
      <form className="section-card page-stack" onSubmit={handleSubmit}>
        <div className="section-heading">
          <div>
            <p className="section-kicker">Administración</p>
            <h1>{isEdit ? 'Editar artículo' : 'Nuevo artículo'}</h1>
          </div>
          <Link to="/admin/articles" className="ghost-button linklike">Volver</Link>
        </div>

        <div className="form-grid-two">
          <label className="field-group"><span>Título</span><input className="input" value={form.title} onChange={(event) => update('title', event.target.value)} required /></label>
          <label className="field-group"><span>Código interno</span><input className="input" value={form.internalCode} onChange={(event) => update('internalCode', event.target.value)} /></label>
          <label className="field-group"><span>Slug</span><input className="input" value={form.slug} onChange={(event) => update('slug', event.target.value)} /></label>
          <label className="field-group"><span>Fecha de ingreso</span><input className="input" type="date" value={form.intakeDate} onChange={(event) => update('intakeDate', event.target.value)} required /></label>
          <label className="field-group"><span>Categoría</span><select className="input" value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}>{CATEGORY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="field-group"><span>Marca</span><select className="input" value={form.brandId} onChange={(event) => update('brandId', event.target.value)}><option value="">Sin marca</option>{BRAND_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="field-group"><span>Talle normalizado</span><select className="input" value={form.sizeId} onChange={(event) => update('sizeId', event.target.value)}><option value="">Sin talle</option>{SIZE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="field-group"><span>Talle texto libre</span><input className="input" value={form.sizeText} onChange={(event) => update('sizeText', event.target.value)} /></label>
          <label className="field-group form-grid-span-two"><span>Medidas</span><input className="input" value={form.measurementsText} onChange={(event) => update('measurementsText', event.target.value)} /></label>
          <label className="field-group form-grid-span-two"><span>Descripción</span><textarea className="input textarea" value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
          <label className="field-group"><span>Precio compra artículo</span><input className="input" type="number" min="0" value={form.purchasePriceItem} onChange={(event) => update('purchasePriceItem', event.target.value)} /></label>
          <label className="field-group"><span>Precio compra envío</span><input className="input" type="number" min="0" value={form.purchasePriceShipping} onChange={(event) => update('purchasePriceShipping', event.target.value)} /></label>
          <label className="field-group"><span>Precio compra courrier</span><input className="input" type="number" min="0" value={form.purchasePriceCourier} onChange={(event) => update('purchasePriceCourier', event.target.value)} /></label>
          <label className="field-group"><span>Precio venta</span><input className="input" type="number" min="0" value={form.salePrice} onChange={(event) => update('salePrice', event.target.value)} required /></label>
          <label className="field-group"><span>Descuento tipo</span><select className="input" value={form.discountType} onChange={(event) => update('discountType', event.target.value)}><option value="NONE">Sin descuento</option><option value="PERCENT">Porcentaje</option><option value="FIXED">Monto fijo</option></select></label>
          <label className="field-group"><span>Descuento valor</span><input className="input" type="number" min="0" value={form.discountValue} onChange={(event) => update('discountValue', event.target.value)} /></label>
          <label className="field-group"><span>Cantidad total</span><input className="input" type="number" min="0" value={form.quantityTotal} onChange={(event) => update('quantityTotal', event.target.value)} /></label>
          <label className="field-group"><span>Cantidad disponible</span><input className="input" type="number" min="0" value={form.quantityAvailable} onChange={(event) => update('quantityAvailable', event.target.value)} /></label>
          <label className="field-group"><span>Cantidad reservada</span><input className="input" type="number" min="0" value={form.quantityReserved} onChange={(event) => update('quantityReserved', event.target.value)} /></label>
          <label className="field-group"><span>Cantidad vendida</span><input className="input" type="number" min="0" value={form.quantitySold} onChange={(event) => update('quantitySold', event.target.value)} /></label>
          <label className="field-group"><span>Estado</span><select className="input" value={form.status} onChange={(event) => update('status', event.target.value)}><option value="ACTIVE">ACTIVA</option><option value="INACTIVE">INACTIVA</option><option value="RESERVED">RESERVADA</option><option value="SOLD_OUT">AGOTADA</option></select></label>
          <label className="field-group"><span>Imágenes</span><input className="input" type="file" multiple accept="image/*" onChange={(event) => setImages(event.target.files || [])} /></label>
          <label className="field-group checkbox-field"><input type="checkbox" checked={form.isFeatured} onChange={(event) => update('isFeatured', event.target.checked)} /><span>Destacado</span></label>
          <label className="field-group checkbox-field"><input type="checkbox" checked={form.allowOffers && !(form.discountType !== 'NONE' && Number(form.discountValue) > 0)} onChange={(event) => update('allowOffers', event.target.checked)} disabled={form.discountType !== 'NONE' && Number(form.discountValue) > 0} /><span>Permite ofertas</span></label>
          <label className="field-group form-grid-span-two"><span>Notas internas / origen</span><textarea className="input textarea" value={form.originNotes} onChange={(event) => update('originNotes', event.target.value)} /></label>
        </div>

        <div className="inline-note">Costo de compra total estimado: <strong>{totalPurchasePrice}</strong></div>
        {error ? <p className="error-copy">{error}</p> : null}
        {message ? <p className="success-copy">{message}</p> : null}

        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Guardando…' : isEdit ? 'Actualizar artículo' : 'Crear artículo'}
        </button>
      </form>
    </div>
  );
}
