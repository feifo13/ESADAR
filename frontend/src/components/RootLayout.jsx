import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import ThemeDock from './ThemeDock.jsx';

export default function RootLayout() {
  return (
    <div className="app-shell">
      <Header />
      <main className="page-shell">
        <Outlet />
      </main>
      <Footer />
      <ThemeDock />
    </div>
  );
}
