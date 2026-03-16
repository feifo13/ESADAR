import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import ThemeDock from './ThemeDock.jsx';
import ScrollChrome from './ScrollChrome.jsx';

export default function RootLayout() {
  const location = useLocation();
  const [heroLogoVisible, setHeroLogoVisible] = useState(false);
  const isHome = location.pathname === '/';

  return (
    <div className="app-shell">
      <Header hideBrand={isHome && heroLogoVisible} />
      <main className="page-shell">
        <div key={location.pathname} className="page-transition-shell">
          <Outlet context={{ setHeroLogoVisible }} />
        </div>
      </main>
      <Footer />
      <ThemeDock />
      <ScrollChrome />
    </div>
  );
}
