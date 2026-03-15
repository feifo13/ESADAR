import { Navigate, Route, Routes } from 'react-router-dom';
import RootLayout from './components/RootLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import OfferPage from './pages/OfferPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AdminArticlesPage from './pages/admin/AdminArticlesPage.jsx';
import AdminArticleFormPage from './pages/admin/AdminArticleFormPage.jsx';
import AdminOrdersPage from './pages/admin/AdminOrdersPage.jsx';
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="articles/:slugOrId" element={<ArticlePage />} />
        <Route path="articles/:slugOrId/offer" element={<OfferPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="checkout" element={<Navigate to="/checkout/resumen" replace />} />
        <Route path="checkout/resumen" element={<CheckoutPage />} />
        <Route path="checkout/comprador" element={<CheckoutPage />} />
        <Route path="checkout/pago" element={<CheckoutPage />} />
        <Route path="checkout/envio" element={<CheckoutPage />} />
        <Route path="checkout/confirmacion" element={<CheckoutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route
          path="admin/articles"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminArticlesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/articles/new"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminArticleFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/articles/:id/edit"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminArticleFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/orders"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/orders/:id"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminOrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
