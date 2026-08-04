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
    const unregisterResponseHandler = googleIdentityRuntime.registerResponseHandler((response) => {
      if (response?.credential) {
        onCredentialRef.current?.(response.credential);
      } else {
        onErrorRef.current?.(new Error('Google no devolvió una credencial válida.'));
      }
    });

    function renderButton(google) {
      if (disposed || !containerRef.current) return;
      const width = Math.max(240, Math.min(400, Math.floor(containerRef.current.clientWidth || 400)));
      containerRef.current.replaceChildren();
      google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width,
      });
      setReady(true);
    }

    googleIdentityRuntime
      .loadScript()
      .then((google) => {
        if (disposed) return;
        googleIdentityRuntime.initialize(google, {
          client_id: clientId,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_button: true,
        });
        renderButton(google);
      })
      .catch((error) => {
        if (!disposed) onErrorRef.current?.(error);
      });

    return () => {
      disposed = true;
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
