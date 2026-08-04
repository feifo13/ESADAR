import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import GoogleSignInButton from "../components/auth/GoogleSignInButton.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useMobileMenu } from "../contexts/MobileMenuContext.jsx";
import {
  firstValidationMessage,
  getEmailValidationMessage,
  getFriendlyErrorMessage,
  getMinLengthValidationMessage,
  getRequiredValidationMessage,
  notifyFormStatus,
} from "../lib/validation.js";

const GOOGLE_LINK_REQUIRED_CODE = "GOOGLE_ACCOUNT_LINK_REQUIRED";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    loginWithGoogle,
    linkGoogleAccount,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();
  const { notifyMobileStatus } = useMobileMenu();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleCredential, setGoogleCredential] = useState("");
  const [googleLinkPassword, setGoogleLinkPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const googleLoginEnabled = Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim());

  function getRedirectTarget() {
    const from = location.state?.from;
    if (!from) return "/";
    return `${from.pathname || "/"}${from.search || ""}${from.hash || ""}`;
  }

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    navigate(getRedirectTarget(), { replace: true });
  }, [authLoading, isAuthenticated, navigate, location.state]);

  function showError(err, fallback) {
    const errorMessage = getFriendlyErrorMessage(err, fallback);
    setError(errorMessage);
    notifyFormStatus(notifyMobileStatus, "error", errorMessage);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const validationMessage = firstValidationMessage(
        getRequiredValidationMessage(email, "el email"),
        getEmailValidationMessage(email),
        getRequiredValidationMessage(password, "la contraseña"),
        getMinLengthValidationMessage(password, 6, "la contraseña"),
      );
      if (validationMessage) {
        setError(validationMessage);
        notifyFormStatus(notifyMobileStatus, "error", validationMessage, {
          focusInvalidRoot: event.currentTarget,
        });
        return;
      }
      setSubmitting(true);
      setError("");
      await login(email, password);
      navigate(getRedirectTarget(), { replace: true });
    } catch (err) {
      showError(err, "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleCredential(credential) {
    try {
      setGoogleSubmitting(true);
      setGoogleCredential("");
      setGoogleLinkPassword("");
      setError("");
      await loginWithGoogle(credential);
      navigate(getRedirectTarget(), { replace: true });
    } catch (err) {
      if (err?.status === 409 && err?.payload?.details?.code === GOOGLE_LINK_REQUIRED_CODE) {
        setGoogleCredential(credential);
        setError("");
        return;
      }
      showError(err, "No se pudo iniciar sesión con Google.");
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleGoogleLink(event) {
    event.preventDefault();
    const validationMessage = firstValidationMessage(
      getRequiredValidationMessage(googleLinkPassword, "la contraseña"),
      getMinLengthValidationMessage(googleLinkPassword, 6, "la contraseña"),
    );

    if (validationMessage) {
      setError(validationMessage);
      notifyFormStatus(notifyMobileStatus, "error", validationMessage, {
        focusInvalidRoot: event.currentTarget,
      });
      return;
    }

    try {
      setGoogleSubmitting(true);
      setError("");
      await linkGoogleAccount(googleCredential, googleLinkPassword);
      navigate(getRedirectTarget(), { replace: true });
    } catch (err) {
      showError(err, "No se pudo vincular la cuenta de Google.");
    } finally {
      setGoogleSubmitting(false);
    }
  }

  function cancelGoogleLink() {
    setGoogleCredential("");
    setGoogleLinkPassword("");
    setError("");
  }

  return (
    <div className="container auth-shell">
      <section className="section-card auth-card auth-card--login">
        <p className="section-kicker">Ingresar</p>
        <h1>Entrar a tu cuenta</h1>

        {googleLoginEnabled ? (
          <div className="google-auth-block">
            <GoogleSignInButton
              disabled={submitting || googleSubmitting}
              onCredential={handleGoogleCredential}
              onError={(err) => showError(err, "No se pudo cargar el ingreso con Google.")}
            />

            {googleCredential ? (
              <form className="google-link-panel" onSubmit={handleGoogleLink} noValidate>
                <p className="muted-copy">
                  Ya existe una cuenta ESADAR con este email. Ingresa tu contraseña una sola vez
                  para vincularla con Google.
                </p>
                <label className="field-group">
                  <span>Contraseña actual</span>
                  <input
                    className="input"
                    type="password"
                    name="googleLinkPassword"
                    minLength="6"
                    value={googleLinkPassword}
                    onChange={(event) => setGoogleLinkPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <div className="google-link-panel__actions">
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={googleSubmitting}
                  >
                    {googleSubmitting ? "Vinculando…" : "Vincular y continuar"}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={cancelGoogleLink}
                    disabled={googleSubmitting}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}

            <div className="auth-divider" aria-hidden="true">
              <span>o</span>
            </div>
          </div>
        ) : null}

        {error ? <p className="error-copy" role="alert">{error}</p> : null}

        <form onSubmit={handleSubmit} noValidate>
          <label className="field-group">
            <span>Email</span>
            <input
              className="input"
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="field-group">
            <span>Contraseña</span>
            <input
              className="input"
              type="password"
              name="password"
              minLength="6"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <div className="auth-highlight-links">
            <button
              className="button button-primary auth-submit-button"
              type="submit"
              disabled={submitting || googleSubmitting}
            >
              {submitting ? "Ingresando…" : "Ingresar"}
            </button>
            <Link className="button footer-scroll-scene__copy" to="/register">
              Crear cuenta
            </Link>
            <Link className="button button-secondary" to="/forgot-password">
              Restablecer contraseña
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
