import { useEffect, useMemo, useState } from "react";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import AppLoader from "../../components/AppLoader.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch, resolveAssetUrl } from "../../lib/api.js";
import {
  buildTickerTargetUrl,
  DEFAULT_SITE_TICKER,
  normalizeSiteTicker,
  normalizeTickerMessages,
  resolveTickerBackgroundColor,
} from "../../lib/siteTicker.js";

const VIEWPORT_DESKTOP_TABLET = "DESKTOP_TABLET";
const VIEWPORT_TABLET_LAPTOP = "TABLET_LAPTOP";
const VIEWPORT_MOBILE = "MOBILE";
const VIEWPORT_OPTIONS = [
  { value: VIEWPORT_DESKTOP_TABLET, label: "Desktop" },
  { value: VIEWPORT_TABLET_LAPTOP, label: "Tablet / laptop chica" },
  { value: VIEWPORT_MOBILE, label: "Mobile" },
];
const DISPLAY_MODE_SINGLE = "SINGLE_IMAGE";
const DISPLAY_MODE_CAROUSEL = "CAROUSEL";
const HERO_HEIGHT_OPTIONS = [
  { value: "HALF_SCREEN", label: "Media pantalla" },
  { value: "TABLET_LAPTOP", label: "Tablet / laptop chica" },
  { value: "FULL_SCREEN", label: "Pantalla completa" },
  { value: "CUSTOM", label: "Personalizado" },
];
const HERO_DISPLAY_OPTIONS = [
  { value: DISPLAY_MODE_SINGLE, label: "Imagen única" },
  { value: DISPLAY_MODE_CAROUSEL, label: "Carousel" },
];
const TICKER_TARGET_SECTION_OPTIONS = [
  { value: "", label: "Usar URL configurada" },
  { value: "catalog", label: "Catálogo general" },
  { value: "featured", label: "Destacados" },
  { value: "offers", label: "Ofertas" },
  { value: "latest", label: "Últimos ingresos" },
];

const emptyHeroForm = {
  title: "",
  subtitle: "",
  ctaLabel: "",
  ctaUrl: "",
  heroHeightMode: "HALF_SCREEN",
  customHeightVh: 70,
  heroDisplayMode: DISPLAY_MODE_SINGLE,
  imageAlt: "",
  images: [],
  isActive: true,
};
const emptyTickerForm = { ...DEFAULT_SITE_TICKER };

function normalizeViewportTarget(value) {
  if (value === VIEWPORT_MOBILE) return VIEWPORT_MOBILE;
  if (value === VIEWPORT_TABLET_LAPTOP) return VIEWPORT_TABLET_LAPTOP;
  return VIEWPORT_DESKTOP_TABLET;
}

function normalizeDisplayMode(value) {
  return value === DISPLAY_MODE_CAROUSEL ? DISPLAY_MODE_CAROUSEL : DISPLAY_MODE_SINGLE;
}

function normalizeImages(images = [], displayMode = DISPLAY_MODE_SINGLE) {
  const safeImages = Array.isArray(images)
    ? images.map((image, index) => ({
        id: image.id,
        imageUrl: image.imageUrl || "",
        imageAlt: image.imageAlt || "",
        viewportTarget: normalizeViewportTarget(
          image.viewportTarget || image.viewport_target,
        ),
        sortOrder: Number(image.sortOrder ?? index),
        isActive: image.isActive ?? true,
      }))
    : [];

  if (normalizeDisplayMode(displayMode) === DISPLAY_MODE_CAROUSEL) {
    return safeImages;
  }

  const firstIndexByViewport = new Map();
  const selectedIndexByViewport = new Map();

  safeImages.forEach((image, index) => {
    const viewportTarget = normalizeViewportTarget(image.viewportTarget);
    if (!firstIndexByViewport.has(viewportTarget)) {
      firstIndexByViewport.set(viewportTarget, index);
    }
    if (image.isActive !== false && !selectedIndexByViewport.has(viewportTarget)) {
      selectedIndexByViewport.set(viewportTarget, index);
    }
  });

  return safeImages.map((image, index) => {
    const viewportTarget = normalizeViewportTarget(image.viewportTarget);
    const selectedIndex = selectedIndexByViewport.has(viewportTarget)
      ? selectedIndexByViewport.get(viewportTarget)
      : firstIndexByViewport.get(viewportTarget);

    return {
      ...image,
      viewportTarget,
      isActive: index === selectedIndex,
    };
  });
}

