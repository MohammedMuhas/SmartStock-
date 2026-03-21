import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  CreditCard, 
  LogOut, 
  User as UserIcon,
  ShieldCheck,
  Menu,
  X,
  ArrowLeft,
  Loader2,
  Lightbulb
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { SupportModal } from './SupportModal';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange }) => {
  const { profile, isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'sales', label: 'Daily Sales', icon: ShoppingCart },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'profile', label: 'Profile Settings', icon: UserIcon },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: ShieldCheck });
  }

  const handleSignOut = () => {
    signOut(auth);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {activeView !== 'dashboard' ? (
            <button 
              onClick={() => onViewChange('dashboard')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          ) : (
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Package className="text-white w-5 h-5" />
            </div>
          )}
          <span className="font-bold text-slate-900 tracking-tight">SmartStock</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-0 z-40 bg-white border-r border-slate-200 w-64 flex-col transition-transform md:relative md:translate-x-0 md:flex",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <Package className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight">SmartStock</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onViewChange(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                activeView === item.id
                  ? "bg-emerald-50 text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeView === item.id ? "text-emerald-600" : "text-slate-400")} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
            <button 
            onClick={() => onViewChange('profile')}
            className="w-full bg-slate-50 rounded-2xl p-4 mb-4 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 overflow-hidden shadow-sm relative">
                {profile?.photoURL ? (
                  <img 
                    src={profile.photoURL} 
                    alt="Logo" 
                    className={cn("w-full h-full object-cover", profile.isUploading && "opacity-40")} 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <UserIcon className="w-5 h-5 text-slate-400" />
                )}
                {profile?.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate tracking-tight">{profile?.displayName || 'User'}</p>
                <div className="flex items-center gap-1">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    {profile?.subscriptionStatus === 'premium' ? 'PRIME' : 'FREE'}
                  </p>
                </div>
              </div>
            </div>
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {activeView !== 'dashboard' && (
            <button 
              onClick={() => onViewChange('dashboard')}
              className="hidden md:flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-semibold">Back to Dashboard</span>
            </button>
          )}
          {children}
        </div>
      </main>

      {/* Floating Support Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsSupportModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white text-amber-500 rounded-full shadow-2xl flex items-center justify-center z-50 border border-slate-100 hover:bg-slate-50 transition-colors group"
        title="Request a Solution"
      >
        <Lightbulb className="w-7 h-7 group-hover:rotate-12 transition-transform" />
        <span className="absolute right-full mr-3 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
          Request a Solution
        </span>
      </motion.button>

      <SupportModal 
        isOpen={isSupportModalOpen} 
        onClose={() => setIsSupportModalOpen(false)} 
      />
    </div>
  );
};
