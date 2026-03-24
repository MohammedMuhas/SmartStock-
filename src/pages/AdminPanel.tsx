import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, where, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../types';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  Package,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Key,
  Copy,
  RefreshCw,
  Lock,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export const AdminPanel: React.FC = () => {
  const { isAdmin, user, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Generator state
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const generateCredentials = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const randomString = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    
    const email = `shop_${randomString(6)}@smartstock.app`;
    const password = randomString(12);
    
    setGeneratedEmail(email);
    setGeneratedPassword(password);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (!isAdmin) {
    const isAuthorizedEmail = profile?.email === 'mohamedmukasin@gmail.com';

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10 text-rose-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Access Restricted</h1>
          <p className="text-slate-500 max-w-xs mx-auto">This area is reserved for platform administrators only.</p>
        </div>
        
        {isAuthorizedEmail && (
          <div className="pt-8 border-t border-slate-100 w-full max-w-xs">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Secret Access</p>
            <input 
              type="password" 
              placeholder="Enter Admin Key"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && user) {
                  const val = (e.target as HTMLInputElement).value;
                  if (val === 'SMART_ADMIN_2026') {
                    try {
                      await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
                      toast.success('Admin access granted!');
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
                    }
                  } else {
                    toast.error('Invalid admin key');
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    );
  }

  const premiumUsers = users.filter(u => u.subscriptionStatus === 'premium');
  const totalRevenue = premiumUsers.length * 299;

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Premium Subscribers', value: premiumUsers.length, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Revenue', value: `₹${totalRevenue}`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            Admin Dashboard
          </h1>
          <p className="text-slate-500">Monitor platform growth and user activity.</p>
        </div>
        
        <button 
          onClick={() => setShowGenerator(!showGenerator)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
        >
          <Key className="w-4 h-4" />
          {showGenerator ? 'Hide Generator' : 'Credential Generator'}
        </button>
      </div>

      <AnimatePresence>
        {showGenerator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-xl shadow-emerald-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Lock className="w-32 h-32" />
              </div>
              
              <div className="relative z-10">
                <h2 className="text-xl font-bold mb-2">Secret Credential Generator</h2>
                <p className="text-emerald-100/70 text-sm mb-6">Generate temporary login details for new shop owners.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-emerald-800/50 p-4 rounded-2xl border border-emerald-700/50">
                    <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mb-1">Generated Email</p>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{generatedEmail || 'Click generate...'}</span>
                      {generatedEmail && (
                        <button onClick={() => copyToClipboard(generatedEmail, 'Email')} className="p-2 hover:bg-emerald-700 rounded-lg transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-emerald-800/50 p-4 rounded-2xl border border-emerald-700/50">
                    <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mb-1">Generated Password</p>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{generatedPassword || 'Click generate...'}</span>
                      {generatedPassword && (
                        <button onClick={() => copyToClipboard(generatedPassword, 'Password')} className="p-2 hover:bg-emerald-700 rounded-lg transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={generateCredentials}
                  className="w-full sm:w-auto px-8 py-3 bg-white text-emerald-900 rounded-xl font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Generate New Credentials
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{user.displayName}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      user.subscriptionStatus === 'premium' 
                        ? "bg-emerald-100 text-emerald-700" 
                        : "bg-slate-100 text-slate-500"
                    )}>
                      {user.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-600">
                      {user.role === 'shop_owner' ? 'Shop Owner' : 'Admin'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
