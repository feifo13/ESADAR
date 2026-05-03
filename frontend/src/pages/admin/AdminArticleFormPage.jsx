import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import SmartImage from '../../components/SmartImage.jsx';
import { useLookups } from '../../contexts/LookupsContext.jsx';
import { apiFetch } from '../../lib/api.js';

const FORM_STEPS = [
  { key: 'main', label: 'Paso 1', title: 'Datos principales' },
  { key: 'commerce', label: 'Paso 2', title: 'Venta y disponibilidad' },
  { key: 'images', label: 'Paso 3', title: 'Imagenes' },
  { key: 'meta', label: 'Paso 4', title: 'Metadatos publicos' },
];

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

function normalizeLabel(value) {
  return String(value || '').trim();
}

function buildSlugPreview(form, labels) {
  const source = [
    form.title,
    labels.brandName,
    labels.categoryName,
    form.sizeText || labels.sizeName,
  ]
    .map((value) => normalizeLabel(value))
    .filter(Boolean)
    .join(' ');

  const normalized = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return normalized || 'articulo-esadar';
}

function buildMetaTitlePreview(form, labels) {
  if (normalizeLabel(form.seoTitle)) return form.seoTitle;

  const parts = [normalizeLabel(form.title)];
  if (labels.brandName) parts.push(labels.brandName);
  if (labels.categoryName) parts.push(labels.categoryName);
  if (form.sizeText || labels.sizeName) parts.push(form.sizeText || labels.sizeName);
  parts.push('ESADAR');
  return parts.filter(Boolean).join(' | ');
}

function buildMetaDescriptionPreview(form, labels) {
  if (normalizeLabel(form.seoDescription)) return form.seoDescription;

  const parts = [];
  if (normalizeLabel(form.description)) {
    parts.push(normalizeLabel(form.description));
  }
  if (labels.categoryName) parts.push(`Categoria ${labels.categoryName}.`);
  if (labels.brandName) parts.push(`Marca ${labels.brandName}.`);
  if (form.sizeText || labels.sizeName) parts.push(`Talle ${form.sizeText || labels.sizeName}.`);
  if (normalizeLabel(form.conditionLabel)) parts.push(`Estado ${form.conditionLabel}.`);
  if (normalizeLabel(form.color)) parts.push(`Color ${form.color}.`);
  if (!parts.length && normalizeLabel(form.title)) {
    parts.push(`${form.title} publicada en ESADAR.`);
  }

  return parts.join(' ').trim().slice(0, 500);
}

