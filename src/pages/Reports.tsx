import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Product, Sale } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  Download,
  Calendar,
  Package,
  ArrowRight,
  Lock
} from 'lucide-react';
import { motion } from 'motion/react';
import { subDays, isBefore, parseISO, format, isValid } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

export const Reports: React.FC = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const productsQuery = query(collection(db, 'products'), where('ownerId', '==', user.uid));
    const salesQuery = query(collection(db, 'sales'), where('ownerId', '==', user.uid), orderBy('soldAt', 'desc'));

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubSales();
    };
  }, [user]);

  // Dead stock logic
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

  // Top selling products
  const productSalesMap: { [key: string]: { name: string, count: number, revenue: number, profit: number } } = {};
  sales.forEach(sale => {
    if (!productSalesMap[sale.productId]) {
      productSalesMap[sale.productId] = { name: sale.productName, count: 0, revenue: 0, profit: 0 };
    }
    productSalesMap[sale.productId].count += sale.quantitySold;
    productSalesMap[sale.productId].revenue += sale.totalAmount;
    
    // Profit = Total Amount - (Cost Price * Quantity Sold)
    const costOfGoodsSold = (sale.costPrice || 0) * sale.quantitySold;
    productSalesMap[sale.productId].profit += (sale.totalAmount - costOfGoodsSold);
  });

  const topSelling = Object.values(productSalesMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Daily sales summary (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i));
  const dailySummary = last7Days.map(date => {
    const daySales = sales.filter(s => new Date(s.soldAt).toDateString() === date.toDateString());
    const revenue = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const cost = daySales.reduce((acc, s) => acc + ((s.costPrice || 0) * s.quantitySold), 0);
    
    return {
      date: format(date, 'MMM dd'),
      revenue: revenue,
      profit: revenue - cost,
      count: daySales.reduce((acc, s) => acc + s.quantitySold, 0)
    };
  }).reverse();

  const handleExportPDF = () => {
    if (profile?.subscriptionStatus !== 'premium') return;

    const doc = new jsPDF();
    const dateStr = format(new Date(), 'dd-MMM-yyyy');

    // Header
    doc.setFontSize(22);
    doc.setTextColor(5, 150, 105); // Emerald 600
    doc.text('SmartStock Inventory Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${dateStr}`, 14, 30);
    doc.text(`Shop: ${profile?.displayName || 'My Shop'}`, 14, 35);

    // Summary Stats
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Inventory Summary', 14, 50);
    
    const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalCost = sales.reduce((acc, s) => acc + ((s.costPrice || 0) * s.quantitySold), 0);
    const totalProfit = totalRevenue - totalCost;

    const summaryData = [
      ['Total Products', products.length.toString()],
      ['Total Stock Value (Selling)', `INR ${products.reduce((acc, p) => acc + (p.price * p.quantity), 0)}`],
      ['Total Stock Value (Cost)', `INR ${products.reduce((acc, p) => acc + ((p.costPrice || 0) * p.quantity), 0)}`],
      ['Total Sales Revenue', `INR ${totalRevenue}`],
      ['Total Profit Margin', `INR ${totalProfit}`],
      ['Low Stock Items', products.filter(p => p.quantity < 5).length.toString()],
      ['Dead Stock Items', deadStockItems.length.toString()]
    ];

    autoTable(doc, {
      startY: 55,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105] }
    });

    // Top Selling
    doc.text('Top Selling Products', 14, (doc as any).lastAutoTable.finalY + 15);
    const topSellingData = topSelling.map((item, idx) => [
      (idx + 1).toString(),
      item.name,
      item.count.toString(),
      `INR ${item.revenue}`,
      `INR ${item.profit}`
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['#', 'Product', 'Qty Sold', 'Revenue', 'Profit']],
      body: topSellingData,
      theme: 'grid'
    });

    // Dead Stock
    if (deadStockItems.length > 0) {
      doc.text('Dead Stock Report (30+ Days)', 14, (doc as any).lastAutoTable.finalY + 15);
      const deadStockData = deadStockItems.map(item => [
        item.name,
        item.category,
        item.quantity.toString(),
        item.lastSoldAt ? format(parseISO(item.lastSoldAt), 'MMM dd, yyyy') : 'Never'
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Product', 'Category', 'Stock', 'Last Sold']],
        body: deadStockData,
        theme: 'striped'
      });
    }

    doc.save(`SmartStock_Report_${dateStr}.pdf`);
    toast.success('PDF Report downloaded successfully!');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500">Analyze your shop's performance and inventory health.</p>
        </div>
        {profile?.subscriptionStatus === 'premium' ? (
          <button 
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
          >
            <Download className="w-4 h-4" /> Download Invoice
          </button>
        ) : (
          <button 
            onClick={() => toast.info('Prime Feature', {
              description: 'Upgrade to Prime to download professional PDF reports and invoices.',
              action: {
                label: 'Upgrade',
                onClick: () => {} // This is handled by the parent component or navigation
              }
            })} 
            className="flex items-center justify-center gap-2 bg-slate-100 text-slate-400 border border-slate-200 px-6 py-3 rounded-xl font-bold cursor-not-allowed group relative"
          >
            <Lock className="w-4 h-4" /> Download Invoice
          </button>
        )}
      </div>

      {/* Daily Sales Chart (Simulated with CSS) */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Revenue (Last 7 Days)
          </h2>
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-emerald-500 rounded-full" /> Revenue
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500 rounded-full" /> Profit
            </div>
          </div>
        </div>
        
        {profile?.subscriptionStatus === 'free' ? (
          <div className="h-48 w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
            <Lock className="w-6 h-6 text-amber-500 mb-2" />
            <p className="text-slate-900 font-bold text-sm">Prime Feature</p>
            <p className="text-slate-500 text-xs mt-1">Upgrade to unlock detailed revenue analytics.</p>
          </div>
        ) : (
          <div className="flex items-end justify-between h-48 gap-2">
            {dailySummary.map((day, idx) => {
              const maxVal = Math.max(...dailySummary.map(d => Math.max(d.revenue, d.profit)), 1000);
              const revHeight = (day.revenue / maxVal) * 100;
              const profitHeight = (day.profit / maxVal) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-full h-full flex items-end justify-center gap-1 relative group">
                    {/* Revenue Bar */}
                    <div className="w-full relative h-full flex items-end">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${revHeight}%` }}
                        className="w-full bg-emerald-500 rounded-t-sm transition-all"
                      />
                    </div>
                    {/* Profit Bar */}
                    <div className="w-full relative h-full flex items-end">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${profitHeight}%` }}
                        className="w-full bg-blue-500 rounded-t-sm transition-all"
                      />
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                      <p>Rev: ₹{day.revenue}</p>
                      <p className="text-blue-300">Profit: ₹{day.profit}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{day.date}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Selling Products */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Top Selling Products
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {topSelling.length > 0 ? topSelling.map((item, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-500 text-xs">
                    #{idx + 1}
                  </div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{item.count} Sold</p>
                  <p className="text-xs text-emerald-600 font-bold">Rev: ₹{item.revenue}</p>
                  <p className="text-[10px] text-blue-600 font-bold">Profit: ₹{item.profit}</p>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center text-slate-400">No sales data yet.</div>
            )}
          </div>
        </div>

        {/* Dead Stock Report */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-500" />
              Dead Stock Detect (30+ Days)
            </h2>
            {profile?.subscriptionStatus === 'free' && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">Premium Feature</span>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {profile?.subscriptionStatus === 'premium' ? (
              deadStockItems.length > 0 ? deadStockItems.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">Last Sold: {item.lastSoldAt ? format(parseISO(item.lastSoldAt), 'MMM dd, yyyy') : 'Never'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-600">{item.quantity} in stock</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Clearance Needed</p>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-slate-400">No dead stock detected. Your inventory is moving well!</div>
              )
            ) : (
              <div className="p-12 text-center space-y-4">
                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto">
                  <Clock className="text-rose-400 w-6 h-6" />
                </div>
                <p className="text-slate-500 text-sm max-w-[240px] mx-auto">Upgrade to Premium to unlock Dead Stock detection and advanced reports.</p>
                <button className="text-emerald-600 font-bold text-sm hover:underline">Upgrade Now</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
