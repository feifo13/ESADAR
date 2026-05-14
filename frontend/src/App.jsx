import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RootLayout from './components/RootLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const ArticlePage = lazy(() => import('./pages/ArticlePage.jsx'));
const OfferPage = lazy(() => import('./pages/OfferPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'));
const CheckoutCompletePage = lazy(() => import('./pages/CheckoutCompletePage.jsx'));
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const NewsletterPage = lazy(() => import('./pages/NewsletterPage.jsx'));
const PurchaseGuidePage = lazy(() => import('./pages/PurchaseGuidePage.jsx'));
const TermsAndConditionsPage = lazy(() => import('./pages/TermsAndConditionsPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const AccountOrderDetailPage = lazy(() => import('./pages/AccountOrderDetailPage.jsx'));
const AdminArticlesPage = lazy(() => import('./pages/admin/AdminArticlesPage.jsx'));
const AdminArticleFormPage = lazy(() => import('./pages/admin/AdminArticleFormPage.jsx'));
const AdminArticleStockPage = lazy(() => import('./pages/admin/AdminArticleStockPage.jsx'));
const BulkArticleCreatePage = lazy(() => import('./pages/admin/BulkArticleCreatePage.jsx'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage.jsx'));
const AdminOrderDetailPage = lazy(() => import('./pages/admin/AdminOrderDetailPage.jsx'));
const AdminOffersPage = lazy(() => import('./pages/admin/AdminOffersPage.jsx'));
const AdminContactMessagesPage = lazy(() => import('./pages/admin/AdminContactMessagesPage.jsx'));
const AdminContactMessageDetailPage = lazy(
  () => import('./pages/admin/AdminContactMessageDetailPage.jsx'),
);
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage.jsx'));
const AdminLeadsPage = lazy(() => import('./pages/admin/AdminLeadsPage.jsx'));
const AdminLeadDetailPage = lazy(() => import('./pages/admin/AdminLeadDetailPage.jsx'));
const AdminWishlistsPage = lazy(() => import('./pages/admin/AdminWishlistsPage.jsx'));
const AdminStatisticsPage = lazy(() => import('./pages/admin/AdminStatisticsPage.jsx'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx'));
const AdminUserEditPage = lazy(() => import('./pages/admin/AdminUserEditPage.jsx'));
const AdminCollectingPage = lazy(() => import('./pages/admin/AdminCollectingPage.jsx'));
const AdminShippingPage = lazy(() => import('./pages/admin/AdminShippingPage.jsx'));

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
        <Route path="guia-de-compra" element={<PurchaseGuidePage />} />
        <Route path="terminos-y-condiciones" element={<TermsAndConditionsPage />} />
        <Route path="cuenta" element={<AccountPage />} />
        <Route path="cuenta/perfil" element={<AccountPage />} />
        <Route path="cuenta/preferencias" element={<AccountPage />} />
        <Route path="cuenta/guardados" element={<AccountPage />} />
        <Route path="cuenta/offers" element={<AccountPage />} />
        <Route path="cuenta/ofertas" element={<AccountPage />} />
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
          path="admin/articles/:id/stock"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminArticleStockPage />
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
          path="admin/users"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users/:id/edit"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
              <AdminUserEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/collecting"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
              <AdminCollectingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/shipping"
          element={
            <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR']}>
              <AdminShippingPage />
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
