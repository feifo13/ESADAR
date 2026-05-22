import { useEffect, useMemo, useState } from "react";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import AppLoader from "../../components/AppLoader.jsx";
import SmartImage from "../../components/SmartImage.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch, resolveAssetUrl } from "../../lib/api.js";

const emptyHeroForm = {
  title: "",
  subtitle: "",
  ctaLabel: "",
  ctaUrl: "",
  heroHeightMode: "HALF_SCREEN",
  customHeightVh: 70,
  heroDisplayMode: "SINGLE_IMAGE",
  imageAlt: "",
  images: [],
  isActive: true,
};

function toHeroForm(hero) {
  return {
    title: hero?.title || "",
    subtitle: hero?.subtitle || "",
    ctaLabel: hero?.ctaLabel || "",
    ctaUrl: hero?.ctaUrl || "",
    heroHeightMode: hero?.heroHeightMode || "HALF_SCREEN",
    customHeightVh: hero?.customHeightVh || 70,
    heroDisplayMode: hero?.heroDisplayMode || "SINGLE_IMAGE",
    imageAlt: hero?.imageAlt || "",
    images: Array.isArray(hero?.images)
      ? hero.images.map((image, index) => ({
          id: image.id,
          imageUrl: image.imageUrl || "",
          imageAlt: image.imageAlt || "",
          sortOrder: Number(image.sortOrder ?? index),
          isActive: image.isActive ?? true,
        }))
      : [],
    isActive: hero?.isActive ?? true,
  };
}

export default function AdminSiteHeroPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [hero, setHero] = useState(null);
  const [form, setForm] = useState(emptyHeroForm);
  const [imageFiles, setImageFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const imagePreviews = useMemo(
    () => imageFiles.map((file) => URL.createObjectURL(file)),
    [imageFiles],
  );
  const primaryImage = form.images
    .filter((image) => image.isActive !== false)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))[0];
  const primaryPreview = imagePreviews[0] || resolveAssetUrl(primaryImage?.imageUrl || hero?.imageUrl);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [imagePreviews]);

  useEffect(() => {
    let ignore = false;

    async function loadHero() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch("/api/admin/site/hero");
        if (ignore) return;
        setHero(response.hero || null);
        setForm(toHeroForm(response.hero));
      } catch (err) {
        if (!ignore) setError(err.message || "No pudimos cargar el hero.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadHero();
    return () => {
      ignore = true;
    };
  }, []);

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

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const textResponse = await apiFetch("/api/admin/site/hero", {
        method: "PUT",
        body: form,
      });
      let nextHero = textResponse.hero || null;

      if (imageFiles.length) {
        const formData = new FormData();
        imageFiles.forEach((file) => formData.append("images", file));
        formData.append("imageAlt", form.imageAlt || "");
        formData.append("heroDisplayMode", form.heroDisplayMode);
        const imageResponse = await apiFetch("/api/admin/site/hero/image", {
          method: "POST",
          body: formData,
        });
        nextHero = imageResponse.hero || nextHero;
      }

      setHero(nextHero);
      setForm(toHeroForm(nextHero));
      setImageFiles([]);
      const successMessage = "Hero actualizado.";
      setMessage(successMessage);
      notifySuccess(successMessage);
    } catch (err) {
      const errorMessage = err.message || "No pudimos guardar el hero.";
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Home</p>
            <h1>Hero</h1>
          </div>
        </div>

        {loading ? <AppLoader variant="card" label="Cargando hero" /> : null}
        {error ? <p className="error-copy">{error}</p> : null}
        {message ? <p className="success-copy">{message}</p> : null}

        {!loading ? (
          <form className="page-stack" onSubmit={handleSubmit}>
            <div className="form-grid-two">
              <label className="field-group">
                <span>Titulo</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  maxLength={180}
                />
              </label>

              <label className="field-group">
                <span>Texto secundario</span>
                <input
                  className="input"
                  value={form.subtitle}
                  onChange={(event) =>
                    updateField("subtitle", event.target.value)
                  }
                  maxLength={500}
                />
              </label>

              <label className="field-group">
                <span>CTA</span>
                <input
                  className="input"
                  value={form.ctaLabel}
                  onChange={(event) =>
                    updateField("ctaLabel", event.target.value)
                  }
                  maxLength={120}
                />
              </label>

              <label className="field-group">
                <span>URL CTA</span>
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
                    updateField("heroDisplayMode", event.target.value)
                  }
                >
                  <option value="SINGLE_IMAGE">Imagen única</option>
                  <option value="CAROUSEL">Carousel</option>
                </select>
              </label>

              <label className="field-group">
                <span>Alto del hero</span>
                <select
                  className="input"
                  value={form.heroHeightMode}
                  onChange={(event) =>
                    updateField("heroHeightMode", event.target.value)
                  }
                >
                  <option value="HALF_SCREEN">Media pantalla</option>
                  <option value="FULL_SCREEN">Pantalla completa</option>
                  <option value="CUSTOM">Personalizado</option>
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
                <span>Alt de imagen</span>
                <input
                  className="input"
                  value={form.imageAlt}
                  onChange={(event) =>
                    updateField("imageAlt", event.target.value)
                  }
                  maxLength={255}
                />
              </label>

              <label className="field-group">
                <span>Imagen</span>
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple={form.heroDisplayMode === "CAROUSEL"}
                  onChange={(event) =>
                    setImageFiles(Array.from(event.target.files || []))
                  }
                />
                <span className="field-helper">
                  {form.heroDisplayMode === "CAROUSEL"
                    ? "Podés cargar varias imágenes para el carousel."
                    : "La nueva imagen reemplaza la imagen activa del hero."}
                </span>
              </label>

              <label className="field-group checkbox-field form-grid-span-two">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    updateField("isActive", event.target.checked)
                  }
                />
                <span>Hero activo</span>
              </label>
            </div>

            <div className="section-card nested-card page-stack">
              <div>
                <p className="section-kicker">Vista actual</p>
                <h2>Imagen del hero</h2>
              </div>
              <SmartImage
                src={primaryPreview}
                alt={form.imageAlt || "Hero ESADAR"}
                className="image-manager-card__media"
                loading="eager"
              />
              {!primaryPreview ? (
                <p className="muted-copy">
                  Sin imagen configurada. La home usa el fallback actual.
                </p>
              ) : null}
            </div>

            {form.images.length ? (
              <div className="section-card nested-card page-stack">
                <div>
                  <p className="section-kicker">Imágenes</p>
                  <h2>Orden y visibilidad</h2>
                </div>
                <div className="image-manager-grid">
                  {form.images.map((image, index) => (
                    <article className="image-manager-card" key={image.id || image.imageUrl}>
                      <SmartImage
                        src={resolveAssetUrl(image.imageUrl)}
                        alt={image.imageAlt || form.imageAlt || "Hero ESADAR"}
                        className="image-manager-card__media"
                      />
                      <div className="page-stack stack-gap-xs">
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
                        <label className="field-group">
                          <span>Orden</span>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            value={image.sortOrder}
                            onChange={(event) =>
                              updateImage(index, "sortOrder", event.target.value)
                            }
                          />
                        </label>
                        <label className="field-group checkbox-field">
                          <input
                            type="checkbox"
                            checked={image.isActive}
                            onChange={(event) =>
                              updateImage(index, "isActive", event.target.checked)
                            }
                          />
                          <span>Activa</span>
                        </label>
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
