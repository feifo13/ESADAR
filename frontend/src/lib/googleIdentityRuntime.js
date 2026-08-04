const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_IDENTITY_RUNTIME_KEY = Symbol.for('esadar.googleIdentityRuntime');

export function createGoogleIdentityRuntime() {
  let scriptPromise = null;
  let initializedClientId = '';
  let activeResponseHandler = null;

  function loadScript() {
    if (window.google?.accounts?.id) {
      return Promise.resolve(window.google);
    }

    if (scriptPromise) {
      return scriptPromise;
    }

    scriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);
      const script = existingScript || document.createElement('script');
      const timeoutId = window.setTimeout(() => {
        handleError(new Error('Google Identity Services demoró demasiado en cargar.'));
      }, 10000);

      function cleanup() {
        window.clearTimeout(timeoutId);
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }

      function handleLoad() {
        cleanup();
        if (window.google?.accounts?.id) {
          resolve(window.google);
        } else {
          scriptPromise = null;
          reject(new Error('Google Identity Services no quedó disponible.'));
        }
      }

      function handleError(error) {
        cleanup();
        scriptPromise = null;
        reject(
          error instanceof Error
            ? error
            : new Error('No se pudo cargar Google Identity Services.'),
        );
      }

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });

      if (!existingScript) {
        script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });

    return scriptPromise;
  }

  function registerResponseHandler(handler) {
    activeResponseHandler = handler;

    return () => {
      if (activeResponseHandler === handler) {
        activeResponseHandler = null;
      }
    };
  }

  function initialize(google, configuration) {
    const clientId = String(configuration?.client_id || '').trim();
    if (!clientId) {
      throw new Error('Falta el Client ID de Google.');
    }

    if (initializedClientId) {
      if (initializedClientId === clientId) {
        return false;
      }

      throw new Error(
        'Google Identity Services ya fue inicializado con otro Client ID. Recarga la página.',
      );
    }

    google.accounts.id.initialize({
      ...configuration,
      callback: (response) => {
        activeResponseHandler?.(response);
      },
    });
    initializedClientId = clientId;
    return true;
  }

  return {
    initialize,
    loadScript,
    registerResponseHandler,
  };
}

export const googleIdentityRuntime =
  globalThis[GOOGLE_IDENTITY_RUNTIME_KEY] ||
  (globalThis[GOOGLE_IDENTITY_RUNTIME_KEY] = createGoogleIdentityRuntime());
