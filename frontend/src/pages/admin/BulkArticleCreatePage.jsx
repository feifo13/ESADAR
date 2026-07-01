import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminToolbar from '../../components/admin/AdminToolbar.jsx';
import BulkArticleFormBlock from '../../components/admin/BulkArticleFormBlock.jsx';
import BulkArticleSubmitSummary from '../../components/admin/BulkArticleSubmitSummary.jsx';
import { IMAGE_ROLE_DEFINITIONS, createEmptyImageState } from '../../components/admin/BulkArticleImageChecklist.jsx';
import { useLookups } from '../../contexts/LookupsContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { apiFetch } from '../../lib/api.js';
import { getArticlePriceValidationIssue } from '../../lib/articleMargins.js';
import { focusFieldAfterRender } from '../../lib/validation.js';

function createEmptyArticle() {
  return {
    id: crypto.randomUUID(),
    expanded: true,
    title: '',
    salePrice: '',
    categoryName: '',
    brandName: '',
    sizeText: '',
    conditionLabel: '',
    color: '',
    material: '',
    quantityTotal: '1',
    allowOffers: false,
    isFeatured: false,
    description: '',
    measurementsText: '',
    purchasePriceItem: '',
    purchasePriceShipping: '',
    purchasePriceCourier: '',
    internalCode: '',
    seoTitle: '',
    seoDescription: '',
    images: createEmptyImageState(),
  };
}

function cloneArticle(article) {
  return {
    ...article,
    id: crypto.randomUUID(),
    expanded: true,
    title: article.title ? `${article.title}` : '',
    images: createEmptyImageState(),
  };
}

function buildPayload(article) {
  return {
    internalCode: article.internalCode || undefined,
    title: article.title,
    salePrice: Number(article.salePrice || 0),
    categoryName: article.categoryName || null,
    brandName: article.brandName || null,
    sizeText: article.sizeText || null,
    conditionLabel: article.conditionLabel || null,
    color: article.color || null,
    material: article.material || null,
    quantityTotal: Number(article.quantityTotal || 1),
    allowOffers: Boolean(article.allowOffers),
    isFeatured: Boolean(article.isFeatured),
    description: article.description || null,
    measurementsText: article.measurementsText || null,
    purchasePriceItem: Number(article.purchasePriceItem || 0),
    purchasePriceShipping: Number(article.purchasePriceShipping || 0),
    purchasePriceCourier: Number(article.purchasePriceCourier || 0),
    seoTitle: article.seoTitle || null,
    seoDescription: article.seoDescription || null,
  };
}

function getImageEntries(article) {
  return IMAGE_ROLE_DEFINITIONS
    .map((role) => ({
      role,
      ...article.images[role.key],
    }))
    .filter((entry) => entry.file);
}

async function uploadArticleImages(articleId, article) {
  const uploadedImageIds = [];

  for (const [index, entry] of getImageEntries(article).entries()) {
    const formData = new FormData();
    formData.append('images', entry.file);
    const response = await apiFetch(`/api/admin/articles/${articleId}/images`, {
      method: 'POST',
      body: formData,
    });
    const latestImage = (response.images || [])[response.images.length - 1];
    if (!latestImage?.id) continue;

    uploadedImageIds.push(latestImage.id);
    await apiFetch(`/api/admin/articles/${articleId}/images/${latestImage.id}`, {
      method: 'PATCH',
      body: {
        altText: entry.altText || `${article.title} - ${entry.role.label.toLowerCase()}`,
        sortOrder: index,
        isPrimary: Boolean(entry.isPrimary),
      },
    });
  }

  if (uploadedImageIds.length > 1) {
    await apiFetch(`/api/admin/articles/${articleId}/images/reorder`, {
      method: 'POST',
      body: {
        imageIds: uploadedImageIds,
      },
    });
  }
}

