import { Navigate, Route, Routes } from 'react-router-dom';
import RootLayout from './components/RootLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import OfferPage from './pages/OfferPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import CheckoutCompletePage from './pages/CheckoutCompletePage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import NewsletterPage from './pages/NewsletterPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import AccountOrderDetailPage from './pages/AccountOrderDetailPage.jsx';
import AdminArticlesPage from './pages/admin/AdminArticlesPage.jsx';
import AdminArticleFormPage from './pages/admin/AdminArticleFormPage.jsx';
import BulkArticleCreatePage from './pages/admin/BulkArticleCreatePage.jsx';
import AdminOrdersPage from './pages/admin/AdminOrdersPage.jsx';
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage.jsx';
import AdminOffersPage from './pages/admin/AdminOffersPage.jsx';
import AdminContactMessagesPage from './pages/admin/AdminContactMessagesPage.jsx';
import AdminContactMessageDetailPage from './pages/admin/AdminContactMessageDetailPage.jsx';
import AdminAuditPage from './pages/admin/AdminAuditPage.jsx';
import AdminLeadsPage from './pages/admin/AdminLeadsPage.jsx';
import AdminLeadDetailPage from './pages/admin/AdminLeadDetailPage.jsx';
import AdminWishlistsPage from './pages/admin/AdminWishlistsPage.jsx';
import AdminStatisticsPage from './pages/admin/AdminStatisticsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="articles" element={<HomePage />} />
        <Route path="articulos" element={<Navigate to="/articles" replace />} />
        <Route path="catalogo" element={<Navigate to="/articles" replace />} />
        <Route path="articles/:slugOrId" element={<ArticlePage />} />
        <Route path="articles/:slugOrId/offer" element={<OfferPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="checkout" element={<Navigate to="/checkout/resumen" replace />} />
        <Route path="checkout/resumen" element={<CheckoutPage />} />
        <Route path="checkout/comprador" element={<CheckoutPage />} />
        <Route path="checkout/pago" element={<CheckoutPage />} />
        <Route path="checkout/envio" element={<CheckoutPage />} />
        <Route path="checkout/confirmacion" element={<CheckoutPage />} />
        <Route path="checkout/completa" element={<CheckoutCompletePage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="avisos" element={<NewsletterPage />} />
        <Route path="cuenta" element={<AccountPage />} />
        <Route path="cuenta/perfil" element={<AccountPage />} />
        <Route path="cuenta/preferencias" element={<AccountPage />} />
        <Route path="cuenta/guardados" element={<AccountPage />} />
        <Route path="cuenta/alertas" element={<AccountPage />} />
        <Route path="cuenta/ordenes" element={<AccountPage />} />
        <Route path="cuenta/ordenes/:id" element={<AccountOrderDetailPage />} />
        <Route path="account/orders/:id" element={<AccountOrderDetailPage />} />
        <Route
          path="admin/articles"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminArticlesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/articles/bulk-create"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <BulkArticleCreatePage />
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
        <Route
          path="admin/offers"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminOffersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/contact-messages"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminContactMessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/contact-messages/:id"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminContactMessageDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/wishlists"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminWishlistsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/audit"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminAuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/leads"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminLeadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/leads/:id"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminLeadDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/statistics"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminStatisticsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
