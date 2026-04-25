import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import SmartImage from '../../components/SmartImage.jsx';
import { useLookups } from '../../contexts/LookupsContext.jsx';
import { apiFetch } from '../../lib/api.js';

const GENDER_OPTIONS = [
  { value: '', label: 'Sin definir' },
  { value: 'UNISEX', label: 'Unisex' },
  { value: 'HOMBRE', label: 'Hombre' },
  { value: 'MUJER', label: 'Mujer' },
  { value: 'NIÑO', label: 'Nino' },
  { value: 'NIÑA', label: 'Nina' },
  { value: 'OTRO', label: 'Otro' },
];

const AGE_GROUP_OPTIONS = [
  { value: '', label: 'Sin definir' },
  { value: 'ADULT', label: 'Adulto' },
  { value: 'KIDS', label: 'Kids' },
  { value: 'TODDLER', label: 'Toddler' },
  { value: 'INFANT', label: 'Infant' },
  { value: 'NEWBORN', label: 'Newborn' },
];

function sortImages(images = []) {
  return [...images].sort((left, right) => {
    if (Number(left.isPrimary) !== Number(right.isPrimary)) {
      return Number(right.isPrimary) - Number(left.isPrimary);
    }

    if (Number(left.sortOrder || 0) !== Number(right.sortOrder || 0)) {
      return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
    }

    return Number(left.id || 0) - Number(right.id || 0);
  });
}

