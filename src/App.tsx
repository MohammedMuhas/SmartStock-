import React, { useState } from 'react';
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

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');

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

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveView} />;
      case 'inventory':
        return <Inventory />;
      case 'sales':
        return <SalesEntry />;
      case 'reports':
        return <Reports />;
      case 'subscription':
        return <Subscription />;
      case 'admin':
        return <AdminPanel />;
      case 'profile':
        return <Profile onBack={() => setActiveView('dashboard')} />;
      default:
        return <Dashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <Layout activeView={activeView} onViewChange={setActiveView}>
      <Toaster position="top-center" richColors />
      <NotificationManager />
      {renderView()}
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
