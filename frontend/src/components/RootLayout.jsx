import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import ThemeDock from './ThemeDock.jsx';
import ScrollChrome from './ScrollChrome.jsx';
import esadarWordmark from '../assets/esadar-wordmark.png';

const INTRO_INITIAL_VISIBLE_MS = 3300;
const INTRO_INITIAL_FADE_MS = 650;
const INTRO_REPLAY_VISIBLE_MS = 1700;
const INTRO_REPLAY_FADE_MS = 520;
const CART_REPLAY_VISIBLE_MS = 650;
const CART_REPLAY_FADE_MS = 350;

export default function RootLayout() {
  const location = useLocation();
  const [heroLogoVisible, setHeroLogoVisible] = useState(false);
  const [introStage, setIntroStage] = useState('hidden');
  const [introKey, setIntroKey] = useState(0);
  const [introDuration, setIntroDuration] = useState(INTRO_INITIAL_VISIBLE_MS);
  const [introFadeDuration, setIntroFadeDuration] = useState(INTRO_INITIAL_FADE_MS);
  const didInitialIntro = useRef(false);
  const isHome = location.pathname === '/';
  const isCheckoutView = location.pathname.startsWith('/checkout');
  const isAdminView = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.key]);

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const wantsReplay = Boolean(location.state?.replayIntro);
    const shouldShowInitial = !didInitialIntro.current;
    const shouldShowIntro = !reduceMotion && (shouldShowInitial || wantsReplay);

    didInitialIntro.current = true;

    if (!shouldShowIntro) {
      setIntroStage('hidden');
      return undefined;
    }

    const replayReason = location.state?.replayIntroReason;
    const isCartReplay = replayReason === 'cart';

    const visibleMs = shouldShowInitial
      ? INTRO_INITIAL_VISIBLE_MS
      : isCartReplay
        ? CART_REPLAY_VISIBLE_MS
        : INTRO_REPLAY_VISIBLE_MS;
    const fadeMs = shouldShowInitial
      ? INTRO_INITIAL_FADE_MS
      : isCartReplay
        ? CART_REPLAY_FADE_MS
        : INTRO_REPLAY_FADE_MS;

    setIntroDuration(visibleMs);
    setIntroFadeDuration(fadeMs);
    setIntroKey((current) => current + 1);
    setIntroStage('visible');

    const fadeTimer = window.setTimeout(() => setIntroStage('fading'), visibleMs);
    const hideTimer = window.setTimeout(() => setIntroStage('hidden'), visibleMs + fadeMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [location.key, location.state]);

  const showIntro = introStage !== 'hidden';

  return (
    <div
      className={`app-shell${showIntro ? ' app-shell--intro-active' : ''}${isCheckoutView ? ' app-shell--checkout-view' : ''}${isAdminView ? ' app-shell--admin-view' : ''}`}
    >
      <Header hideBrand={isHome && heroLogoVisible} />
      <main className="page-shell">
        <div className="page-transition-shell">
          <Outlet context={{ setHeroLogoVisible }} />
        </div>
      </main>
      <Footer />
      <ThemeDock />
      <ScrollChrome />

      {showIntro ? (
        <div
          key={introKey}
          className={`intro-splash${introStage === 'fading' ? ' intro-splash--fade-out' : ''}`}
          style={{
            '--intro-logo-duration': `${introDuration}ms`,
            '--intro-fade-duration': `${introFadeDuration}ms`,
          }}
          aria-hidden="true"
        >
          <div className="intro-splash__logo-wrap">
            <img src={esadarWordmark} alt="" className="intro-splash__logo" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