function toFormState(article) {
  return {
    internalCode: article?.internalCode || '',
    slug: article?.slug || '',
    title: article?.title || '',
    seoTitle: article?.seoTitle || '',
    seoDescription: article?.seoDescription || '',
    canonicalUrl: article?.canonicalUrl || '',
    googleProductCategory: article?.googleProductCategory || '',
    conditionLabel: article?.conditionLabel || '',
    color: article?.color || '',
    material: article?.material || '',
    gender: article?.gender || '',
    ageGroup: article?.ageGroup || '',
    imageAltOverride: article?.imageAltOverride || '',
    categoryId: article?.categoryId || '',
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
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();
  const [form, setForm] = useState(toFormState(null));
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [selectedPreviews, setSelectedPreviews] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [imageActionId, setImageActionId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let ignore = false;
    if (!id) return undefined;

    async function loadArticle() {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/admin/articles/${id}`);
        if (!ignore) {
          setForm(toFormState(response.article));
          setExistingImages(sortImages(response.article.images || []));
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'No se pudo cargar el articulo');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticle();
    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    const nextPreviews = Array.from(images || []).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    setSelectedPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [images]);

  const totalPurchasePrice = useMemo(
    () => Number(form.purchasePriceItem || 0) + Number(form.purchasePriceShipping || 0) + Number(form.purchasePriceCourier || 0),
    [form.purchasePriceItem, form.purchasePriceShipping, form.purchasePriceCourier],
  );

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateExistingImage(imageId, name, value) {
    setExistingImages((current) => current.map((image) => (
      Number(image.id) === Number(imageId)
        ? { ...image, [name]: value }
        : image
    )));
  }

  async function refreshArticle(articleId) {
    const response = await apiFetch(`/api/admin/articles/${articleId}`);
    setForm(toFormState(response.article));
    setExistingImages(sortImages(response.article.images || []));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const payload = {
        ...form,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
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
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        canonicalUrl: form.canonicalUrl || null,
        googleProductCategory: form.googleProductCategory || null,
        conditionLabel: form.conditionLabel || null,
        color: form.color || null,
        material: form.material || null,
        gender: form.gender || null,
        ageGroup: form.ageGroup || null,
        imageAltOverride: form.imageAltOverride || null,
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
        setImages([]);
      }

      await refreshArticle(articleId);
      setMessage(isEdit ? 'Articulo actualizado correctamente.' : 'Articulo creado correctamente.');

      if (!isEdit) {
        navigate(`/admin/articles/${articleId}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'No se pudo guardar el articulo');
    } finally {
      setSaving(false);
    }
  }

  async function saveImageDraft(imageId) {
    const image = existingImages.find((item) => Number(item.id) === Number(imageId));
    if (!image) return;

    try {
      setImageActionId(`save-${imageId}`);
      setError('');
      setMessage('');
      const response = await apiFetch(`/api/admin/articles/${id}/images/${imageId}`, {
        method: 'PATCH',
        body: {
          altText: image.altText || null,
          sortOrder: Number(image.sortOrder || 0),
          isPrimary: Boolean(image.isPrimary),
        },
      });
      setExistingImages(sortImages(response.images || []));
      setMessage('Los datos de la imagen fueron actualizados.');
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la imagen');
    } finally {
      setImageActionId('');
    }
  }

  async function markImageAsPrimary(imageId) {
    try {
      setImageActionId(`primary-${imageId}`);
      setError('');
      setMessage('');
      const response = await apiFetch(`/api/admin/articles/${id}/images/${imageId}`, {
        method: 'PATCH',
        body: { isPrimary: true },
      });
      setExistingImages(sortImages(response.images || []));
      setMessage('La imagen primaria fue actualizada.');
    } catch (err) {
      setError(err.message || 'No se pudo marcar la imagen primaria');
    } finally {
      setImageActionId('');
    }
  }

  async function deleteImage(imageId) {
    try {
      setImageActionId(`delete-${imageId}`);
      setError('');
      setMessage('');
      const response = await apiFetch(`/api/admin/articles/${id}/images/${imageId}`, {
        method: 'DELETE',
      });
      setExistingImages(sortImages(response.images || []));
      setMessage('La imagen fue eliminada.');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la imagen');
    } finally {
      setImageActionId('');
    }
  }

  async function moveImage(imageId, direction) {
    const sorted = sortImages(existingImages);
    const currentIndex = sorted.findIndex((image) => Number(image.id) === Number(imageId));
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sorted.length) {
      return;
    }

    const reordered = [...sorted];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    try {
      setImageActionId(`move-${imageId}`);
      setError('');
      setMessage('');
      const response = await apiFetch(`/api/admin/articles/${id}/images/reorder`, {
        method: 'POST',
        body: { imageIds: reordered.map((image) => image.id) },
      });
      setExistingImages(sortImages(response.images || []));
      setMessage('El orden de las imagenes fue actualizado.');
    } catch (err) {
      setError(err.message || 'No se pudo reordenar la imagen');
    } finally {
      setImageActionId('');
    }
  }

  if (loading) {
    return <div className="container section-card centered-card">Cargando articulo...</div>;
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <form className="section-card page-stack" onSubmit={handleSubmit}>
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>{isEdit ? 'Editar articulo' : 'Nuevo articulo'}</h1>
          </div>
          <Link to="/admin/articles" className="ghost-button linklike">Volver</Link>
        </div>

        <section className="section-card nested-card page-stack">
          <div>
            <p className="section-kicker">Imagenes</p>
            <h2>Visual y orden</h2>
            <p className="muted-copy helper-note">
              Foto frontal, fondo neutro, sin texto ni marca de agua. Agregar espalda, etiqueta y detalles.
            </p>
          </div>

          {(existingImages.length || selectedPreviews.length) ? (
            <div className="image-manager-grid">
              {existingImages.map((image, index) => (
                <article key={`existing-${image.id}`} className="image-manager-card">
                  <SmartImage
                    src={image.cardFilePath || image.detailFilePath || image.filePath}
                    alt={image.altText || form.title}
                    fallbackLabel={form.title || 'ESADAR'}
                    className="image-manager-card__media"
                  />

                  <div className="page-stack stack-gap-xs">
                    <div className="table-actions table-actions-spread">
                      <strong>{image.isPrimary ? 'Primaria' : `Imagen ${index + 1}`}</strong>
                      <span className="muted-copy">Orden {image.sortOrder}</span>
                    </div>

                    <label className="field-group">
                      <span>Alt text</span>
                      <input
                        className="input"
                        value={image.altText || ''}
                        onChange={(event) => updateExistingImage(image.id, 'altText', event.target.value)}
                        placeholder="Descripcion util para Google Images y accesibilidad"
                      />
                    </label>

                    <div className="image-manager-meta">
                      <span>{image.width && image.height ? `${image.width}x${image.height}` : 'Sin metadata'}</span>
                      <span>{image.processedStatus || 'DONE'}</span>
                    </div>

                    <div className="inline-action-group">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => saveImageDraft(image.id)}
                        disabled={Boolean(imageActionId)}
                      >
                        {imageActionId === `save-${image.id}` ? 'Guardando...' : 'Guardar alt'}
                      </button>

                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => markImageAsPrimary(image.id)}
                        disabled={Boolean(imageActionId) || image.isPrimary}
                      >
                        {imageActionId === `primary-${image.id}` ? 'Actualizando...' : image.isPrimary ? 'Ya es primaria' : 'Marcar primaria'}
                      </button>
                    </div>

                    <div className="inline-action-group">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => moveImage(image.id, -1)}
                        disabled={Boolean(imageActionId) || index === 0}
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => moveImage(image.id, 1)}
                        disabled={Boolean(imageActionId) || index === existingImages.length - 1}
                      >
                        Bajar
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => deleteImage(image.id)}
                        disabled={Boolean(imageActionId)}
                      >
                        {imageActionId === `delete-${image.id}` ? 'Eliminando...' : 'Borrar'}
                      </button>
                    </div>

                    {image.processingError ? <p className="error-copy">{image.processingError}</p> : null}
                  </div>
                </article>
              ))}

              {selectedPreviews.map((preview) => (
                <figure key={preview.id} className="image-manager-card image-manager-card--pending">
                  <SmartImage
                    src={preview.url}
                    alt={preview.name}
                    fallbackLabel={form.title || preview.name}
                    className="image-manager-card__media"
                  />
                  <figcaption>Lista para subir</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="centered-card nested-card">
              <p className="muted-copy">Todavia no hay imagenes cargadas para este articulo.</p>
            </div>
          )}

          <label className="field-group">
            <span>Agregar imagenes</span>
            <input className="input" type="file" multiple accept="image/*" onChange={(event) => setImages(event.target.files || [])} />
          </label>
        </section>

        <section className="section-card nested-card page-stack">
          <div>
            <p className="section-kicker">Ficha base</p>
            <h2>Datos principales</h2>
          </div>

          <div className="form-grid-two">
            <label className="field-group">
              <span>Titulo</span>
              <input className="input" value={form.title} onChange={(event) => update('title', event.target.value)} required />
            </label>

            <label className="field-group">
              <span>Codigo interno</span>
              <input className="input" value={form.internalCode} onChange={(event) => update('internalCode', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Slug</span>
              <input className="input" value={form.slug} onChange={(event) => update('slug', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Fecha de ingreso</span>
              <input className="input" type="date" value={form.intakeDate} onChange={(event) => update('intakeDate', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Categoria</span>
              <select className="input" value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}>
                <option value="">Sin categoria / default</option>
                {categoryOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>

            <label className="field-group">
              <span>Marca</span>
              <select className="input" value={form.brandId} onChange={(event) => update('brandId', event.target.value)}>
                <option value="">Sin marca</option>
                {brandOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>

            <label className="field-group">
              <span>Talle normalizado</span>
              <select className="input" value={form.sizeId} onChange={(event) => update('sizeId', event.target.value)}>
                <option value="">Sin talle</option>
                {sizeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>

            <label className="field-group">
              <span>Talle texto libre</span>
              <input className="input" value={form.sizeText} onChange={(event) => update('sizeText', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Estado de la prenda</span>
              <input className="input" value={form.conditionLabel} onChange={(event) => update('conditionLabel', event.target.value)} placeholder="Ej: Muy buen estado" />
            </label>

            <label className="field-group">
              <span>Google product category</span>
              <input className="input" value={form.googleProductCategory} onChange={(event) => update('googleProductCategory', event.target.value)} placeholder="Apparel & Accessories > Clothing" />
            </label>

            <label className="field-group">
              <span>Color</span>
              <input className="input" value={form.color} onChange={(event) => update('color', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Material</span>
              <input className="input" value={form.material} onChange={(event) => update('material', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Genero</span>
              <select className="input" value={form.gender} onChange={(event) => update('gender', event.target.value)}>
                {GENDER_OPTIONS.map((option) => <option key={option.value || 'empty'} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="field-group">
              <span>Grupo de edad</span>
              <select className="input" value={form.ageGroup} onChange={(event) => update('ageGroup', event.target.value)}>
                {AGE_GROUP_OPTIONS.map((option) => <option key={option.value || 'empty'} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="field-group form-grid-span-two">
              <span>Medidas reales</span>
              <input className="input" value={form.measurementsText} onChange={(event) => update('measurementsText', event.target.value)} />
            </label>

            <label className="field-group form-grid-span-two">
              <span>Descripcion</span>
              <textarea className="input textarea" value={form.description} onChange={(event) => update('description', event.target.value)} />
            </label>

            <label className="field-group form-grid-span-two">
              <span>Notas internas / origen</span>
              <textarea className="input textarea" value={form.originNotes} onChange={(event) => update('originNotes', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="section-card nested-card page-stack">
          <div>
            <p className="section-kicker">SEO e IA</p>
            <h2>Metadatos publicos</h2>
          </div>

          <div className="form-grid-two">
            <label className="field-group form-grid-span-two">
              <span>SEO title</span>
              <input className="input" value={form.seoTitle} onChange={(event) => update('seoTitle', event.target.value)} placeholder="Si queda vacio se genera automaticamente" />
            </label>

            <label className="field-group form-grid-span-two">
              <span>SEO description</span>
              <textarea className="input textarea" value={form.seoDescription} onChange={(event) => update('seoDescription', event.target.value)} placeholder="Resumen util para Google, Google Images y redes sociales" />
            </label>

            <label className="field-group form-grid-span-two">
              <span>Canonical URL</span>
              <input className="input" value={form.canonicalUrl} onChange={(event) => update('canonicalUrl', event.target.value)} placeholder="https://..." />
            </label>

            <label className="field-group form-grid-span-two">
              <span>Alt fallback para imagen principal</span>
              <input className="input" value={form.imageAltOverride} onChange={(event) => update('imageAltOverride', event.target.value)} placeholder="Texto alternativo por defecto si no se define por imagen" />
            </label>
          </div>
        </section>

        <section className="section-card nested-card page-stack">
          <div>
            <p className="section-kicker">Precios y stock</p>
            <h2>Venta y disponibilidad</h2>
          </div>

          <div className="form-grid-two">
            <label className="field-group">
              <span>Precio compra articulo</span>
              <input className="input" type="number" min="0" value={form.purchasePriceItem} onChange={(event) => update('purchasePriceItem', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Precio compra envio</span>
              <input className="input" type="number" min="0" value={form.purchasePriceShipping} onChange={(event) => update('purchasePriceShipping', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Precio compra courier</span>
              <input className="input" type="number" min="0" value={form.purchasePriceCourier} onChange={(event) => update('purchasePriceCourier', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Precio venta</span>
              <input className="input" type="number" min="0" value={form.salePrice} onChange={(event) => update('salePrice', event.target.value)} required />
            </label>

            <label className="field-group">
              <span>Descuento tipo</span>
              <select className="input" value={form.discountType} onChange={(event) => update('discountType', event.target.value)}>
                <option value="NONE">Sin descuento</option>
                <option value="PERCENT">Porcentaje</option>
                <option value="FIXED">Monto fijo</option>
              </select>
            </label>

            <label className="field-group">
              <span>Descuento valor</span>
              <input className="input" type="number" min="0" value={form.discountValue} onChange={(event) => update('discountValue', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Cantidad total</span>
              <input className="input" type="number" min="0" value={form.quantityTotal} onChange={(event) => update('quantityTotal', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Cantidad disponible</span>
              <input className="input" type="number" min="0" value={form.quantityAvailable} onChange={(event) => update('quantityAvailable', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Cantidad reservada</span>
              <input className="input" type="number" min="0" value={form.quantityReserved} onChange={(event) => update('quantityReserved', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Cantidad vendida</span>
              <input className="input" type="number" min="0" value={form.quantitySold} onChange={(event) => update('quantitySold', event.target.value)} />
            </label>

            <label className="field-group">
              <span>Estado</span>
              <select className="input" value={form.status} onChange={(event) => update('status', event.target.value)}>
                <option value="ACTIVE">ACTIVA</option>
                <option value="INACTIVE">INACTIVA</option>
                <option value="RESERVED">RESERVADA</option>
                <option value="SOLD_OUT">AGOTADA</option>
              </select>
            </label>

            <label className="field-group checkbox-field">
              <input type="checkbox" checked={form.isFeatured} onChange={(event) => update('isFeatured', event.target.checked)} />
              <span>Destacado</span>
            </label>

            <label className="field-group checkbox-field">
              <input
                type="checkbox"
                checked={form.allowOffers && !(form.discountType !== 'NONE' && Number(form.discountValue) > 0)}
                onChange={(event) => update('allowOffers', event.target.checked)}
                disabled={form.discountType !== 'NONE' && Number(form.discountValue) > 0}
              />
              <span>Permite ofertas</span>
            </label>
          </div>
        </section>

        <div className="inline-note">
          Costo de compra total estimado: <strong>{totalPurchasePrice}</strong>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
        {message ? <p className="success-copy">{message}</p> : null}

        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Guardando...' : isEdit ? 'Actualizar articulo' : 'Crear articulo'}
        </button>
      </form>
    </div>
  );
}