function getStepStatus(stepIndex, form, existingImagesCount, selectedImagesCount) {
  if (stepIndex === 0) {
    return normalizeLabel(form.title) ? 'listo' : 'faltan';
  }

  if (stepIndex === 1) {
    return form.salePrice !== '' && Number(form.salePrice) >= 0 ? 'listo' : 'faltan';
  }

  if (stepIndex === 2) {
    return existingImagesCount || selectedImagesCount ? 'listo' : 'opcional';
  }

  return 'opcional';
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
  const [activeStep, setActiveStep] = useState(0);
  const [metaAdvancedOpen, setMetaAdvancedOpen] = useState(false);
  const [commerceAdvancedOpen, setCommerceAdvancedOpen] = useState(false);

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

  const labels = useMemo(() => {
    const categoryName = categoryOptions.find((option) => Number(option.id) === Number(form.categoryId))?.label || '';
    const brandName = brandOptions.find((option) => Number(option.id) === Number(form.brandId))?.label || '';
    const sizeName = sizeOptions.find((option) => Number(option.id) === Number(form.sizeId))?.label || '';
    return { categoryName, brandName, sizeName };
  }, [brandOptions, categoryOptions, form.brandId, form.categoryId, form.sizeId, sizeOptions]);

  const totalPurchasePrice = useMemo(
    () => Number(form.purchasePriceItem || 0) + Number(form.purchasePriceShipping || 0) + Number(form.purchasePriceCourier || 0),
    [form.purchasePriceItem, form.purchasePriceShipping, form.purchasePriceCourier],
  );

  const suggestedSlug = useMemo(
    () => normalizeLabel(form.slug) || buildSlugPreview(form, labels),
    [form, labels],
  );

  const publicUrlPreview = useMemo(() => {
    if (normalizeLabel(form.canonicalUrl)) return form.canonicalUrl;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/articles/${suggestedSlug}`;
  }, [form.canonicalUrl, suggestedSlug]);

  const metaTitlePreview = useMemo(
    () => buildMetaTitlePreview(form, labels),
    [form, labels],
  );

  const metaDescriptionPreview = useMemo(
    () => buildMetaDescriptionPreview(form, labels),
    [form, labels],
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

  function validateStep(stepIndex) {
    if (stepIndex === 0 && !normalizeLabel(form.title)) {
      return 'El nombre es obligatorio para continuar.';
    }

    if (stepIndex === 1 && (form.salePrice === '' || Number(form.salePrice) < 0)) {
      return 'El precio de venta es obligatorio para continuar.';
    }

    return '';
  }

  function goToStep(stepIndex) {
    const validationMessage = validateStep(activeStep);
    if (stepIndex > activeStep && validationMessage) {
      setError(validationMessage);
      return;
    }

    setError('');
    setActiveStep(stepIndex);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validateStep(0) || validateStep(1);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const normalizedQuantityTotal = Number(form.quantityTotal || 0);
      const normalizedQuantityAvailable = form.quantityAvailable === ''
        ? normalizedQuantityTotal
        : Number(form.quantityAvailable);

      const payload = {
        ...form,
        internalCode: normalizeLabel(form.internalCode) || undefined,
        slug: normalizeLabel(form.slug) || suggestedSlug,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        brandId: form.brandId ? Number(form.brandId) : null,
        sizeId: form.sizeId ? Number(form.sizeId) : null,
        purchasePriceItem: Number(form.purchasePriceItem || 0),
        purchasePriceShipping: Number(form.purchasePriceShipping || 0),
        purchasePriceCourier: Number(form.purchasePriceCourier || 0),
        salePrice: Number(form.salePrice || 0),
        discountValue: Number(form.discountValue || 0),
        allowOffers: form.discountType !== 'NONE' && Number(form.discountValue || 0) > 0 ? false : Boolean(form.allowOffers),
        isFeatured: Boolean(form.isFeatured),
        quantityTotal: normalizedQuantityTotal,
        quantityAvailable: normalizedQuantityAvailable,
        quantityReserved: Number(form.quantityReserved || 0),
        quantitySold: Number(form.quantitySold || 0),
        sizeText: normalizeLabel(form.sizeText) || null,
        measurementsText: normalizeLabel(form.measurementsText) || null,
        description: normalizeLabel(form.description) || null,
        originNotes: normalizeLabel(form.originNotes) || null,
        seoTitle: normalizeLabel(form.seoTitle) || metaTitlePreview || null,
        seoDescription: normalizeLabel(form.seoDescription) || metaDescriptionPreview || null,
        canonicalUrl: normalizeLabel(form.canonicalUrl) || publicUrlPreview || null,
        googleProductCategory: normalizeLabel(form.googleProductCategory) || null,
        conditionLabel: normalizeLabel(form.conditionLabel) || null,
        color: normalizeLabel(form.color) || null,
        material: normalizeLabel(form.material) || null,
        gender: form.gender || null,
        ageGroup: form.ageGroup || null,
        imageAltOverride: normalizeLabel(form.imageAltOverride) || null,
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

  const currentStepStatus = FORM_STEPS.map((_, index) => (
    getStepStatus(index, form, existingImages.length, selectedPreviews.length)
  ));

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <form className="section-card page-stack" onSubmit={handleSubmit}>
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>{isEdit ? 'Editar articulo' : 'Nuevo articulo'}</h1>
            <p className="muted-copy">
              Alta individual guiada. Si prefieres cargar varios articulos juntos, usa la opcion visible en Articulos {'>'} Crear multiples articulos.
            </p>
          </div>
          <Link to="/admin/articles" className="ghost-button linklike">Volver</Link>
        </div>

        <div className="article-wizard-steps" aria-label="Pasos del formulario">
          {FORM_STEPS.map((step, index) => {
            const status = currentStepStatus[index];
            const isActive = activeStep === index;
            return (
              <button
                key={step.key}
                type="button"
                className={[
                  'article-wizard-step',
                  isActive ? 'is-active' : '',
                  status === 'listo' ? 'is-ready' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => goToStep(index)}
              >
                <span className="article-wizard-step__index">{index + 1}</span>
                <span className="article-wizard-step__copy">
                  <strong>{step.label}</strong>
                  <small>{step.title}</small>
                </span>
              </button>
            );
          })}
        </div>

        {activeStep === 0 ? (
          <section className="section-card nested-card page-stack">
            <div>
              <p className="section-kicker">Paso 1</p>
              <h2>Datos principales</h2>
              <p className="muted-copy">Completa solo lo humanamente necesario para identificar bien la prenda.</p>
            </div>

            <div className="form-grid-two">
              <label className="field-group">
                <span>Nombre</span>
                <input className="input" value={form.title} onChange={(event) => update('title', event.target.value)} required />
              </label>

              <label className="field-group">
                <span>Categoria / rubro</span>
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
                <span>Talle</span>
                <select className="input" value={form.sizeId} onChange={(event) => update('sizeId', event.target.value)}>
                  <option value="">Sin talle normalizado</option>
                  {sizeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>

              <label className="field-group">
                <span>Talle libre</span>
                <input className="input" value={form.sizeText} onChange={(event) => update('sizeText', event.target.value)} placeholder="Ej: Oversize / Unico" />
              </label>

              <label className="field-group">
                <span>Estado / condicion</span>
                <input className="input" value={form.conditionLabel} onChange={(event) => update('conditionLabel', event.target.value)} placeholder="Ej: Muy buen estado" />
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
                <span>Genero / publico</span>
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
                <span>Descripcion</span>
                <textarea className="input textarea" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe la prenda, fit, uso o detalles utiles para venta." />
              </label>

              <label className="field-group form-grid-span-two">
                <span>Medidas reales</span>
                <textarea className="input textarea" value={form.measurementsText} onChange={(event) => update('measurementsText', event.target.value)} placeholder="Ej: pecho 58 cm / largo 68 cm" />
              </label>
            </div>
          </section>
        ) : null}

        {activeStep === 1 ? (
          <section className="section-card nested-card page-stack">
            <div>
              <p className="section-kicker">Paso 2</p>
              <h2>Venta y disponibilidad</h2>
              <p className="muted-copy">Define precio, stock y condiciones comerciales sin exponerte a campos tecnicos innecesarios.</p>
            </div>

            <div className="form-grid-two">
              <label className="field-group">
                <span>Precio de venta</span>
                <input className="input" type="number" min="0" value={form.salePrice} onChange={(event) => update('salePrice', event.target.value)} required />
              </label>

              <label className="field-group">
                <span>Stock total</span>
                <input className="input" type="number" min="0" value={form.quantityTotal} onChange={(event) => update('quantityTotal', event.target.value)} />
              </label>

              <label className="field-group">
                <span>Stock disponible</span>
                <input className="input" type="number" min="0" value={form.quantityAvailable} onChange={(event) => update('quantityAvailable', event.target.value)} />
              </label>

              <label className="field-group">
                <span>Estado de publicacion</span>
                <select className="input" value={form.status} onChange={(event) => update('status', event.target.value)}>
                  <option value="ACTIVE">Activa</option>
                  <option value="INACTIVE">Inactiva</option>
                  <option value="RESERVED">Reservada</option>
                  <option value="SOLD_OUT">Agotada</option>
                </select>
              </label>

              <label className="field-group">
                <span>Descuento</span>
                <select className="input" value={form.discountType} onChange={(event) => update('discountType', event.target.value)}>
                  <option value="NONE">Sin descuento</option>
                  <option value="PERCENT">Porcentaje</option>
                  <option value="FIXED">Monto fijo</option>
                </select>
              </label>

              <label className="field-group">
                <span>Valor de descuento</span>
                <input className="input" type="number" min="0" value={form.discountValue} onChange={(event) => update('discountValue', event.target.value)} />
              </label>

              <label className="field-group checkbox-field field-group-span-two">
                <input
                  type="checkbox"
                  checked={form.allowOffers && !(form.discountType !== 'NONE' && Number(form.discountValue || 0) > 0)}
                  onChange={(event) => update('allowOffers', event.target.checked)}
                  disabled={form.discountType !== 'NONE' && Number(form.discountValue || 0) > 0}
                />
                <span>Acepta ofertas</span>
              </label>

              <label className="field-group checkbox-field field-group-span-two">
                <input type="checkbox" checked={form.isFeatured} onChange={(event) => update('isFeatured', event.target.checked)} />
                <span>Destacado en catalogo</span>
              </label>
            </div>

            <details className="bulk-advanced-panel" open={commerceAdvancedOpen} onToggle={(event) => setCommerceAdvancedOpen(event.currentTarget.open)}>
              <summary>Avanzado</summary>
              <p className="field-helper">Campos tecnicos generados automaticamente o usados para costos y estados internos.</p>
              <div className="form-grid-two">
                <label className="field-group">
                  <span>Fecha de ingreso</span>
                  <input className="input" type="date" value={form.intakeDate} onChange={(event) => update('intakeDate', event.target.value)} />
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
                <label className="field-group form-grid-span-two">
                  <span>Notas internas / origen</span>
                  <textarea className="input textarea" value={form.originNotes} onChange={(event) => update('originNotes', event.target.value)} />
                </label>
              </div>
              <div className="inline-note">
                Costo de compra total estimado: <strong>{totalPurchasePrice}</strong>
              </div>
            </details>
          </section>
        ) : null}

        {activeStep === 2 ? (
          <section className="section-card nested-card page-stack">
            <div>
              <p className="section-kicker">Paso 3</p>
              <h2>Imagenes</h2>
              <p className="muted-copy helper-note">
                Las previews se muestran chicas y ordenadas para que puedas revisar rapido cual es la principal, borrar o reordenar sin romper la vista.
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
              <div className="centered-card nested-card image-manager-empty">
                <p className="muted-copy">Todavia no hay imagenes cargadas para este articulo.</p>
              </div>
            )}

            <label className="field-group">
              <span>Agregar imagenes</span>
              <input className="input" type="file" multiple accept="image/*" onChange={(event) => setImages(event.target.files || [])} />
              <span className="field-helper">
                Si no subes imagenes ahora, el articulo igual puede crearse y luego completarse desde la edicion.
              </span>
            </label>
          </section>
        ) : null}

        {activeStep === 3 ? (
          <section className="section-card nested-card page-stack">
            <div>
              <p className="section-kicker">Paso 4</p>
              <h2>Metadatos publicos</h2>
              <p className="muted-copy">Slug, URL y metadatos se autocompletan. Solo editalos manualmente si realmente lo necesitas.</p>
            </div>

            <div className="article-meta-preview-grid">
              <label className="field-group">
                <span>Slug sugerido</span>
                <input className="input" value={suggestedSlug} readOnly />
              </label>
              <label className="field-group">
                <span>URL publica</span>
                <input className="input" value={publicUrlPreview} readOnly />
              </label>
              <label className="field-group field-group-span-2">
                <span>Meta title</span>
                <input className="input" value={metaTitlePreview} readOnly />
              </label>
              <label className="field-group field-group-span-2">
                <span>Meta description</span>
                <textarea className="input textarea article-meta-preview-textarea" value={metaDescriptionPreview} readOnly />
              </label>
            </div>

            <details className="bulk-advanced-panel" open={metaAdvancedOpen} onToggle={(event) => setMetaAdvancedOpen(event.currentTarget.open)}>
              <summary>Editar manualmente</summary>
              <p className="field-helper">Campos tecnicos generados automaticamente. Solo cambialos si ya sabes que necesitas otro valor.</p>
              <div className="form-grid-two">
                <label className="field-group">
                  <span>Codigo interno manual</span>
                  <input className="input" value={form.internalCode} onChange={(event) => update('internalCode', event.target.value)} placeholder="Opcional" />
                </label>
                <label className="field-group">
                  <span>Slug manual</span>
                  <input className="input" value={form.slug} onChange={(event) => update('slug', event.target.value)} placeholder={suggestedSlug} />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Canonical URL manual</span>
                  <input className="input" value={form.canonicalUrl} onChange={(event) => update('canonicalUrl', event.target.value)} placeholder={publicUrlPreview} />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Meta title manual</span>
                  <input className="input" value={form.seoTitle} onChange={(event) => update('seoTitle', event.target.value)} placeholder={metaTitlePreview} />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Meta description manual</span>
                  <textarea className="input textarea" value={form.seoDescription} onChange={(event) => update('seoDescription', event.target.value)} placeholder={metaDescriptionPreview} />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Google product category</span>
                  <input className="input" value={form.googleProductCategory} onChange={(event) => update('googleProductCategory', event.target.value)} placeholder="Apparel & Accessories > Clothing" />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Alt fallback para imagen principal</span>
                  <input className="input" value={form.imageAltOverride} onChange={(event) => update('imageAltOverride', event.target.value)} placeholder={`${
                    normalizeLabel(form.title) || 'Articulo ESADAR'
                  } - frente principal`} />
                </label>
              </div>
            </details>
          </section>
        ) : null}

        {error ? <p className="error-copy">{error}</p> : null}
        {message ? <p className="success-copy">{message}</p> : null}

        <div className="article-wizard-footer">
          <div className="inline-note">
            {activeStep === 0 ? 'Completa lo basico de la prenda.' : null}
            {activeStep === 1 ? 'Define precio, stock y estado comercial.' : null}
            {activeStep === 2 ? 'Sube imagenes y deja una primaria clara.' : null}
            {activeStep === 3 ? 'Revisa como se autogenerara la ficha publica.' : null}
          </div>

          <div className="inline-action-group">
            {activeStep > 0 ? (
              <button type="button" className="button button-secondary" onClick={() => setActiveStep((current) => Math.max(0, current - 1))}>
                Anterior
              </button>
            ) : null}

            {activeStep < FORM_STEPS.length - 1 ? (
              <button type="button" className="button button-primary" onClick={() => goToStep(activeStep + 1)}>
                Siguiente
              </button>
            ) : (
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear articulo'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
