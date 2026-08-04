import { useEffect, useRef, useState } from 'react';
import { googleIdentityRuntime } from '../../lib/googleIdentityRuntime.js';

export default function GoogleSignInButton({ disabled = false, onCredential, onError }) {
  const containerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!clientId || !containerRef.current) return undefined;

    let disposed = false;
    let googleApi = null;
    let resizeObserver = null;
    let renderFrame = 0;
    let lastRenderedWidth = 0;

    const unregisterResponseHandler = googleIdentityRuntime.registerResponseHandler((response) => {
      if (response?.credential) {
        onCredentialRef.current?.(response.credential);
      } else {
        onErrorRef.current?.(new Error('Google no devolvió una credencial válida.'));
      }
    });

    function getButtonWidth() {
      const availableWidth = Math.floor(
        containerRef.current?.getBoundingClientRect().width || 0,
      );

      if (!availableWidth) return 0;
      return Math.max(240, Math.min(400, availableWidth));
    }

    function renderButton(google) {
      if (disposed || !containerRef.current) return;

      const width = getButtonWidth();
      if (!width || width === lastRenderedWidth) return;

      lastRenderedWidth = width;
      containerRef.current.replaceChildren();
      google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width,
      });
      setReady(true);
    }

    function scheduleRender() {
      if (disposed || !googleApi) return;

      if (renderFrame) {
        window.cancelAnimationFrame(renderFrame);
      }

      renderFrame = window.requestAnimationFrame(() => {
        renderFrame = 0;
        renderButton(googleApi);
      });
    }

    googleIdentityRuntime
      .loadScript()
      .then((google) => {
        if (disposed) return;

        googleApi = google;
        googleIdentityRuntime.initialize(google, {
          client_id: clientId,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_button: true,
        });

        renderButton(google);

        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(scheduleRender);
          resizeObserver.observe(containerRef.current);
        } else {
          window.addEventListener('resize', scheduleRender);
        }
      })
      .catch((error) => {
        if (!disposed) onErrorRef.current?.(error);
      });

    return () => {
      disposed = true;

      if (renderFrame) {
        window.cancelAnimationFrame(renderFrame);
      }

      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleRender);
      unregisterResponseHandler();
    };
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div className="google-auth-button-shell" aria-busy={disabled || !ready}>
      <div
        ref={containerRef}
        className={disabled ? 'google-auth-button google-auth-button--disabled' : 'google-auth-button'}
      />
      {disabled ? <span className="google-auth-button-blocker" aria-hidden="true" /> : null}
    </div>
  );
}