function toHeroForm(hero) {
  return {
    title: hero?.title || "",
    subtitle: hero?.subtitle || "",
    ctaLabel: hero?.ctaLabel || "",
    ctaUrl: hero?.ctaUrl || "",
    heroHeightMode: hero?.heroHeightMode || "HALF_SCREEN",
    customHeightVh: Number(hero?.customHeightVh || 70),
    heroDisplayMode: normalizeDisplayMode(hero?.heroDisplayMode),
    imageAlt: hero?.imageAlt || "",
    images: normalizeImages(hero?.images, hero?.heroDisplayMode),
    isActive: hero?.isActive ?? true,
  };
}

function toTickerForm(ticker) {
  return normalizeSiteTicker(ticker);
}

function getTickerFormMessages(tickerForm) {
  const messages = normalizeTickerMessages(tickerForm?.messages, tickerForm?.text);
  return messages.length ? messages : [""];
}

function getCleanTickerMessages(tickerForm) {
  return normalizeTickerMessages(tickerForm?.messages, tickerForm?.text);
}

function getSelectedImage(images, viewportTarget) {
  const target = normalizeViewportTarget(viewportTarget);
  return (
    images.find((image) => image.viewportTarget === target && image.isActive) ||
    images.find((image) => image.viewportTarget === target) ||
    null
  );
}

