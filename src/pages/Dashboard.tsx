import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Product, Sale } from '../types';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Plus, 
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Phone,
  Loader2,
  Zap,
  ShieldCheck,
  BarChart3,
  MessageSquare,
  Infinity
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { subDays, isBefore, parseISO, format, startOfDay, eachDayOfInterval, isValid } from 'date-fns';
import { toast } from 'sonner';
import { generateInvoicePDF, sendWhatsAppInvoice, formatWhatsAppNumber, sendWhatsAppDailySummary } from '../utils/billing';
import { Download, Phone as PhoneIcon, Calendar } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError } from '../lib/firestore-errors';
import { OperationType } from '../types';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [todaySalesList, setTodaySalesList] = useState<Sale[]>([]);
  const [weeklySales, setWeeklySales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSummarySent, setIsSummarySent] = useState(false);

  useEffect(() => {
    if (!user) return;

    const productsQuery = query(
      collection(db, 'products'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const salesQuery = query(
      collection(db, 'sales'),
      where('ownerId', '==', user.uid),
      orderBy('soldAt', 'desc'),
      limit(50)
    );

    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      
      const today = startOfDay(new Date());
      const todaySales = salesData.filter(s => new Date(s.soldAt) >= today);
      setTodaySalesList(todaySales);

      const recent = salesData.slice(0, 5);
      setRecentSales(recent);

      const sevenDaysAgo = subDays(new Date(), 7);
      const weekly = salesData.filter(s => new Date(s.soldAt) >= sevenDaysAgo);
      setWeeklySales(weekly);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
    };
  }, [user]);

  useEffect(() => {
    // Summary sent check logic removed as we'll rely on state/firestore in the future
    // For now, we'll just reset it on mount or keep it in memory
    setIsSummarySent(false);
  }, []);

  const handleSendDailySummary = () => {
    if (todaySalesList.length === 0) {
      toast.info('No sales recorded today to send a summary.');
      return;
    }
    const lowStockItems = products.filter(p => p.quantity < 5);
    if (sendWhatsAppDailySummary(todaySalesList, profile, lowStockItems)) {
      setIsSummarySent(true);
      toast.success('Summary prepared!');
    } else {
      toast.error('Please add your WhatsApp number in Profile Settings first.');
    }
  };

  useEffect(() => {
    if (profile?.subscriptionStatus === 'premium' && profile?.notificationsEnabled) {
      const checkDailySummary = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        if (hours === 21 && minutes === 40) {
          if (!isSummarySent && todaySalesList.length > 0) {
            toast.info('Time for your daily summary!', {
              description: 'Click to send your shop summary to WhatsApp.',
              action: {
                label: 'Send Now',
                onClick: () => handleSendDailySummary()
              },
              duration: 10000
            });
          }
        }
      };

      const interval = setInterval(checkDailySummary, 60000);
      return () => clearInterval(interval);
    }
  }, [profile, todaySalesList]);

  const totalProducts = products.length;
  const lowStockItems = products.filter(p => p.quantity < 5);
  
  // Dead stock: not sold in last 30 days
  const thirtyDaysAgo = subDays(new Date(), 30);
  const deadStockItems = products.filter(p => {
    const dateToCompare = p.lastSoldAt || p.createdAt;
    if (!dateToCompare) return false;
    try {
      const parsedDate = parseISO(dateToCompare);
      return isValid(parsedDate) && isBefore(parsedDate, thirtyDaysAgo) && p.quantity > 0;
    } catch (e) {
      return false;
    }
  });

  const todaySales = weeklySales
    .filter(s => {
      const soldDate = new Date(s.soldAt);
      const today = new Date();
      return soldDate.getDate() === today.getDate() &&
             soldDate.getMonth() === today.getMonth() &&
             soldDate.getFullYear() === today.getFullYear();
    })
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const yesterdaySales = weeklySales
    .filter(s => {
      const soldDate = new Date(s.soldAt);
      const yesterday = subDays(new Date(), 1);
      return soldDate.getDate() === yesterday.getDate() &&
             soldDate.getMonth() === yesterday.getMonth() &&
             soldDate.getFullYear() === yesterday.getFullYear();
    })
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const salesGrowth = yesterdaySales === 0 
    ? (todaySales > 0 ? 100 : 0) 
    : ((todaySales - yesterdaySales) / yesterdaySales) * 100;

  // Prepare chart data
  const chartData = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date()
  }).map(day => {
    const dayStr = format(day, 'MMM dd');
    const daySales = weeklySales
      .filter(s => format(new Date(s.soldAt), 'MMM dd') === dayStr)
      .reduce((acc, s) => acc + s.totalAmount, 0);
    return { name: dayStr, sales: daySales };
  });

  const stats = [
    { 
      label: 'Total Products', 
      value: totalProducts, 
      icon: Package, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      trend: products.filter(p => isBefore(subDays(new Date(), 1), parseISO(p.createdAt))).length,
      trendLabel: 'new today'
    },
    { 
      label: "Today's Sales", 
      value: `₹${todaySales}`, 
      icon: TrendingUp, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      trend: Math.abs(Math.round(salesGrowth)),
      trendType: salesGrowth >= 0 ? 'up' : 'down',
      trendLabel: 'vs yesterday'
    },
    { 
      label: 'Low Stock', 
      value: lowStockItems.length, 
      icon: AlertTriangle, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50',
      trend: lowStockItems.length > 0 ? 'Action needed' : 'All good',
      trendType: 'neutral'
    },
    { 
      label: 'Dead Stock', 
      value: deadStockItems.length, 
      icon: Clock, 
      color: 'text-rose-600', 
      bg: 'bg-rose-50',
      trend: '30+ days',
      trendType: 'neutral'
    },
  ];

  const handleInAppAlert = (item: Product) => {
    toast.info(`Low Stock Detail: ${item.name}`, {
      description: `Category: ${item.category} | Size: ${item.size} | Remaining: ${item.quantity}. Please restock this item soon.`,
      duration: 6000,
    });
  };

  useEffect(() => {
    if (!loading && lowStockItems.length > 0) {
      const lowStockNames = lowStockItems.slice(0, 3).map(p => p.name).join(', ');
      const count = lowStockItems.length;
      toast.warning(`${count} Items are Low in Stock`, {
        description: `Items like ${lowStockNames}${count > 3 ? ' and others' : ''} need restocking.`,
        duration: 8000,
      });
    }
  }, [loading, lowStockItems.length]);

  return (
    <div className="space-y-8">
      {profile && profile.subscriptionStatus === 'premium' && !profile.whatsappNumber && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <Phone className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Add your WhatsApp number</h3>
              <p className="text-sm text-slate-600">Get important notifications and welcome messages on WhatsApp.</p>
            </div>
          </div>
          <Link 
            to="/profile"
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all whitespace-nowrap"
          >
            Add Number Now
          </Link>
        </motion.div>
      )}

      {/* Welcome Section */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex-shrink-0 relative">
              {profile?.photoURL ? (
                <img 
                  key={profile.photoURL}
                  src={profile.photoURL} 
                  alt="Shop Logo" 
                  className={cn("w-full h-full object-cover", profile.isUploading && "opacity-40")} 
                  referrerPolicy="no-referrer" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/shop/200/200';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-50">
                  <Package className="w-8 h-8 text-slate-300" />
                </div>
              )}
              {profile?.isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                  <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back, {profile?.displayName}!</h1>
              <p className="text-slate-500 font-medium">Manage your inventory and track your sales with ease.</p>
            </div>
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <Link 
              to="/inventory"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
            >
              <Plus className="w-5 h-5" /> Add Product
            </Link>
            <Link 
              to="/sales"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all"
            >
              <Plus className="w-5 h-5" /> New Sale
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm group hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              {stat.trend !== undefined && (
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                  stat.trendType === 'up' ? "bg-emerald-50 text-emerald-600" : 
                  stat.trendType === 'down' ? "bg-rose-50 text-rose-600" : 
                  "bg-slate-50 text-slate-500"
                )}>
                  {stat.trendType === 'up' && <ArrowUpRight className="w-3 h-3" />}
                  {stat.trendType === 'down' && <ArrowDownRight className="w-3 h-3" />}
                  {typeof stat.trend === 'number' ? `${stat.trend}${stat.trendLabel === 'vs yesterday' ? '%' : ''}` : stat.trend}
                  <span className="opacity-60">{stat.trendLabel}</span>
                </div>
              )}
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Add Product', icon: Plus, view: 'inventory', color: 'bg-blue-600' },
          { label: 'New Sale', icon: TrendingUp, view: 'sales', color: 'bg-emerald-600' },
          { label: 'View Reports', icon: Calendar, view: 'reports', color: 'bg-purple-600' },
          { label: 'Settings', icon: Package, view: 'profile', color: 'bg-slate-600' },
        ].map((action, idx) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + idx * 0.05 }}
            onClick={() => {}}
            className="flex flex-col items-center gap-3 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all group"
          >
            <Link to={action.view === 'profile' ? '/profile' : `/${action.view}`} className="flex flex-col items-center gap-3">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:rotate-12", action.color)}>
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-700">{action.label}</span>
            </Link>
          </motion.button>
        ))}
      </div>

      {/* Daily Summary Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shadow-sm">
            <Calendar className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Daily Sales Summary</h2>
            <p className="text-sm text-slate-500">
              {isSummarySent 
                ? '✅ Summary already sent for today.' 
                : 'Scheduled for automatic WhatsApp reminder at 9:40 PM daily.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleSendDailySummary}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all",
              isSummarySent
                ? "bg-slate-100 text-slate-500 cursor-default"
                : "bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700"
            )}
            disabled={isSummarySent}
          >
            <PhoneIcon className="w-4 h-4" /> {isSummarySent ? 'Sent Today' : 'Send Summary Now'}
          </button>
        </div>
      </motion.div>

      {/* Sales Chart */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Sales Overview</h2>
            <p className="text-sm text-slate-500">Revenue trend for the last 7 days</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Revenue</span>
          </div>
        </div>

        {profile?.subscriptionStatus === 'free' ? (
          <div className="relative h-[300px] w-full">
            {/* Blurred Demo Chart */}
            <div className="absolute inset-0 blur-[8px] opacity-20 pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { name: 'Day 1', sales: 400 },
                  { name: 'Day 2', sales: 300 },
                  { name: 'Day 3', sales: 600 },
                  { name: 'Day 4', sales: 800 },
                  { name: 'Day 5', sales: 500 },
                  { name: 'Day 6', sales: 900 },
                  { name: 'Day 7', sales: 700 },
                ]}>
                  <Area type="monotone" dataKey="sales" stroke="#10b981" fill="#10b981" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] rounded-3xl p-8 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 border border-slate-100">
                <Lock className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Premium Analytics</h3>
              <p className="text-slate-500 text-sm max-w-xs mb-6">
                Unlock the Sales Overview chart and advanced revenue trends by upgrading to the Prime Plan.
              </p>
              <Link 
                to="/subscription"
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
              >
                Upgrade to Prime
              </Link>
            </div>
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <div className="relative">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {lowStockItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                )}
              </div>
              Low Stock Alerts
            </h2>
            <Link to="/inventory" className="text-sm text-emerald-600 font-semibold hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {lowStockItems.length > 0 ? lowStockItems.slice(0, 5).map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100 shrink-0 relative">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <Package className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.category} • {item.size}</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-sm font-bold text-amber-600">{item.quantity} left</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInAppAlert(item);
                    }}
                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    title="View Alert Details"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center">
                <p className="text-slate-400 text-sm">No low stock items. Great job!</p>
              </div>
            )}
          </div>
        </div>

        {/* Dead Stock Alerts */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-500" />
              Dead Stock (30+ Days)
            </h2>
            <Link to="/inventory" className="text-sm text-emerald-600 font-semibold hover:underline">View All</Link>
          </div>
          
          {profile?.subscriptionStatus === 'free' ? (
            <div className="p-12 text-center bg-slate-50/30 flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 border border-slate-100">
                <Lock className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-slate-900 font-bold text-sm">Prime Feature</p>
              <p className="text-slate-500 text-xs mt-1 mb-4">Upgrade to detect products that haven't sold in 30 days.</p>
              <Link 
                to="/subscription"
                className="text-xs font-bold text-emerald-600 hover:underline uppercase tracking-widest"
              >
                Upgrade Now
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {deadStockItems.length > 0 ? deadStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100 shrink-0 relative">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <Package className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.category} • {item.size}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-rose-600">{item.quantity} in stock</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">No Recent Sales</p>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center">
                  <p className="text-slate-400 text-sm">No dead stock. Everything is moving!</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Recent Sales
            </h2>
            <Link to="/reports" className="text-sm text-emerald-600 font-semibold hover:underline">Full Report</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentSales.length > 0 ? recentSales.map(sale => {
              const product = products.find(p => p.id === sale.productId);
              return (
                <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100 shrink-0 relative">
                      {product?.image ? (
                        <img 
                          src={product.image} 
                          alt={sale.productName} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <Package className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{sale.productName}</p>
                      <p className="text-xs text-slate-500">{new Date(sale.soldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="font-bold text-slate-900">₹{sale.totalAmount}</p>
                    <p className="text-xs text-slate-400">Qty: {sale.quantitySold}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generateInvoicePDF(sale, profile);
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      title="Download Invoice"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sendWhatsAppInvoice(sale, profile)) {
                          toast.success('WhatsApp invoice message prepared!');
                        } else {
                          toast.error('Please add your WhatsApp number in Profile Settings first.');
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      title="WhatsApp Invoice"
                    >
                      <PhoneIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
              <div className="p-12 text-center">
                <p className="text-slate-400 text-sm">No sales recorded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
