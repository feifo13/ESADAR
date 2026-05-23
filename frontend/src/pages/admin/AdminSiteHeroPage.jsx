import { useEffect, useMemo, useState } from "react";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import AppLoader from "../../components/AppLoader.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch, resolveAssetUrl } from "../../lib/api.js";

const VIEWPORT_DESKTOP_TABLET = "DESKTOP_TABLET";
const VIEWPORT_MOBILE = "MOBILE";
const VIEWPORT_OPTIONS = [
  { value: VIEWPORT_DESKTOP_TABLET, label: "Desktop / tablet" },
  { value: VIEWPORT_MOBILE, label: "Mobile" },
];
const DISPLAY_MODE_SINGLE = "SINGLE_IMAGE";
const DISPLAY_MODE_CAROUSEL = "CAROUSEL";
const HERO_HEIGHT_OPTIONS = [
  { value: "HALF_SCREEN", label: "Media pantalla" },
  { value: "FULL_SCREEN", label: "Pantalla completa" },
  { value: "CUSTOM", label: "Personalizado" },
];
const HERO_DISPLAY_OPTIONS = [
  { value: DISPLAY_MODE_SINGLE, label: "Imagen única" },
  { value: DISPLAY_MODE_CAROUSEL, label: "Carousel" },
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

function normalizeViewportTarget(value) {
  return value === VIEWPORT_MOBILE ? VIEWPORT_MOBILE : VIEWPORT_DESKTOP_TABLET;
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
  const [desktopImageFiles, setDesktopImageFiles] = useState([]);
  const [mobileImageFiles, setMobileImageFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const desktopImagePreviews = useMemo(
    () => desktopImageFiles.map((file) => URL.createObjectURL(file)),
    [desktopImageFiles],
  );
  const mobileImagePreviews = useMemo(
    () => mobileImageFiles.map((file) => URL.createObjectURL(file)),
    [mobileImageFiles],
  );

  const selectedDesktopImage = getSelectedImage(
    form.images,
    VIEWPORT_DESKTOP_TABLET,
  );
  const selectedMobileImage = getSelectedImage(form.images, VIEWPORT_MOBILE);

  const desktopPreview =
    desktopImagePreviews[0] ||
    resolveAssetUrl(selectedDesktopImage?.imageUrl || hero?.desktopImageUrl || hero?.imageUrl);
  const mobilePreview =
    mobileImagePreviews[0] ||
    resolveAssetUrl(selectedMobileImage?.imageUrl || hero?.mobileImageUrl || selectedDesktopImage?.imageUrl || hero?.imageUrl);

  useEffect(() => {
    return () => {
      desktopImagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [desktopImagePreviews]);

  useEffect(() => {
    return () => {
      mobileImagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [mobileImagePreviews]);

  useEffect(() => {
    let ignore = false;

    async function loadHero() {
      try {
        setLoading(true);
        const response = await apiFetch("/api/admin/site/hero");
        if (ignore) return;
        setHero(response.hero || null);
        setForm(toHeroForm(response.hero));
      } catch (err) {
        if (!ignore) notifyError(err.message || "No pudimos cargar el hero.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadHero();
    return () => {
      ignore = true;
    };
  }, [notifyError]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
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

      if (desktopImageFiles.length || mobileImageFiles.length) {
        const formData = new FormData();
        desktopImageFiles.forEach((file) => formData.append("desktopImages", file));
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
                <span>Subir imagen desktop / tablet</span>
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
                  Se usa en desktop y tablet. Podés subir varias y luego elegir cuál mostrar.
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
                  Se usa en pantallas angostas. Si no elegís una, se usa la de desktop/tablet.
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
                  <figcaption>Desktop / tablet</figcaption>
                  <SmartImage
                    src={desktopPreview}
                    alt={form.imageAlt || selectedDesktopImage?.imageAlt || "Hero ESADAR"}
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
              {!desktopPreview && !mobilePreview ? (
                <p className="muted-copy">
                  Sin imágenes configuradas. La home usa el fallback actual.
                </p>
              ) : null}
            </div>

            {desktopImagePreviews.length || mobileImagePreviews.length ? (
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
                        alt={`Nueva imagen desktop/tablet ${index + 1}`}
                        className="image-manager-card__media admin-site-hero-thumb__media"
                      />
                      <figcaption>Desktop / tablet</figcaption>
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
                              Mostrar en {image.viewportTarget === VIEWPORT_MOBILE ? "mobile" : "desktop/tablet"}
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
    </div>
  );
}