export default function AdminSiteHeroPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [hero, setHero] = useState(null);
  const [form, setForm] = useState(emptyHeroForm);
  const [ticker, setTicker] = useState(null);
  const [tickerForm, setTickerForm] = useState(emptyTickerForm);
  const [desktopImageFiles, setDesktopImageFiles] = useState([]);
  const [tabletLaptopImageFiles, setTabletLaptopImageFiles] = useState([]);
  const [mobileImageFiles, setMobileImageFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTicker, setSavingTicker] = useState(false);

  const desktopImagePreviews = useMemo(
    () => desktopImageFiles.map((file) => URL.createObjectURL(file)),
    [desktopImageFiles],
  );
  const tabletLaptopImagePreviews = useMemo(
    () => tabletLaptopImageFiles.map((file) => URL.createObjectURL(file)),
    [tabletLaptopImageFiles],
  );
  const mobileImagePreviews = useMemo(
    () => mobileImageFiles.map((file) => URL.createObjectURL(file)),
    [mobileImageFiles],
  );

  const selectedDesktopImage = getSelectedImage(
    form.images,
    VIEWPORT_DESKTOP_TABLET,
  );
  const selectedTabletLaptopImage = getSelectedImage(
    form.images,
    VIEWPORT_TABLET_LAPTOP,
  );
  const selectedMobileImage = getSelectedImage(form.images, VIEWPORT_MOBILE);

  const desktopPreview =
    desktopImagePreviews[0] ||
    resolveAssetUrl(selectedDesktopImage?.imageUrl || hero?.desktopImageUrl || hero?.imageUrl);
  const tabletLaptopPreview =
    tabletLaptopImagePreviews[0] ||
    resolveAssetUrl(
      selectedTabletLaptopImage?.imageUrl ||
        hero?.tabletLaptopImageUrl ||
        selectedDesktopImage?.imageUrl ||
        hero?.desktopImageUrl ||
        hero?.imageUrl,
    );
  const mobilePreview =
    mobileImagePreviews[0] ||
    resolveAssetUrl(
      selectedMobileImage?.imageUrl ||
        hero?.mobileImageUrl ||
        selectedTabletLaptopImage?.imageUrl ||
        hero?.tabletLaptopImageUrl ||
        selectedDesktopImage?.imageUrl ||
        hero?.imageUrl,
    );

  useEffect(() => {
    return () => {
      desktopImagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [desktopImagePreviews]);

  useEffect(() => {
    return () => {
      tabletLaptopImagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [tabletLaptopImagePreviews]);

  useEffect(() => {
    return () => {
      mobileImagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [mobileImagePreviews]);

  useEffect(() => {
    let ignore = false;

    async function loadSiteSettings() {
      try {
        setLoading(true);
        const [heroResponse, tickerResponse] = await Promise.all([
          apiFetch("/api/admin/site/hero"),
          apiFetch("/api/admin/site/ticker"),
        ]);
        if (ignore) return;
        setHero(heroResponse.hero || null);
        setForm(toHeroForm(heroResponse.hero));
        setTicker(tickerResponse.ticker || null);
        setTickerForm(toTickerForm(tickerResponse.ticker));
      } catch (err) {
        if (!ignore) notifyError(err.message || "No pudimos cargar la configuración del sitio.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadSiteSettings();
    return () => {
      ignore = true;
    };
  }, [notifyError]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateTickerField(name, value) {
    setTickerForm((current) => ({ ...current, [name]: value }));
  }

  function updateTickerMessage(index, value) {
    setTickerForm((current) => {
      const messages = getTickerFormMessages(current);
      const nextMessages = messages.map((message, messageIndex) =>
        messageIndex === index ? value : message,
      );
      return { ...current, messages: nextMessages, text: nextMessages[0] || "" };
    });
  }

  function addTickerMessage() {
    setTickerForm((current) => {
      const messages = getTickerFormMessages(current);
      return { ...current, messages: [...messages, ""] };
    });
  }

  function removeTickerMessage(index) {
    setTickerForm((current) => {
      const messages = getTickerFormMessages(current);
      const nextMessages = messages.filter((_, messageIndex) => messageIndex !== index);
      const safeMessages = nextMessages.length ? nextMessages : [""];
      return { ...current, messages: safeMessages, text: safeMessages[0] || "" };
    });
  }

  function updateImage(index, name, value) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, [name]: value } : image,
      ),
    }));
  }

  function updateImageViewport(index, viewportTarget) {
    const nextViewportTarget = normalizeViewportTarget(viewportTarget);
    setForm((current) => ({
      ...current,
      images: normalizeImages(
        current.images.map((image, imageIndex) => {
          if (imageIndex !== index) return image;
          return {
            ...image,
            viewportTarget: nextViewportTarget,
            isActive: normalizeDisplayMode(current.heroDisplayMode) === DISPLAY_MODE_CAROUSEL
              ? image.isActive
              : true,
          };
        }),
        current.heroDisplayMode,
      ),
    }));
  }

  function selectImage(index) {
    setForm((current) => {
      const selected = current.images[index];
      const selectedViewport = normalizeViewportTarget(selected?.viewportTarget);

      return {
        ...current,
        images: current.images.map((image, imageIndex) => {
          if (normalizeViewportTarget(image.viewportTarget) !== selectedViewport) {
            return image;
          }

          return {
            ...image,
            isActive: imageIndex === index,
          };
        }),
      };
    });
  }

  async function handleDeleteImage(image) {
    if (!image?.id) return;
    const shouldDelete = window.confirm(
      "¿Eliminar esta imagen del hero? Esta acción no se puede deshacer.",
    );
    if (!shouldDelete) return;

    try {
      setSaving(true);
      const response = await apiFetch(`/api/admin/site/hero/images/${image.id}`, {
        method: "DELETE",
      });
      const nextHero = response.hero || null;
      setHero(nextHero);
      setForm(toHeroForm(nextHero));
      const successMessage = "Imagen eliminada.";
      notifySuccess(successMessage);
    } catch (err) {
      const errorMessage = err.message || "No pudimos eliminar la imagen.";
      notifyError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);

      const textResponse = await apiFetch("/api/admin/site/hero", {
        method: "PUT",
        body: {
          title: form.title,
          subtitle: form.subtitle,
          ctaLabel: form.ctaLabel,
          ctaUrl: form.ctaUrl,
          heroHeightMode: form.heroHeightMode,
          customHeightVh:
            form.heroHeightMode === "CUSTOM"
              ? Number(form.customHeightVh || 70)
              : null,
          heroDisplayMode: form.heroDisplayMode,
          imageAlt: form.imageAlt,
          images: normalizeImages(form.images, form.heroDisplayMode).map((image, index) => ({
            id: image.id,
            imageUrl: image.imageUrl,
            imageAlt: image.imageAlt,
            viewportTarget: image.viewportTarget,
            sortOrder: index,
            isActive: Boolean(image.isActive),
          })),
          isActive: form.isActive,
        },
      });
      let nextHero = textResponse.hero || null;

      if (desktopImageFiles.length || tabletLaptopImageFiles.length || mobileImageFiles.length) {
        const formData = new FormData();
        desktopImageFiles.forEach((file) => formData.append("desktopImages", file));
        tabletLaptopImageFiles.forEach((file) => formData.append("tabletLaptopImages", file));
        mobileImageFiles.forEach((file) => formData.append("mobileImages", file));
        formData.append("imageAlt", form.imageAlt || "");
        const imageResponse = await apiFetch("/api/admin/site/hero/image", {
          method: "POST",
          body: formData,
        });
        nextHero = imageResponse.hero || nextHero;
      }

      setHero(nextHero);
      setForm(toHeroForm(nextHero));
      setDesktopImageFiles([]);
      setTabletLaptopImageFiles([]);
      setMobileImageFiles([]);
      const successMessage = "Hero actualizado.";
      notifySuccess(successMessage);
    } catch (err) {
      const errorMessage = err.message || "No pudimos guardar el hero.";
      notifyError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleTickerSubmit(event) {
    event.preventDefault();

    const messages = getCleanTickerMessages(tickerForm);
    const nextTicker = {
      ...tickerForm,
      text: messages[0] || "",
      messages,
      targetUrl: String(tickerForm.targetUrl || DEFAULT_SITE_TICKER.targetUrl).trim(),
      targetSection: String(tickerForm.targetSection || "").trim().toLowerCase(),
      backgroundColor: String(tickerForm.backgroundColor || DEFAULT_SITE_TICKER.backgroundColor).trim(),
      isEnabled: Boolean(tickerForm.isEnabled),
      isSticky: Boolean(tickerForm.isSticky),
    };
    if (nextTicker.isEnabled && !nextTicker.messages.length) {
      notifyError("Agrega al menos un mensaje para activar el ticker.");
      return;
    }
    if (
      !nextTicker.targetUrl.startsWith("/") ||
      nextTicker.targetUrl.startsWith("//") ||
      /^[a-z][a-z0-9+.-]*:/i.test(nextTicker.targetUrl)
    ) {
      notifyError("La URL del ticker debe ser interna.");
      return;
    }

    try {
      setSavingTicker(true);
      const response = await apiFetch("/api/admin/site/ticker", {
        method: "PUT",
        body: {
          isEnabled: nextTicker.isEnabled,
          text: nextTicker.text,
          messages: nextTicker.messages,
          targetUrl: nextTicker.targetUrl,
          targetSection: nextTicker.targetSection,
          backgroundColor: nextTicker.backgroundColor,
          isSticky: nextTicker.isSticky,
        },
      });
      setTicker(response.ticker || null);
      setTickerForm(toTickerForm(response.ticker));
      notifySuccess("Ticker actualizado.");
    } catch (err) {
      notifyError(err.message || "No pudimos guardar el ticker.");
    } finally {
      setSavingTicker(false);
    }
  }

  const tickerPreviewMessages = getCleanTickerMessages(tickerForm);

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading admin-site-hero-heading">
          <div>
            <p className="section-kicker">Home</p>
            <h1>Hero</h1>
          </div>
          {!loading ? (
            <button
              type="submit"
              form="admin-site-hero-form"
              className="button button-primary"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar hero"}
            </button>
          ) : null}
        </div>

        {loading ? <AppLoader variant="card" label="Cargando hero" /> : null}

        {!loading ? (
          <form id="admin-site-hero-form" className="page-stack" onSubmit={handleSubmit}>
            <div className="form-grid-two">
              <label className="field-group">
                <span>Título</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  maxLength={180}
                  placeholder="ESADAR"
                />
              </label>

              <label className="field-group">
                <span>Subtítulo</span>
                <input
                  className="input"
                  value={form.subtitle}
                  onChange={(event) => updateField("subtitle", event.target.value)}
                  maxLength={500}
                  placeholder="Ropa seleccionada"
                />
              </label>

              <label className="field-group">
                <span>CTA</span>
                <input
                  className="input"
                  value={form.ctaLabel}
                  onChange={(event) => updateField("ctaLabel", event.target.value)}
                  maxLength={120}
                  placeholder="Ver catálogo"
                />
              </label>

              <label className="field-group">
                <span>URL del CTA</span>
                <input
                  className="input"
                  value={form.ctaUrl}
                  onChange={(event) => updateField("ctaUrl", event.target.value)}
                  maxLength={500}
                  placeholder="/articles"
                />
              </label>

              <label className="field-group">
                <span>Tipo de hero</span>
                <select
                  className="input"
                  value={form.heroDisplayMode}
                  onChange={(event) =>
                    updateField("heroDisplayMode", normalizeDisplayMode(event.target.value))
                  }
                >
                  {HERO_DISPLAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>Alto del hero</span>
                <select
                  className="input"
                  value={form.heroHeightMode}
                  onChange={(event) => updateField("heroHeightMode", event.target.value)}
                >
                  {HERO_HEIGHT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.heroHeightMode === "CUSTOM" ? (
                <label className="field-group">
                  <span>Alto personalizado (vh)</span>
                  <input
                    className="input"
                    type="number"
                    min="30"
                    max="100"
                    value={form.customHeightVh}
                    onChange={(event) =>
                      updateField("customHeightVh", event.target.value)
                    }
                  />
                  <span className="field-helper">
                    Ejemplo: 70 ocupa aproximadamente el 70% de la altura visible.
                  </span>
                </label>
              ) : null}

              <label className="field-group">
                <span>Texto alternativo general</span>
                <input
                  className="input"
                  value={form.imageAlt}
                  onChange={(event) => updateField("imageAlt", event.target.value)}
                  maxLength={255}
                  placeholder="Hero ESADAR"
                />
              </label>

              <label className="field-group checkbox-field">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    updateField("isActive", event.target.checked)
                  }
                />
                <span>Hero activo</span>
              </label>

              <label className="field-group">
                <span>Subir imagen desktop</span>
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) =>
                    setDesktopImageFiles(Array.from(event.target.files || []))
                  }
                />
                <span className="field-helper">
                  Se usa en pantallas grandes. Podés subir varias y luego elegir cuál mostrar.
                </span>
              </label>

              <label className="field-group">
                <span>Subir imagen tablet / laptop chica</span>
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) =>
                    setTabletLaptopImageFiles(Array.from(event.target.files || []))
                  }
                />
                <span className="field-helper">
                  Se usa en tablets horizontales y laptops chicas. Si no elegís una, se usa la de desktop.
                </span>
              </label>

              <label className="field-group">
                <span>Subir imagen mobile</span>
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) =>
                    setMobileImageFiles(Array.from(event.target.files || []))
                  }
                />
                <span className="field-helper">
                  Se usa en pantallas angostas. Si no elegís una, se usa la de tablet/laptop o desktop.
                </span>
              </label>
            </div>

            <div className="section-card nested-card page-stack admin-site-hero-preview-card">
              <div>
                <p className="section-kicker">Vista actual</p>
                <h2>Imágenes visibles del hero</h2>
              </div>
              <div className="admin-site-hero-preview-grid">
                <figure className="admin-site-hero-preview-item">
                  <figcaption>Desktop</figcaption>
                  <SmartImage
                    src={desktopPreview}
                    alt={form.imageAlt || selectedDesktopImage?.imageAlt || "Hero ESADAR"}
                    className="image-manager-card__media admin-site-hero-preview__media"
                    loading="eager"
                  />
                </figure>
                <figure className="admin-site-hero-preview-item">
                  <figcaption>Tablet / laptop chica</figcaption>
                  <SmartImage
                    src={tabletLaptopPreview}
                    alt={form.imageAlt || selectedTabletLaptopImage?.imageAlt || "Hero ESADAR tablet"}
                    className="image-manager-card__media admin-site-hero-preview__media"
                    loading="eager"
                  />
                </figure>
                <figure className="admin-site-hero-preview-item">
                  <figcaption>Mobile</figcaption>
                  <SmartImage
                    src={mobilePreview}
                    alt={form.imageAlt || selectedMobileImage?.imageAlt || "Hero ESADAR mobile"}
                    className="image-manager-card__media admin-site-hero-preview__media"
                    loading="eager"
                  />
                </figure>
              </div>
              {!desktopPreview && !tabletLaptopPreview && !mobilePreview ? (
                <p className="muted-copy">
                  Sin imágenes configuradas. La home usa el fallback actual.
                </p>
              ) : null}
            </div>

            {desktopImagePreviews.length || tabletLaptopImagePreviews.length || mobileImagePreviews.length ? (
              <div className="section-card nested-card page-stack">
                <div>
                  <p className="section-kicker">Pendientes</p>
                  <h2>Imágenes listas para subir</h2>
                </div>
                <div className="image-manager-grid admin-site-hero-image-grid">
                  {desktopImagePreviews.map((preview, index) => (
                    <figure className="image-manager-card image-manager-card--pending" key={preview}>
                      <SmartImage
                        src={preview}
                        alt={`Nueva imagen desktop ${index + 1}`}
                        className="image-manager-card__media admin-site-hero-thumb__media"
                      />
                      <figcaption>Desktop</figcaption>
                    </figure>
                  ))}
                  {tabletLaptopImagePreviews.map((preview, index) => (
                    <figure className="image-manager-card image-manager-card--pending" key={preview}>
                      <SmartImage
                        src={preview}
                        alt={`Nueva imagen tablet/laptop ${index + 1}`}
                        className="image-manager-card__media admin-site-hero-thumb__media"
                      />
                      <figcaption>Tablet / laptop chica</figcaption>
                    </figure>
                  ))}
                  {mobileImagePreviews.map((preview, index) => (
                    <figure className="image-manager-card image-manager-card--pending" key={preview}>
                      <SmartImage
                        src={preview}
                        alt={`Nueva imagen mobile ${index + 1}`}
                        className="image-manager-card__media admin-site-hero-thumb__media"
                      />
                      <figcaption>Mobile</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ) : null}

            {form.images.length ? (
              <div className="section-card nested-card page-stack">
                <div>
                  <p className="section-kicker">Imágenes</p>
                  <h2>Seleccionar imagen visible por viewport</h2>
                </div>
                <div className="image-manager-grid admin-site-hero-image-grid">
                  {form.images.map((image, index) => (
                    <article className="image-manager-card" key={image.id || image.imageUrl}>
                      <SmartImage
                        src={resolveAssetUrl(image.imageUrl)}
                        alt={image.imageAlt || form.imageAlt || "Hero ESADAR"}
                        className="image-manager-card__media admin-site-hero-thumb__media"
                      />
                      <div className="page-stack stack-gap-xs">
                        <label className="field-group">
                          <span>Viewport</span>
                          <select
                            className="input"
                            value={image.viewportTarget}
                            onChange={(event) => updateImageViewport(index, event.target.value)}
                          >
                            {VIEWPORT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {form.heroDisplayMode === DISPLAY_MODE_CAROUSEL ? (
                          <label className="field-group checkbox-field">
                            <input
                              type="checkbox"
                              checked={Boolean(image.isActive)}
                              onChange={(event) =>
                                updateImage(index, "isActive", event.target.checked)
                              }
                            />
                            <span>Incluir en carousel</span>
                          </label>
                        ) : (
                          <label className="field-group checkbox-field">
                            <input
                              type="radio"
                              name={`selectedHeroImage-${image.viewportTarget}`}
                              checked={Boolean(image.isActive)}
                              onChange={() => selectImage(index)}
                            />
                            <span>
                              Mostrar en {image.viewportTarget === VIEWPORT_MOBILE
                                ? "mobile"
                                : image.viewportTarget === VIEWPORT_TABLET_LAPTOP
                                  ? "tablet/laptop chica"
                                  : "desktop"}
                            </span>
                          </label>
                        )}
                        <label className="field-group">
                          <span>Alt</span>
                          <input
                            className="input"
                            value={image.imageAlt || ""}
                            onChange={(event) =>
                              updateImage(index, "imageAlt", event.target.value)
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={saving}
                          onClick={() => handleDeleteImage(image)}
                        >
                          Eliminar imagen
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="inline-action-group">
              <button
                type="submit"
                className="button button-primary"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar hero"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="section-card page-stack admin-site-ticker-card">
        <div className="section-heading admin-site-hero-heading">
          <div>
            <p className="section-kicker">Sitio público</p>
            <h1>Ticker</h1>
          </div>
          {!loading ? (
            <button
              type="submit"
              form="admin-site-ticker-form"
              className="button button-primary"
              disabled={savingTicker}
            >
              {savingTicker ? "Guardando..." : "Guardar ticker"}
            </button>
          ) : null}
        </div>

        {loading ? <AppLoader variant="card" label="Cargando ticker" /> : null}

        {!loading ? (
          <form id="admin-site-ticker-form" className="page-stack" onSubmit={handleTickerSubmit}>
            <div className="form-grid-two">
              <label className="field-group checkbox-field">
                <input
                  type="checkbox"
                  checked={tickerForm.isEnabled}
                  onChange={(event) => updateTickerField("isEnabled", event.target.checked)}
                />
                <span>Ticker activo</span>
              </label>

              <label className="field-group checkbox-field">
                <input
                  type="checkbox"
                  checked={tickerForm.isSticky}
                  onChange={(event) => updateTickerField("isSticky", event.target.checked)}
                />
                <span>Mantener ticker fijo al hacer scroll</span>
              </label>

              <div className="field-group form-grid-span-two admin-site-ticker-messages">
                <span>Mensajes</span>
                {getTickerFormMessages(tickerForm).map((message, index) => (
                  <div className="admin-site-ticker-message-row" key={`ticker-message-${index}`}>
                    <input
                      className="input"
                      value={message}
                      onChange={(event) => updateTickerMessage(index, event.target.value)}
                      maxLength={180}
                      placeholder="Nuevas prendas disponibles — ver catálogo"
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeTickerMessage(index)}
                      disabled={getTickerFormMessages(tickerForm).length <= 1}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="button button-secondary admin-site-ticker-add-message"
                  onClick={addTickerMessage}
                  disabled={getTickerFormMessages(tickerForm).length >= 12}
                >
                  Agregar mensaje
                </button>
              </div>

              <label className="field-group">
                <span>URL destino</span>
                <input
                  className="input"
                  value={tickerForm.targetUrl}
                  onChange={(event) => updateTickerField("targetUrl", event.target.value)}
                  maxLength={500}
                  placeholder="/articles"
                />
                <span className="field-helper">
                  Debe ser una ruta interna del sitio.
                </span>
              </label>

              <label className="field-group">
                <span>Sección destino</span>
                <select
                  className="input"
                  value={tickerForm.targetSection}
                  onChange={(event) => updateTickerField("targetSection", event.target.value)}
                >
                  {TICKER_TARGET_SECTION_OPTIONS.map((option) => (
                    <option key={option.value || "url"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>Color de fondo</span>
                <input
                  className="input"
                  value={tickerForm.backgroundColor}
                  onChange={(event) => updateTickerField("backgroundColor", event.target.value)}
                  maxLength={32}
                  placeholder="#ec672b"
                />
                <span className="field-helper">
                  Hexadecimal o token: orange, navy, aqua, surface, text.
                </span>
              </label>
            </div>

            <div className="admin-site-ticker-preview">
              <div
                className="admin-site-ticker-preview__bar"
                style={{ "--ticker-background": resolveTickerBackgroundColor(tickerForm.backgroundColor) }}
              >
                <span>{tickerPreviewMessages.length ? tickerPreviewMessages.join(" / ") : "Sin mensajes"}</span>
              </div>
              <p className="field-helper">
                Destino: {buildTickerTargetUrl(tickerForm)}
                {ticker?.updatedAt ? ` · Última actualización: ${ticker.updatedAt}` : ""}
              </p>
            </div>

            <div className="inline-action-group">
              <button
                type="submit"
                className="button button-primary"
                disabled={savingTicker}
              >
                {savingTicker ? "Guardando..." : "Guardar ticker"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
