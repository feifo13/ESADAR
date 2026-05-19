import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import PreviousNextControls from "../../components/PreviousNextControls.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import BulkArticleImageChecklist, {
  createEmptyImageState,
  IMAGE_ROLE_DEFINITIONS,
} from "../../components/admin/BulkArticleImageChecklist.jsx";
import { useLookups } from "../../contexts/LookupsContext.jsx";
import { useSiteSeo } from "../../contexts/SiteSeoContext.jsx";
import { apiFetch } from "../../lib/api.js";
import { getSiteUrl, sanitizePublicUrl } from "../../lib/seo.js";
import { useMobileMenu } from "../../contexts/MobileMenuContext.jsx";
import { focusFieldAfterRender, notifyFormStatus } from "../../lib/validation.js";
import AppLoader from "../../components/AppLoader.jsx";

const FORM_STEPS = [
  { key: "main", label: "Paso 1", title: "Datos principales" },
  { key: "commerce", label: "Paso 2", title: "Venta y stock" },
  { key: "images", label: "Paso 3", title: "Imagenes" },
  { key: "meta", label: "Paso 4", title: "Metadatos publicos" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Sin definir" },
  { value: "UNISEX", label: "Unisex" },
  { value: "HOMBRE", label: "Hombre" },
  { value: "MUJER", label: "Mujer" },
  { value: "NIÑO", label: "Nino" },
  { value: "NIÑA", label: "Nina" },
  { value: "OTRO", label: "Otro" },
];

const AGE_GROUP_OPTIONS = [
  { value: "", label: "Sin definir" },
  { value: "ADULT", label: "Adulto" },
  { value: "KIDS", label: "Kids" },
  { value: "TODDLER", label: "Toddler" },
  { value: "INFANT", label: "Infant" },
  { value: "NEWBORN", label: "Newborn" },
];

const NEW_LOOKUP_VALUE = "__CREATE_NEW__";

const CONDITION_LABEL_OPTIONS = [
  "Nuevo",
  "Excelente",
  "Muy Bueno",
  "Bueno",
  "Con detalles",
];


const STOCK_ADJUSTMENT_REASONS = [
  "Ingreso inicial",
  "Reposicion",
  "Correccion de inventario",
  "Dano / baja",
  "Perdida",
  "Devolucion",
  "Ajuste administrativo",
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
    internalCode: article?.internalCode || "",
    slug: article?.slug || "",
    title: article?.title || "",
    seoTitle: article?.seoTitle || "",
    seoDescription: article?.seoDescription || "",
    canonicalUrl: article?.canonicalUrl || "",
    googleProductCategory: article?.googleProductCategory || "",
    conditionLabel: article?.conditionLabel || "",
    color: article?.color || "",
    material: article?.material || "",
    gender: article?.gender || "",
    ageGroup: article?.ageGroup || "",
    imageAltOverride: article?.imageAltOverride || "",
    categoryId: article?.categoryId || "",
    categoryName: article?.categoryName || "",
    brandId: article?.brandId || "",
    brandName: article?.brandName || "",
    sizeId: article?.sizeId || "",
    sizeCode: article?.sizeCode || "",
    sizeText: article?.sizeText || "",
    measurementsText: article?.measurementsText || "",
    description: article?.description || "",
    weightKg: article?.weightKg ?? 0,
    purchasePriceItem: article?.purchasePriceItem ?? 0,
    purchasePriceShipping: article?.purchasePriceShipping ?? 0,
    purchasePriceCourier: article?.purchasePriceCourier ?? 0,
    salePrice: article?.salePrice ?? 0,
    discountType: article?.discountType || "NONE",
    discountValue: article?.discountValue ?? 0,
    allowOffers: Boolean(article?.allowOffers),
    isFeatured: Boolean(article?.isFeatured),
    intakeDate: article?.intakeDate
      ? String(article.intakeDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    quantityTotal: article?.quantityTotal ?? 1,
    quantityAvailable: article?.quantityAvailable ?? 1,
    quantityReserved: article?.quantityReserved ?? 0,
    quantitySold: article?.quantitySold ?? 0,
    stockAdjustmentReason: "Ajuste administrativo",
    status: article?.status || "ACTIVE",
    originNotes: article?.originNotes || "",
  };
}

function normalizeLabel(value) {
  return String(value || "").trim();
}

function isCreateNewLookup(value) {
  return value === NEW_LOOKUP_VALUE;
}

function getSelectedLookupLabel(options, selectedId, typedLabel) {
  if (isCreateNewLookup(selectedId)) return normalizeLabel(typedLabel);

  return (
    options.find((option) => Number(option.id) === Number(selectedId))?.label ||
    normalizeLabel(typedLabel) ||
    ""
  );
}

function hasSelectedLookupOption(options, selectedId) {
  return options.some((option) => Number(option.id) === Number(selectedId));
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
    .join(" ");

  const normalized = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return normalized || "articulo-esadar";
}

function buildMetaTitlePreview(form, labels) {
  if (normalizeLabel(form.seoTitle)) return form.seoTitle;

  const parts = [normalizeLabel(form.title)];
  if (labels.brandName) parts.push(labels.brandName);
  if (labels.categoryName) parts.push(labels.categoryName);
  if (form.sizeText || labels.sizeName)
    parts.push(form.sizeText || labels.sizeName);
  parts.push("ESADAR");
  return parts.filter(Boolean).join(" | ");
}

function buildMetaDescriptionPreview(form, labels) {
  if (normalizeLabel(form.seoDescription)) return form.seoDescription;

  const parts = [];
  if (normalizeLabel(form.description)) {
    parts.push(normalizeLabel(form.description));
  }
  if (labels.categoryName) parts.push(`Categoría ${labels.categoryName}.`);
  if (labels.brandName) parts.push(`Marca ${labels.brandName}.`);
  if (form.sizeText || labels.sizeName)
    parts.push(`Talle ${form.sizeText || labels.sizeName}.`);
  if (normalizeLabel(form.conditionLabel))
    parts.push(`Estado ${form.conditionLabel}.`);
  if (normalizeLabel(form.color)) parts.push(`Color ${form.color}.`);
  if (!parts.length && normalizeLabel(form.title)) {
    parts.push(`${form.title} publicada en ESADAR.`);
  }

  return parts.join(" ").trim().slice(0, 500);
}

function getStepStatus(
  stepIndex,
  form,
  existingImagesCount,
  selectedImagesCount,
) {
  if (stepIndex === 0) {
    return normalizeLabel(form.title) ? "listo" : "faltan";
  }

  if (stepIndex === 1) {
    return form.salePrice !== "" && Number(form.salePrice) >= 0
      ? "listo"
      : "faltan";
  }

  if (stepIndex === 2) {
    return existingImagesCount || selectedImagesCount ? "listo" : "opcional";
  }

  return "opcional";
}

export default function AdminArticleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { categoryOptions, brandOptions, sizeOptions } = useLookups();
  const { site } = useSiteSeo();
  const { notifyMobileStatus } = useMobileMenu();
  const articleFormRef = useRef(null);
  const articleStepContentRef = useRef(null);
  const [form, setForm] = useState(toFormState(null));
  const [imageChecklist, setImageChecklist] = useState(() =>
    createEmptyImageState(),
  );
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [imageActionId, setImageActionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [metaAdvancedOpen, setMetaAdvancedOpen] = useState(false);

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
        if (!ignore) setError(err.message || "No se pudo cargar el articulo");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadArticle();
    return () => {
      ignore = true;
    };
  }, [id]);

  const selectedImageUploads = useMemo(
    () =>
      IMAGE_ROLE_DEFINITIONS.map((role) => ({
        role,
        value: imageChecklist[role.key],
      })).filter((item) => Boolean(item.value?.file)),
    [imageChecklist],
  );

  const hasConditionWarning = useMemo(
    () =>
      /detalle|mancha|marca|fall|rot|desgast|condicion|estado/i.test(
        `${form.conditionLabel || ""} ${form.originNotes || ""}`,
      ),
    [form.conditionLabel, form.originNotes],
  );

  const labels = useMemo(() => {
    const categoryName = getSelectedLookupLabel(
      categoryOptions,
      form.categoryId,
      form.categoryName,
    );
    const brandName = getSelectedLookupLabel(
      brandOptions,
      form.brandId,
      form.brandName,
    );
    const sizeName = getSelectedLookupLabel(
      sizeOptions,
      form.sizeId,
      form.sizeCode,
    );
    return { categoryName, brandName, sizeName };
  }, [
    brandOptions,
    categoryOptions,
    form.brandId,
    form.brandName,
    form.categoryId,
    form.categoryName,
    form.sizeCode,
    form.sizeId,
    sizeOptions,
  ]);

  const totalPurchasePrice = useMemo(
    () =>
      Number(form.purchasePriceItem || 0) +
      Number(form.purchasePriceShipping || 0) +
      Number(form.purchasePriceCourier || 0),
    [
      form.purchasePriceItem,
      form.purchasePriceShipping,
      form.purchasePriceCourier,
    ],
  );

  const suggestedSlug = useMemo(
    () => normalizeLabel(form.slug) || buildSlugPreview(form, labels),
    [form, labels],
  );

  const publicUrlPreview = useMemo(() => {
    const manualCanonicalUrl = sanitizePublicUrl(normalizeLabel(form.canonicalUrl));
    if (manualCanonicalUrl) return manualCanonicalUrl;
    const baseUrl = getSiteUrl(site);
    if (!baseUrl || !suggestedSlug) return "";
    return `${baseUrl}/articles/${suggestedSlug}`;
  }, [form.canonicalUrl, site, suggestedSlug]);

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
    setExistingImages((current) =>
      current.map((image) =>
        Number(image.id) === Number(imageId)
          ? { ...image, [name]: value }
          : image,
      ),
    );
  }

  function handleImageChecklistChange(roleKey, value, replaceAll = false) {
    if (replaceAll) {
      setImageChecklist(value);
      return;
    }

    setImageChecklist((current) => ({
      ...current,
      [roleKey]: value,
    }));
  }

  async function refreshArticle(articleId) {
    const response = await apiFetch(`/api/admin/articles/${articleId}`);
    setForm(toFormState(response.article));
    setExistingImages(sortImages(response.article.images || []));
  }

  function validateStep(stepIndex) {
    if (stepIndex === 0 && !normalizeLabel(form.title)) {
      return {
        message: "El nombre es obligatorio para continuar.",
        target: "article-title",
        stepIndex,
      };
    }

    if (stepIndex === 0 && isCreateNewLookup(form.categoryId) && !normalizeLabel(form.categoryName)) {
      return {
        message: "Ingresá el nombre de la nueva categoría.",
        target: "article-category-name",
        stepIndex,
      };
    }

    if (stepIndex === 0 && isCreateNewLookup(form.brandId) && !normalizeLabel(form.brandName)) {
      return {
        message: "Ingresa el nombre de la nueva marca.",
        target: "article-brand-name",
        stepIndex,
      };
    }

    if (stepIndex === 0 && isCreateNewLookup(form.sizeId) && !normalizeLabel(form.sizeCode)) {
      return {
        message: "Ingresa el nombre del nuevo talle.",
        target: "article-size-code",
        stepIndex,
      };
    }

    if (
      stepIndex === 1 &&
      (form.salePrice === "" || Number(form.salePrice) < 0)
    ) {
      return {
        message: "El precio de venta es obligatorio para continuar.",
        target: "article-sale-price",
        stepIndex,
      };
    }

    if (stepIndex === 1 && Number(form.quantityAvailable || 0) < 0) {
      return {
        message: "El stock disponible no puede ser negativo.",
        target: "article-quantity-available",
        stepIndex,
      };
    }

    if (stepIndex === 1 && Number(form.quantityTotal || 0) < 0) {
      return {
        message: "El stock total no puede ser negativo.",
        target: "article-quantity-total",
        stepIndex,
      };
    }

    if (
      stepIndex === 1 &&
      form.status === "ACTIVE" &&
      Number(form.quantityAvailable || 0) <= 0
    ) {
      return {
        message: "No se puede publicar como activo un articulo sin stock disponible.",
        target: "article-quantity-available",
        stepIndex,
      };
    }

    return null;
  }

  function scrollArticleWizardTop({ behavior = "smooth" } = {}) {
    if (typeof window === "undefined") return;
    const target = articleStepContentRef.current || articleFormRef.current;
    if (!target) return;

    const header = document.querySelector(".site-header");
    const headerHeight = Number(header?.offsetHeight || 0);
    const offset = headerHeight > 0 ? headerHeight + 18 : 86;
    const targetTop = Math.max(
      0,
      target.getBoundingClientRect().top + window.scrollY - offset,
    );

    window.scrollTo({ top: targetTop, behavior });
    target.focus?.({ preventScroll: true });
  }

  function scheduleArticleWizardScroll(options = {}) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollArticleWizardTop(options));
    });
  }

  function goToStep(stepIndex) {
    const validationIssue = validateStep(activeStep);
    if (stepIndex > activeStep && validationIssue) {
      setError(validationIssue.message);
      notifyFormStatus(notifyMobileStatus, "error", validationIssue.message, {
        target: validationIssue.target,
      });
      return;
    }

    setError("");
    setActiveStep(stepIndex);
    if (stepIndex !== activeStep) scheduleArticleWizardScroll();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationIssue = validateStep(0) || validateStep(1);
    if (validationIssue) {
      setError(validationIssue.message);
      setActiveStep(validationIssue.stepIndex);
      notifyFormStatus(notifyMobileStatus, "error", validationIssue.message);
      focusFieldAfterRender(validationIssue.target, event.currentTarget);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const normalizedQuantityTotal = Number(form.quantityTotal || 0);
      const normalizedQuantityAvailable =
        form.quantityAvailable === ""
          ? normalizedQuantityTotal
          : Number(form.quantityAvailable);

      const payload = {
        ...form,
        internalCode: normalizeLabel(form.internalCode) || undefined,
        slug: normalizeLabel(form.slug) || suggestedSlug,
        categoryId:
          form.categoryId && !isCreateNewLookup(form.categoryId)
            ? Number(form.categoryId)
            : null,
        categoryName: isCreateNewLookup(form.categoryId)
          ? normalizeLabel(form.categoryName)
          : null,
        brandId:
          form.brandId && !isCreateNewLookup(form.brandId)
            ? Number(form.brandId)
            : null,
        brandName: isCreateNewLookup(form.brandId)
          ? normalizeLabel(form.brandName)
          : null,
        sizeId:
          form.sizeId && !isCreateNewLookup(form.sizeId)
            ? Number(form.sizeId)
            : null,
        sizeCode: isCreateNewLookup(form.sizeId)
          ? normalizeLabel(form.sizeCode)
          : null,
        weightKg: Number(form.weightKg || 0),
        purchasePriceItem: Number(form.purchasePriceItem || 0),
        purchasePriceShipping: Number(form.purchasePriceShipping || 0),
        purchasePriceCourier: Number(form.purchasePriceCourier || 0),
        salePrice: Number(form.salePrice || 0),
        discountValue: Number(form.discountValue || 0),
        allowOffers:
          form.discountType !== "NONE" && Number(form.discountValue || 0) > 0
            ? false
            : Boolean(form.allowOffers),
        isFeatured: Boolean(form.isFeatured),
        quantityTotal: normalizedQuantityTotal,
        quantityAvailable: normalizedQuantityAvailable,
        stockAdjustmentReason: isEdit
          ? normalizeLabel(form.stockAdjustmentReason) || "Ajuste administrativo"
          : undefined,
        sizeText: normalizeLabel(form.sizeText) || null,
        measurementsText: normalizeLabel(form.measurementsText) || null,
        description: normalizeLabel(form.description) || null,
        originNotes: normalizeLabel(form.originNotes) || null,
        seoTitle: normalizeLabel(form.seoTitle) || metaTitlePreview || null,
        seoDescription:
          normalizeLabel(form.seoDescription) || metaDescriptionPreview || null,
        canonicalUrl:
          sanitizePublicUrl(normalizeLabel(form.canonicalUrl)) ||
          publicUrlPreview ||
          null,
        googleProductCategory:
          normalizeLabel(form.googleProductCategory) || null,
        conditionLabel: normalizeLabel(form.conditionLabel) || null,
        color: normalizeLabel(form.color) || null,
        material: normalizeLabel(form.material) || null,
        gender: form.gender || null,
        ageGroup: form.ageGroup || null,
        imageAltOverride: normalizeLabel(form.imageAltOverride) || null,
      };

      const response = await apiFetch(
        isEdit ? `/api/admin/articles/${id}` : "/api/admin/articles",
        {
          method: isEdit ? "PUT" : "POST",
          body: payload,
        },
      );

      const articleId = response.article.id;

      if (selectedImageUploads.length) {
        const previousImagesCount = existingImages.length;
        const formData = new FormData();
        selectedImageUploads.forEach(({ value }) =>
          formData.append("images", value.file),
        );
        const imageResponse = await apiFetch(
          `/api/admin/articles/${articleId}/images`,
          { method: "POST", body: formData },
        );
        const uploadedImages = sortImages(imageResponse.images || []).slice(
          previousImagesCount,
        );

        const pendingPrimaryPatch = [];
        for (const [index, uploadedImage] of uploadedImages.entries()) {
          const upload = selectedImageUploads[index];
          if (!upload) continue;

          const patchPayload = {
            altText:
              normalizeLabel(upload.value.altText) ||
              `${payload.title} - ${upload.role.label.toLowerCase()}`,
            sortOrder: previousImagesCount + index,
          };

          const shouldMarkPrimary =
            upload.value.isPrimary ||
            (selectedImageUploads.length === 1 && previousImagesCount === 0);

          if (shouldMarkPrimary) {
            pendingPrimaryPatch.push({ uploadedImage, patchPayload });
          } else {
            await apiFetch(
              `/api/admin/articles/${articleId}/images/${uploadedImage.id}`,
              {
                method: "PATCH",
                body: patchPayload,
              },
            );
          }
        }

        for (const { uploadedImage, patchPayload } of pendingPrimaryPatch) {
          await apiFetch(
            `/api/admin/articles/${articleId}/images/${uploadedImage.id}`,
            {
              method: "PATCH",
              body: { ...patchPayload, isPrimary: true },
            },
          );
        }

        setImageChecklist(createEmptyImageState());
      }

      await refreshArticle(articleId);
      const successMessage = isEdit
        ? "Articulo actualizado correctamente."
        : "Articulo creado correctamente.";
      setMessage(successMessage);
      notifyFormStatus(notifyMobileStatus, "success", successMessage);

      if (!isEdit) {
        navigate(`/admin/articles/${articleId}/edit`, { replace: true });
      }
    } catch (err) {
      const errorMessage = err.message || "No se pudo guardar el articulo";
      setError(errorMessage);
      notifyFormStatus(notifyMobileStatus, "error", errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function saveImageDraft(imageId) {
    const image = existingImages.find(
      (item) => Number(item.id) === Number(imageId),
    );
    if (!image) return;

    try {
      setImageActionId(`save-${imageId}`);
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/articles/${id}/images/${imageId}`,
        {
          method: "PATCH",
          body: {
            altText: image.altText || null,
            sortOrder: Number(image.sortOrder || 0),
            isPrimary: Boolean(image.isPrimary),
          },
        },
      );
      setExistingImages(sortImages(response.images || []));
      setMessage("Los datos de la imagen fueron actualizados.");
      notifyFormStatus(
        notifyMobileStatus,
        "success",
        "Los datos de la imagen fueron actualizados.",
      );
    } catch (err) {
      {
        const errorMessage = err.message || "No se pudo actualizar la imagen";
        setError(errorMessage);
        notifyFormStatus(notifyMobileStatus, "error", errorMessage);
      }
    } finally {
      setImageActionId("");
    }
  }

  async function markImageAsPrimary(imageId) {
    try {
      setImageActionId(`primary-${imageId}`);
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/articles/${id}/images/${imageId}`,
        {
          method: "PATCH",
          body: { isPrimary: true },
        },
      );
      setExistingImages(sortImages(response.images || []));
      setMessage("La imagen primaria fue actualizada.");
      notifyFormStatus(
        notifyMobileStatus,
        "success",
        "La imagen primaria fue actualizada.",
      );
    } catch (err) {
      {
        const errorMessage =
          err.message || "No se pudo marcar la imagen primaria";
        setError(errorMessage);
        notifyFormStatus(notifyMobileStatus, "error", errorMessage);
      }
    } finally {
      setImageActionId("");
    }
  }

  async function deleteImage(imageId) {
    try {
      setImageActionId(`delete-${imageId}`);
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/articles/${id}/images/${imageId}`,
        {
          method: "DELETE",
        },
      );
      setExistingImages(sortImages(response.images || []));
      setMessage("La imagen fue eliminada.");
      notifyFormStatus(
        notifyMobileStatus,
        "success",
        "La imagen fue eliminada.",
      );
    } catch (err) {
      {
        const errorMessage = err.message || "No se pudo eliminar la imagen";
        setError(errorMessage);
        notifyFormStatus(notifyMobileStatus, "error", errorMessage);
      }
    } finally {
      setImageActionId("");
    }
  }

  async function moveImage(imageId, direction) {
    const sorted = sortImages(existingImages);
    const currentIndex = sorted.findIndex(
      (image) => Number(image.id) === Number(imageId),
    );
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sorted.length) {
      return;
    }

    const reordered = [...sorted];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    try {
      setImageActionId(`move-${imageId}`);
      setError("");
      setMessage("");
      const response = await apiFetch(
        `/api/admin/articles/${id}/images/reorder`,
        {
          method: "POST",
          body: { imageIds: reordered.map((image) => image.id) },
        },
      );
      setExistingImages(sortImages(response.images || []));
      setMessage("El orden de las imagenes fue actualizado.");
      notifyFormStatus(
        notifyMobileStatus,
        "success",
        "El orden de las imagenes fue actualizado.",
      );
    } catch (err) {
      {
        const errorMessage = err.message || "No se pudo reordenar la imagen";
        setError(errorMessage);
        notifyFormStatus(notifyMobileStatus, "error", errorMessage);
      }
    } finally {
      setImageActionId("");
    }
  }

  if (loading) {
    return (
      <div className="container section-card centered-card">
        <AppLoader variant="card" label="Cargando artículo" />
      </div>
    );
  }

  const currentStepStatus = FORM_STEPS.map((_, index) =>
    getStepStatus(
      index,
      form,
      existingImages.length,
      selectedImageUploads.length,
    ),
  );

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <form
        ref={articleFormRef}
        className="section-card page-stack"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
              <h1>{isEdit ? "Editar artículo" : "Nuevo artículo"}</h1>

            {/* <p className="muted-copy">
              Alta individual guiada. Si prefieres cargar varios artículos
              juntos, usa la opción visible en Artículos {">"} Crear múltiples
              articulos.
            </p> */}
          </div>
          <Link to="/admin/articles" className="ghost-button linklike">
            Volver
          </Link>
        </div>

        {/* <div className="article-wizard-steps" aria-label="Pasos del formulario">
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
        </div> */}

        <div
          ref={articleStepContentRef}
          className="article-wizard-step-content-anchor"
          tabIndex={-1}
        >
        {activeStep === 0 ? (
          <section className="section-card nested-card page-stack">
            <div>
              <p className="section-kicker">Paso 1</p>
              <h2>Datos principales</h2>
            </div>

            <div className="form-grid-two">
              <label className="field-group">
                <span>Nombre</span>
                <input
                  className="input"
                  name="article-title"
                  data-validation-field="article-title"
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  required
                />
              </label>

              <label className="field-group field-group--quick-lookup">
                <span>Categoría / rubro</span>
                <select
                  className="input"
                  value={form.categoryId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setForm((current) => ({
                      ...current,
                      categoryId: nextValue,
                      categoryName: isCreateNewLookup(nextValue) ? current.categoryName : "",
                    }));
                  }}
                >
                  <option value="">Sin categoría / default</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                  {form.categoryId &&
                  !isCreateNewLookup(form.categoryId) &&
                  !hasSelectedLookupOption(categoryOptions, form.categoryId) &&
                  form.categoryName ? (
                    <option value={form.categoryId}>{form.categoryName}</option>
                  ) : null}
                  <option value={NEW_LOOKUP_VALUE}>Crear nueva categoría...</option>
                </select>
              </label>

              {isCreateNewLookup(form.categoryId) ? (
                <label className="field-group field-group--quick-lookup field-group--quick-lookup-new">
                  <span>Nueva categoría / rubro</span>
                  <input
                    className="input"
                    name="article-category-name"
                    data-validation-field="article-category-name"
                    value={form.categoryName}
                    onChange={(event) => update("categoryName", event.target.value)}
                    placeholder="Ej: Camperas vintage"
                  />
                </label>
              ) : null}

              <label className="field-group field-group--quick-lookup">
                <span>Marca</span>
                <select
                  className="input"
                  value={form.brandId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setForm((current) => ({
                      ...current,
                      brandId: nextValue,
                      brandName: isCreateNewLookup(nextValue) ? current.brandName : "",
                    }));
                  }}
                >
                  <option value="">Sin marca</option>
                  {brandOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                  {form.brandId &&
                  !isCreateNewLookup(form.brandId) &&
                  !hasSelectedLookupOption(brandOptions, form.brandId) &&
                  form.brandName ? (
                    <option value={form.brandId}>{form.brandName}</option>
                  ) : null}
                  <option value={NEW_LOOKUP_VALUE}>Crear nueva marca...</option>
                </select>
              </label>

              {isCreateNewLookup(form.brandId) ? (
                <label className="field-group field-group--quick-lookup field-group--quick-lookup-new">
                  <span>Nueva marca</span>
                  <input
                    className="input"
                    name="article-brand-name"
                    data-validation-field="article-brand-name"
                    value={form.brandName}
                    onChange={(event) => update("brandName", event.target.value)}
                    placeholder="Ej: Starter"
                  />
                </label>
              ) : null}

              <label className="field-group field-group--quick-lookup">
                <span>Talle</span>
                <select
                  className="input"
                  value={form.sizeId}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setForm((current) => ({
                      ...current,
                      sizeId: nextValue,
                      sizeCode: isCreateNewLookup(nextValue) ? current.sizeCode : "",
                    }));
                  }}
                >
                  <option value="">Sin talle normalizado</option>
                  {sizeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                  {form.sizeId &&
                  !isCreateNewLookup(form.sizeId) &&
                  !hasSelectedLookupOption(sizeOptions, form.sizeId) &&
                  form.sizeCode ? (
                    <option value={form.sizeId}>{form.sizeCode}</option>
                  ) : null}
                  <option value={NEW_LOOKUP_VALUE}>Crear nuevo talle...</option>
                </select>
              </label>

              {isCreateNewLookup(form.sizeId) ? (
                <label className="field-group field-group--quick-lookup field-group--quick-lookup-new">
                  <span>Nuevo talle</span>
                  <input
                    className="input"
                    name="article-size-code"
                    data-validation-field="article-size-code"
                    value={form.sizeCode}
                    onChange={(event) => update("sizeCode", event.target.value)}
                    placeholder="Ej: XXL"
                  />
                </label>
              ) : null}

              <label className="field-group">
                <span>Talle libre</span>
                <input
                  className="input"
                  value={form.sizeText}
                  onChange={(event) => update("sizeText", event.target.value)}
                  placeholder="Ej: Oversize / Unico"
                />
              </label>

              <label className="field-group">
                <span>Estado / condicion</span>
                <select
                  className="input"
                  value={form.conditionLabel}
                  onChange={(event) =>
                    update("conditionLabel", event.target.value)
                  }
                >
                  <option value="">Sin definir</option>
                  {CONDITION_LABEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {form.conditionLabel &&
                  !CONDITION_LABEL_OPTIONS.includes(form.conditionLabel) ? (
                    <option value={form.conditionLabel}>{form.conditionLabel}</option>
                  ) : null}
                </select>
              </label>

              <label className="field-group">
                <span>Color</span>
                <input
                  className="input"
                  value={form.color}
                  onChange={(event) => update("color", event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>Material</span>
                <input
                  className="input"
                  value={form.material}
                  onChange={(event) => update("material", event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>Genero / publico</span>
                <select
                  className="input"
                  value={form.gender}
                  onChange={(event) => update("gender", event.target.value)}
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>Grupo de edad</span>
                <select
                  className="input"
                  value={form.ageGroup}
                  onChange={(event) => update("ageGroup", event.target.value)}
                >
                  {AGE_GROUP_OPTIONS.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group form-grid-span-two">
                <span>Descripción</span>
                <textarea
                  className="input textarea"
                  value={form.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  placeholder="Describe la prenda, fit, uso o detalles utiles para venta."
                />
              </label>

              <label className="field-group form-grid-span-two">
                <span>Medidas reales</span>
                <textarea
                  className="input textarea"
                  value={form.measurementsText}
                  onChange={(event) =>
                    update("measurementsText", event.target.value)
                  }
                  placeholder="Ej: pecho 58 cm / largo 68 cm"
                />
              </label>
            </div>
          </section>
        ) : null}

        {activeStep === 1 ? (
          <section className="section-card nested-card page-stack">
            <div>
              <p className="section-kicker">Paso 2</p>
              <h2>Venta y stock</h2>
              <p className="muted-copy">
                Disponible puede ajustarse manualmente, pero Reservado y Vendido se actualizan automáticamente según órdenes.
              </p>
            </div>

            <div className="form-grid-two article-sale-stock-grid">
              <label className="field-group admin-field-important">
                <span>Precio de venta</span>
                <input
                  className="input"
                  name="article-sale-price"
                  data-validation-field="article-sale-price"
                  type="number"
                  min="0"
                  value={form.salePrice}
                  onChange={(event) => update("salePrice", event.target.value)}
                  required
                />
              </label>

              <label className="field-group admin-field-important">
                <span>Peso aprox. (kg)</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="30"
                  step="0.001"
                  value={form.weightKg}
                  onChange={(event) => update("weightKg", event.target.value)}
                />
              </label>

              <label className="field-group admin-field-important">
                <span>Stock total</span>
                <input
                  className="input"
                  name="article-quantity-total"
                  data-validation-field="article-quantity-total"
                  type="number"
                  min="0"
                  value={form.quantityTotal}
                  onChange={(event) =>
                    update("quantityTotal", event.target.value)
                  }
                />
              </label>

              <label className="field-group admin-field-important">
                <span>Stock disponible</span>
                <input
                  className="input"
                  name="article-quantity-available"
                  data-validation-field="article-quantity-available"
                  type="number"
                  min="0"
                  value={form.quantityAvailable}
                  onChange={(event) =>
                    update("quantityAvailable", event.target.value)
                  }
                />
                {isEdit ? (
                  <span className="field-helper">
                    Si cambiás el disponible, se registrará como ajuste manual de inventario.
                  </span>
                ) : null}
              </label>

              {isEdit ? (
                <label className="field-group admin-field-important">
                  <span>Motivo del ajuste</span>
                  <select
                    className="input"
                    value={form.stockAdjustmentReason}
                    onChange={(event) =>
                      update("stockAdjustmentReason", event.target.value)
                    }
                  >
                    {STOCK_ADJUSTMENT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <span className="field-helper">
                    Se usa solo si modificás el stock disponible al guardar.
                  </span>
                </label>
              ) : null}

              <label className="field-group admin-field-important">
                <span>Estado de publicacion</span>
                <select
                  className="input"
                  value={form.status}
                  onChange={(event) => update("status", event.target.value)}
                >
                  <option value="ACTIVE">Activa</option>
                  <option value="INACTIVE">Inactiva</option>
                  <option value="RESERVED">Reservada</option>
                  <option value="SOLD_OUT">Agotada</option>
                </select>
              </label>

              {form.status === "SOLD_OUT" &&
              Number(form.quantityAvailable || 0) > 0 ? (
                <div className="inline-note form-grid-span-two">
                  Al guardar con stock disponible, el articulo volvera a estar activo salvo que lo marques como inactivo.
                </div>
              ) : null}

              {form.status === "ACTIVE" &&
              Number(form.quantityAvailable || 0) <= 0 ? (
                <div className="error-copy form-grid-span-two">
                  No se puede publicar como activo un articulo sin stock disponible.
                </div>
              ) : null}

              <label className="field-group admin-field-important">
                <span>Descuento</span>
                <select
                  className="input"
                  value={form.discountType}
                  onChange={(event) =>
                    update("discountType", event.target.value)
                  }
                >
                  <option value="NONE">Sin descuento</option>
                  <option value="PERCENT">Porcentaje</option>
                  <option value="FIXED">Monto fijo</option>
                </select>
              </label>

              <label className="field-group admin-field-important">
                <span>Valor de descuento</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.discountValue}
                  onChange={(event) =>
                    update("discountValue", event.target.value)
                  }
                />
              </label>

              <label className="field-group checkbox-field form-grid-span-two admin-field-important">
                <input
                  type="checkbox"
                  checked={
                    form.allowOffers &&
                    !(
                      form.discountType !== "NONE" &&
                      Number(form.discountValue || 0) > 0
                    )
                  }
                  onChange={(event) =>
                    update("allowOffers", event.target.checked)
                  }
                  disabled={
                    form.discountType !== "NONE" &&
                    Number(form.discountValue || 0) > 0
                  }
                />
                <span>¡Ofertá!</span>
              </label>

              <label className="field-group checkbox-field form-grid-span-two admin-field-important">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) =>
                    update("isFeatured", event.target.checked)
                  }
                />
                <span>Destacado en catálogo</span>
              </label>
            </div>

            <div className="form-grid-two article-commerce-extra-fields">
                <label className="field-group">
                  <span>Fecha de ingreso</span>
                  <input
                    className="input"
                    type="date"
                    value={form.intakeDate}
                    onChange={(event) =>
                      update("intakeDate", event.target.value)
                    }
                  />
                </label>
                <label className="field-group">
                  <span>Cantidad reservada</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.quantityReserved}
                    readOnly
                  />
                  <span className="field-helper">
                    Reservado y vendido se actualizan automáticamente por órdenes.
                  </span>
                </label>
                <label className="field-group">
                  <span>Cantidad vendida</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.quantitySold}
                    readOnly
                  />
                  <span className="field-helper">
                    Reservado y vendido se actualizan automáticamente por órdenes.
                  </span>
                </label>
                <label className="field-group admin-field-important">
                  <span>Precio compra artículo</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.purchasePriceItem}
                    onChange={(event) =>
                      update("purchasePriceItem", event.target.value)
                    }
                  />
                </label>
                <label className="field-group admin-field-important">
                  <span>Precio compra envio</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.purchasePriceShipping}
                    onChange={(event) =>
                      update("purchasePriceShipping", event.target.value)
                    }
                  />
                </label>
                <label className="field-group admin-field-important">
                  <span>Precio compra courier</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.purchasePriceCourier}
                    onChange={(event) =>
                      update("purchasePriceCourier", event.target.value)
                    }
                  />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Notas internas / origen</span>
                  <textarea
                    className="input textarea"
                    value={form.originNotes}
                    onChange={(event) =>
                      update("originNotes", event.target.value)
                    }
                  />
                </label>
              <div className="inline-note article-commerce-total-note">
                Costo de compra total estimado:{" "}
                <strong>{totalPurchasePrice}</strong>
              </div>
            </div>
          </section>
        ) : null}

        {activeStep === 2 ? (
          <section className="section-card nested-card page-stack">
            <div>
              <p className="section-kicker">Paso 3</p>
              <h2>Imagenes</h2>
            </div>

            {existingImages.length ? (
              <div className="image-manager-grid">
                {existingImages.map((image, index) => (
                  <article
                    key={`existing-${image.id}`}
                    className="image-manager-card"
                  >
                    <SmartImage
                      src={
                        image.cardFilePath ||
                        image.detailFilePath ||
                        image.filePath
                      }
                      alt={image.altText || form.title}
                      fallbackLabel={form.title || "ESADAR"}
                      className="image-manager-card__media"
                    />

                    <div className="page-stack stack-gap-xs">
                      <div className="table-actions table-actions-spread">
                        <strong>
                          {image.isPrimary ? "Primaria" : `Imagen ${index + 1}`}
                        </strong>
                        <span className="muted-copy">
                          Orden {image.sortOrder}
                        </span>
                      </div>

                      <label className="field-group">
                        <span>Alt text</span>
                        <input
                          className="input"
                          value={image.altText || ""}
                          onChange={(event) =>
                            updateExistingImage(
                              image.id,
                              "altText",
                              event.target.value,
                            )
                          }
                          placeholder="Descripción útil para Google Images y accesibilidad"
                        />
                      </label>

                      <div className="image-manager-meta">
                        <span>
                          {image.width && image.height
                            ? `${image.width}x${image.height}`
                            : "Sin metadata"}
                        </span>
                        <span>{image.processedStatus || "DONE"}</span>
                      </div>

                      <div className="inline-action-group">
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => saveImageDraft(image.id)}
                          disabled={Boolean(imageActionId)}
                        >
                          {imageActionId === `save-${image.id}`
                            ? "Guardando..."
                            : "Guardar alt"}
                        </button>

                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => markImageAsPrimary(image.id)}
                          disabled={Boolean(imageActionId) || image.isPrimary}
                        >
                          {imageActionId === `primary-${image.id}`
                            ? "Actualizando..."
                            : image.isPrimary
                              ? "Ya es primaria"
                              : "Marcar primaria"}
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
                          disabled={
                            Boolean(imageActionId) ||
                            index === existingImages.length - 1
                          }
                        >
                          Bajar
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => deleteImage(image.id)}
                          disabled={Boolean(imageActionId)}
                        >
                          {imageActionId === `delete-${image.id}`
                            ? "Eliminando..."
                            : "Borrar"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="centered-card nested-card image-manager-empty">
                <p className="muted-copy">
                  Todavía no hay imágenes cargadas para este artículo.
                </p>
              </div>
            )}

            <div className="page-stack-sm">
              <h3>Imagenes nuevas</h3>
              {/* <p className="field-helper">
                Carga las mismas tarjetas guiadas que en crear múltiples
                articulos: frente, espalda, etiqueta, textura y detalles. Las
                imagenes se suben al guardar el articulo.
              </p> */}
              <BulkArticleImageChecklist
                value={imageChecklist}
                title={form.title}
                onChange={handleImageChecklistChange}
                hasConditionWarning={hasConditionWarning}
              />
            </div>
          </section>
        ) : null}

        {activeStep === 3 ? (
          <section className="section-card nested-card page-stack">
            <div>
              <p className="section-kicker">Paso 4</p>
              <h2>Metadatos publicos</h2>
              <p className="muted-copy">
                Slug, URL y metadatos se autocompletan. Solo editalos
                manualmente si realmente lo necesitas.
              </p>
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
                <textarea
                  className="input textarea article-meta-preview-textarea"
                  value={metaDescriptionPreview}
                  readOnly
                />
              </label>
            </div>

            <details
              className="bulk-advanced-panel"
              open={metaAdvancedOpen}
              onToggle={(event) =>
                setMetaAdvancedOpen(event.currentTarget.open)
              }
            >
              <summary>Editar manualmente</summary>
              <p className="field-helper">
                Campos técnicos generados automáticamente. Solo cambialos si ya
                sabes que necesitas otro valor.
              </p>
              <div className="form-grid-two">
                <label className="field-group admin-field-important">
                    <span>Código interno manual</span>
                  <input
                    className="input"
                    value={form.internalCode}
                    onChange={(event) =>
                      update("internalCode", event.target.value)
                    }
                    placeholder="Opcional"
                  />
                </label>
                <label className="field-group">
                  <span>Slug manual</span>
                  <input
                    className="input"
                    value={form.slug}
                    onChange={(event) => update("slug", event.target.value)}
                    placeholder={suggestedSlug}
                  />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Canonical URL manual</span>
                  <input
                    className="input"
                    value={form.canonicalUrl}
                    onChange={(event) =>
                      update("canonicalUrl", event.target.value)
                    }
                    placeholder={publicUrlPreview}
                  />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Meta title manual</span>
                  <input
                    className="input"
                    value={form.seoTitle}
                    onChange={(event) => update("seoTitle", event.target.value)}
                    placeholder={metaTitlePreview}
                  />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Meta description manual</span>
                  <textarea
                    className="input textarea"
                    value={form.seoDescription}
                    onChange={(event) =>
                      update("seoDescription", event.target.value)
                    }
                    placeholder={metaDescriptionPreview}
                  />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Google product category</span>
                  <input
                    className="input"
                    value={form.googleProductCategory}
                    onChange={(event) =>
                      update("googleProductCategory", event.target.value)
                    }
                    placeholder="Apparel & Accessories > Clothing"
                  />
                </label>
                <label className="field-group form-grid-span-two">
                  <span>Alt fallback para imagen principal</span>
                  <input
                    className="input"
                    value={form.imageAltOverride}
                    onChange={(event) =>
                      update("imageAltOverride", event.target.value)
                    }
                    placeholder={`${
                      normalizeLabel(form.title) || "Articulo ESADAR"
                    } - frente principal`}
                  />
                </label>
              </div>
            </details>
          </section>
        ) : null}
        </div>

        <div className="article-wizard-footer">
          <div className="inline-note">
            {activeStep === 0 ? "Completa lo basico de la prenda." : null}
            {activeStep === 1
              ? "Define precio, stock disponible y estado comercial."
              : null}
            {activeStep === 2
              ? "Sube imagenes y deja una primaria clara."
              : null}
            {activeStep === 3
              ? "Revisa como se autogenerara la ficha publica."
              : null}
          </div>

          <PreviousNextControls
            className="inline-action-group wizard-navigation-actions"
            previousClassName="button button-secondary"
            nextClassName="button button-primary"
            previousHidden={activeStep <= 0}
            onPrevious={() => {
              setActiveStep((current) => Math.max(0, current - 1));
              scheduleArticleWizardScroll();
            }}
            onNext={() => goToStep(activeStep + 1)}
            nextSlot={activeStep < FORM_STEPS.length - 1 ? undefined : (
              <button
                type="submit"
                className="button button-primary"
                disabled={saving}
              >
                {saving
                  ? "Guardando..."
                  : isEdit
                    ? "Guardar cambios"
                    : "Crear articulo"}
              </button>
            )}
          />
        </div>
      </form>

    </div>
  );
}
