import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import I18nDocumentSync from './components/I18nDocumentSync';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import { useProductStore } from './store/productStore';

import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import ToastProvider from './components/admin/ui/Toast';

const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage'));

const AboutPage = lazy(() => import('./pages/AboutPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminStock = lazy(() => import('./pages/admin/AdminStock'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminOrderLeads = lazy(() => import('./pages/admin/AdminOrderLeads'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPaymentsV2'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomersV2'));
const AdminDirectSales = lazy(() => import('./pages/admin/AdminDirectSales'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="w-8 h-8 rounded-full border-2 border-[#E4E1D5]/30 border-t-[#E4E1D5]"
      />
    </div>
  );
}

function App() {
  const fetchProducts = useProductStore((s) => s.fetchProducts);

  useEffect(() => {
    const load = () => {
      void fetchProducts(false);
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }

    const timer = window.setTimeout(load, 150);
    return () => window.clearTimeout(timer);
  }, [fetchProducts]);

  return (
    <BrowserRouter>
      <I18nDocumentSync />
      <ToastProvider>
      <Routes>
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<Suspense fallback={<PageFallback />}><AdminPage /></Suspense>} />
        
        {/* Nouvelles routes d'administration protégées */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<Suspense fallback={<PageFallback />}><AdminDashboard /></Suspense>} />
            <Route path="/admin/products" element={<Suspense fallback={<PageFallback />}><AdminProducts /></Suspense>} />
            <Route path="/admin/stock" element={<Suspense fallback={<PageFallback />}><AdminStock /></Suspense>} />
            <Route path="/admin/orders" element={<Suspense fallback={<PageFallback />}><AdminOrders /></Suspense>} />
            <Route path="/admin/leads" element={<Suspense fallback={<PageFallback />}><AdminOrderLeads /></Suspense>} />
            <Route path="/admin/direct-sales" element={<Suspense fallback={<PageFallback />}><AdminDirectSales /></Suspense>} />
            <Route path="/admin/payments" element={<Suspense fallback={<PageFallback />}><AdminPayments /></Suspense>} />
            <Route path="/admin/customers" element={<Suspense fallback={<PageFallback />}><AdminCustomers /></Suspense>} />
            <Route path="/admin/reports" element={<Suspense fallback={<PageFallback />}><AdminReports /></Suspense>} />
          </Route>
        </Route>

        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<Suspense fallback={<PageFallback />}><CatalogPage /></Suspense>} />
          <Route path="product/:id" element={<Suspense fallback={<PageFallback />}><ProductDetailPage /></Suspense>} />
          <Route path="about" element={<Suspense fallback={<PageFallback />}><AboutPage /></Suspense>} />
          <Route path="contact" element={<Suspense fallback={<PageFallback />}><ContactPage /></Suspense>} />
          <Route path="faq" element={<Suspense fallback={<PageFallback />}><FAQPage /></Suspense>} />
          <Route path="returns" element={<Suspense fallback={<PageFallback />}><ReturnsPage /></Suspense>} />
          <Route path="confirmation" element={<Suspense fallback={<PageFallback />}><ConfirmationPage /></Suspense>} />
          <Route path="legal" element={<Suspense fallback={<PageFallback />}><LegalPage /></Suspense>} />
          <Route path="privacy" element={<Suspense fallback={<PageFallback />}><PrivacyPage /></Suspense>} />
        </Route>
      </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
