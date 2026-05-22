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
  imageAlt: "",
  isActive: true,
};

function toHeroForm(hero) {
  return {
    title: hero?.title || "",
    subtitle: hero?.subtitle || "",
    ctaLabel: hero?.ctaLabel || "",
    ctaUrl: hero?.ctaUrl || "",
    imageAlt: hero?.imageAlt || "",
    isActive: hero?.isActive ?? true,
  };
}

export default function AdminSiteHeroPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [hero, setHero] = useState(null);
  const [form, setForm] = useState(emptyHeroForm);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : ""),
    [imageFile],
  );

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

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

      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        formData.append("imageAlt", form.imageAlt || "");
        const imageResponse = await apiFetch("/api/admin/site/hero/image", {
          method: "POST",
          body: formData,
        });
        nextHero = imageResponse.hero || nextHero;
      }

      setHero(nextHero);
      setForm(toHeroForm(nextHero));
      setImageFile(null);
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
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] || null)
                  }
                />
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
                src={imagePreview || resolveAssetUrl(hero?.imageUrl)}
                alt={form.imageAlt || "Hero ESADAR"}
                className="image-manager-card__media"
                loading="eager"
              />
              {!hero?.imageUrl && !imagePreview ? (
                <p className="muted-copy">
                  Sin imagen configurada. La home usa el fallback actual.
                </p>
              ) : null}
            </div>

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
