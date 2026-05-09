import { useEffect, useState } from "react";
import AdminToolbar from "../../components/admin/AdminToolbar.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { apiFetch } from "../../lib/api.js";

const initialForm = {
  isBankTransferEnabled: true,
  bankAccountHolder: "",
  bankName: "",
  bankAccountType: "",
  bankAccountNumber: "",
  bankBranch: "",
  bankCurrency: "UYU",
  bankAlias: "",
  bankDocument: "",
  bankInstructions: "",
  isMercadoPagoEnabled: true,
  mercadoPagoEnvironment: "test",
  mercadoPagoPublicKey: "",
  mercadoPagoAccessToken: "",
  mercadoPagoAccessTokenConfigured: false,
  mercadoPagoUserId: "",
  mercadoPagoCheckoutUrl: "",
  mercadoPagoNotificationUrl: "",
  mercadoPagoPreferenceNote: "",
  mercadoPagoInstructions: "",
};

function normalizeSettings(settings = {}) {
  return {
    ...initialForm,
    ...settings,
    isBankTransferEnabled: Boolean(settings.isBankTransferEnabled ?? true),
    isMercadoPagoEnabled: Boolean(settings.isMercadoPagoEnabled ?? true),
    mercadoPagoEnvironment: settings.mercadoPagoEnvironment === "production" ? "production" : "test",
    mercadoPagoAccessToken: "",
    mercadoPagoAccessTokenConfigured: Boolean(settings.mercadoPagoAccessTokenConfigured),
  };
}

