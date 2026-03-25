import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { SalesEntry } from './pages/SalesEntry';
import { Reports } from './pages/Reports';
import { Subscription } from './pages/Subscription';
import { AdminPanel } from './pages/AdminPanel';
import { Profile } from './pages/Profile';
import { Loader2 } from 'lucide-react';
import { NotificationManager } from './components/NotificationManager';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationService } from './services/notificationService';

const AppContent: React.FC = () => {
  const { user, loading, profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (user && profile?.notificationsEnabled) {
      NotificationService.notifyAppOpen(profile.displayName || 'SmartStock');

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          NotificationService.notifyAppVisible(profile.displayName || 'SmartStock');
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      const interval = setInterval(() => {
        NotificationService.checkScheduledNotifications(profile.displayName || 'SmartStock');
      }, 60000);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(interval);
      };
    }
  }, [user, profile?.notificationsEnabled, profile?.displayName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Layout>
      <Toaster position="top-center" richColors />
      <NotificationManager />
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales" element={<SalesEntry />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