export default function BulkArticleCreatePage() {
  const navigate = useNavigate();
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();
  const { notifyError } = useNotification();
  const [articles, setArticles] = useState([createEmptyArticle()]);
  const [createMissingLookups, setCreateMissingLookups] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [costingSettings, setCostingSettings] = useState(null);
  const [lotOptions, setLotOptions] = useState([]);
  const [lotId, setLotId] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadLotOptions() {
      try {
        const response = await apiFetch('/api/admin/article-lots/options');
        if (ignore) return;
        const items = response.items || [];
        setLotOptions(items);
        const initialLot = items.find((option) => option.code === 'LOTE-0001') || items[0];
        if (initialLot?.id) setLotId(String(initialLot.id));
      } catch {
        if (!ignore) setLotOptions([]);
      }
    }

    loadLotOptions();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCostingSettings() {
      try {
        const response = await apiFetch('/api/admin/articles/costing-settings');
        if (!ignore) {
          setCostingSettings({
            bankTaxRate: response.bankTaxRate,
            bankTaxPercent: response.bankTaxPercent,
          });
        }
      } catch {
        if (!ignore) setCostingSettings(null);
      }
    }

    loadCostingSettings();
    return () => {
      ignore = true;
    };
  }, []);

  function updateArticle(articleId, field, value) {
    setArticles((current) => current.map((article) => (
      article.id === articleId ? { ...article, [field]: value } : article
    )));
  }

  function updateArticleImages(articleId, roleKey, nextValue, isWholeState = false) {
    setArticles((current) => current.map((article) => {
      if (article.id !== articleId) return article;
      return {
        ...article,
        images: isWholeState
          ? nextValue
          : {
            ...article.images,
            [roleKey]: nextValue,
          },
      };
    }));
  }

  function addAnotherArticle(fromArticle = null) {
    setArticles((current) => [...current, fromArticle ? cloneArticle(fromArticle) : createEmptyArticle()]);
  }

  function removeArticle(articleId) {
    setArticles((current) => (current.length === 1 ? current : current.filter((article) => article.id !== articleId)));
  }

  function validateArticlesForSubmit() {
    if (!lotId) {
      return {
        articleId: articles[0]?.id,
        target: 'bulk-common-lot',
        message: 'Selecciona un lote para la carga multiple.',
      };
    }

    for (const [index, article] of articles.entries()) {
      const rowLabel = `Articulo ${index + 1}`;

      if (!String(article.title || '').trim()) {
        return {
          articleId: article.id,
          target: `bulk-title-${article.id}`,
          message: `${rowLabel}: completa el titulo.`,
        };
      }

      const salePrice = Number(article.salePrice);
      if (String(article.salePrice || '').trim() === '' || !Number.isFinite(salePrice) || salePrice <= 0) {
        return {
          articleId: article.id,
          target: `bulk-sale-price-${article.id}`,
          message: `${rowLabel}: ingresa un precio de venta mayor a 0.`,
        };
      }

      const priceValidationIssue = getArticlePriceValidationIssue(article, {
        bankTaxRate: costingSettings?.bankTaxRate,
      });
      if (priceValidationIssue) {
        return {
          articleId: article.id,
          target: `bulk-sale-price-${article.id}`,
          message: `${rowLabel}: ${priceValidationIssue.message}`,
        };
      }

      const quantityTotal = Number(article.quantityTotal);
      if (String(article.quantityTotal || '').trim() === '' || !Number.isInteger(quantityTotal) || quantityTotal < 1) {
        return {
          articleId: article.id,
          target: `bulk-quantity-${article.id}`,
          message: `${rowLabel}: ingresa una cantidad mayor o igual a 1.`,
        };
      }
    }

    return null;
  }

  async function handleSubmitAll() {
    const validationIssue = validateArticlesForSubmit();
    if (validationIssue) {
      setArticles((current) => current.map((article) => (
        article.id === validationIssue.articleId
          ? { ...article, expanded: true }
          : article
      )));
      setError(validationIssue.message);
      notifyError(validationIssue.message);
      focusFieldAfterRender(validationIssue.target);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);

      const response = await apiFetch('/api/admin/articles/bulk', {
        method: 'POST',
        body: {
          createMissingLookups,
          lotId: Number(lotId),
          articles: articles.map(buildPayload),
        },
      });

      const uploadWarnings = [];
      for (const createdItem of response.created || []) {
        const article = articles[createdItem.rowNumber - 1];
        if (!article) continue;

        try {
          await uploadArticleImages(createdItem.articleId, article);
        } catch (err) {
          uploadWarnings.push(`Articulo ${createdItem.rowNumber}: las imagenes no se pudieron subir por completo.`);
        }
      }

      setResult({
        ...response,
        warnings: [...(response.warnings || []), ...uploadWarnings],
        summary: {
          ...response.summary,
          warnings: Number(response.summary?.warnings || 0) + uploadWarnings.length,
        },
      });
    } catch (err) {
      const errorMessage = err.message || 'No se pudieron crear los artículos.';
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Crear múltiples artículos</h1>
            <p className="muted-copy">Para carga rapida solo necesitas titulo y precio. El resto se completa con valores seguros.</p>
          </div>
          <div className="inline-action-group">
            <button type="button" className="button button-secondary" onClick={() => navigate('/admin/articles')}>
              Volver
            </button>
            <button type="button" className="button button-secondary" onClick={() => addAnotherArticle()}>
              Agregar otro artículo
            </button>
            <button type="button" className="button button-primary" onClick={() => void handleSubmitAll()} disabled={loading}>
              {loading ? 'Subiendo...' : 'Subir todos'}
            </button>
          </div>
        </div>

        <label className="checkbox-field">
          <input type="checkbox" checked={createMissingLookups} onChange={(event) => setCreateMissingLookups(event.target.checked)} />
          <span>Crear categorías, marcas y talles faltantes</span>
        </label>

        <label className="field-group">
          <span>Lote comun</span>
          <select
            className="input"
            name="bulk-common-lot"
            data-validation-field="bulk-common-lot"
            value={lotId}
            onChange={(event) => setLotId(event.target.value)}
            required
          >
            <option value="">Seleccionar lote</option>
            {lotOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.code} - {option.name}
              </option>
            ))}
          </select>
        </label>

      </section>

      {articles.map((article, index) => (
        <BulkArticleFormBlock
          key={article.id}
          index={index}
          article={article}
          categoryOptions={categoryOptions}
          brandOptions={brandOptions}
          sizeOptions={sizeOptions}
          onChange={(field, value) => updateArticle(article.id, field, value)}
          onImageChange={(roleKey, nextValue, isWholeState) => updateArticleImages(article.id, roleKey, nextValue, isWholeState)}
          costingSettings={costingSettings}
          onToggleExpand={() => updateArticle(article.id, 'expanded', !article.expanded)}
          onDuplicate={() => addAnotherArticle(article)}
          onRemove={() => removeArticle(article.id)}
        />
      ))}

      <section className="section-card page-stack">
        <div className="inline-action-group">
          <button type="button" className="button button-secondary" onClick={() => addAnotherArticle()}>
            Agregar otro artículo
          </button>
          <button type="button" className="button button-primary" onClick={() => void handleSubmitAll()} disabled={loading}>
            {loading ? 'Subiendo...' : 'Subir todos'}
          </button>
        </div>
      </section>

      <BulkArticleSubmitSummary result={result} />
    </div>
  );
}