export default function AdminCollectingPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      try {
        setLoading(true);
        setError("");
        const response = await apiFetch("/api/admin/collecting");
        if (!ignore) setForm(normalizeSettings(response.settings));
      } catch (err) {
        if (!ignore) {
          const message = err.message || "No se pudo cargar la configuracion de cobros.";
          setError(message);
          notifyError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSettings();
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
      const response = await apiFetch("/api/admin/collecting", {
        method: "PUT",
        body: form,
      });
      setForm(normalizeSettings(response.settings));
      notifySuccess("Configuracion de cobros guardada correctamente.");
    } catch (err) {
      const message = err.message || "No se pudo guardar la configuracion de cobros.";
      setError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container page-stack admin-page-shell">
      <AdminToolbar />

      <section className="section-card page-stack">
        <div className="section-heading section-heading-wrap">
          <div>
            <p className="section-kicker">Administracion</p>
            <h1>Cobros</h1>
            <p className="muted-copy">
              Estos datos se usan en el correo de confirmacion de orden segun el metodo de pago elegido.
            </p>
          </div>
        </div>

        {error ? <p className="error-copy">{error}</p> : null}
        {loading ? <div className="centered-card">Cargando...</div> : null}

        {!loading ? (
          <form className="page-stack" onSubmit={handleSubmit}>
            <section className="section-card page-stack-sm">
              <div className="section-heading section-heading-wrap">
                <div>
                  <p className="section-kicker">Transferencia</p>
                  <h2>Cuenta bancaria</h2>
                </div>
                <label className="preference-check">
                  <input
                    type="checkbox"
                    checked={form.isBankTransferEnabled}
                    onChange={(event) => updateField("isBankTransferEnabled", event.target.checked)}
                  />
                  <span>Habilitada</span>
                </label>
              </div>

              <div className="form-grid-two">
                <label className="field-group">
                  <span>Titular</span>
                  <input className="input" value={form.bankAccountHolder} onChange={(event) => updateField("bankAccountHolder", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Banco</span>
                  <input className="input" value={form.bankName} onChange={(event) => updateField("bankName", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Tipo de cuenta</span>
                  <input className="input" placeholder="Caja de ahorro / Cuenta corriente" value={form.bankAccountType} onChange={(event) => updateField("bankAccountType", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Numero de cuenta</span>
                  <input className="input" value={form.bankAccountNumber} onChange={(event) => updateField("bankAccountNumber", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Sucursal</span>
                  <input className="input" value={form.bankBranch} onChange={(event) => updateField("bankBranch", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Moneda</span>
                  <input className="input" value={form.bankCurrency} onChange={(event) => updateField("bankCurrency", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Alias</span>
                  <input className="input" value={form.bankAlias} onChange={(event) => updateField("bankAlias", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Documento / RUT</span>
                  <input className="input" value={form.bankDocument} onChange={(event) => updateField("bankDocument", event.target.value)} />
                </label>
                <label className="field-group field-group-span-2">
                  <span>Instrucciones para el mail</span>
                  <textarea className="input textarea" rows="4" value={form.bankInstructions} onChange={(event) => updateField("bankInstructions", event.target.value)} />
                </label>
              </div>
            </section>

            <section className="section-card page-stack-sm">
              <div className="section-heading section-heading-wrap">
                <div>
                  <p className="section-kicker">Mercado Pago</p>
                  <h2>Datos de integracion y pago</h2>
                  <p className="muted-copy">
                    Para las credenciales de prueba, selecciona ambiente Prueba y pega la public key, access token completo y user ID del panel de Mercado Pago.
                    El access token queda guardado en el backend y no se vuelve a mostrar.
                  </p>
                </div>
                <label className="preference-check">
                  <input
                    type="checkbox"
                    checked={form.isMercadoPagoEnabled}
                    onChange={(event) => updateField("isMercadoPagoEnabled", event.target.checked)}
                  />
                  <span>Habilitado</span>
                </label>
              </div>

              <div className="form-grid-two">
                <label className="field-group">
                  <span>Ambiente</span>
                  <select className="input" value={form.mercadoPagoEnvironment} onChange={(event) => updateField("mercadoPagoEnvironment", event.target.value)}>
                    <option value="test">Prueba</option>
                    <option value="production">Produccion</option>
                  </select>
                </label>
                <label className="field-group">
                  <span>Public key</span>
                  <input className="input" value={form.mercadoPagoPublicKey} onChange={(event) => updateField("mercadoPagoPublicKey", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Access token</span>
                  <input
                    className="input"
                    type="password"
                    placeholder={form.mercadoPagoAccessTokenConfigured ? "Access token configurado. Pega uno nuevo solo si quieres reemplazarlo." : "Pega el access token completo"}
                    value={form.mercadoPagoAccessToken}
                    onChange={(event) => updateField("mercadoPagoAccessToken", event.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span>Usuario / Collector ID</span>
                  <input className="input" value={form.mercadoPagoUserId} onChange={(event) => updateField("mercadoPagoUserId", event.target.value)} />
                </label>
                <label className="field-group">
                  <span>Link de pago fallback</span>
                  <input className="input" placeholder="Opcional: se usa si falla la preferencia dinamica" value={form.mercadoPagoCheckoutUrl} onChange={(event) => updateField("mercadoPagoCheckoutUrl", event.target.value)} />
                </label>
                <label className="field-group field-group-span-2">
                  <span>URL de notificacion / webhook</span>
                  <input className="input" placeholder="Opcional: https://tu-dominio.com/api/..." value={form.mercadoPagoNotificationUrl} onChange={(event) => updateField("mercadoPagoNotificationUrl", event.target.value)} />
                </label>
                <label className="field-group field-group-span-2">
                  <span>Referencia / nota</span>
                  <textarea className="input textarea" rows="3" value={form.mercadoPagoPreferenceNote} onChange={(event) => updateField("mercadoPagoPreferenceNote", event.target.value)} />
                </label>
                <label className="field-group field-group-span-2">
                  <span>Instrucciones para el mail</span>
                  <textarea className="input textarea" rows="4" value={form.mercadoPagoInstructions} onChange={(event) => updateField("mercadoPagoInstructions", event.target.value)} />
                </label>
              </div>
            </section>

            <div className="inline-action-group">
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? "Guardando..." : "Guardar configuracion"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
