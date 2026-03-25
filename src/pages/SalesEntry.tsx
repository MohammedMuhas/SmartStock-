import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Product, Sale } from '../types';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { generateInvoicePDF, sendWhatsAppInvoice } from '../utils/billing';
import { toast } from 'sonner';
import { Download, Phone } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError } from '../lib/firestore-errors';
import { OperationType } from '../types';

export const SalesEntry: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantitySold, setQuantitySold] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'products'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      setProducts(productsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    return () => unsubscribe();
  }, [user]);

  const handleRecordSale = async () => {
    if (!user || !selectedProduct) return;
    if (quantitySold > selectedProduct.quantity) {
      toast.error('Not enough stock available!');
      return;
    }

    setSubmitting(true);
    try {
      const basePrice = selectedProduct.discountPrice && selectedProduct.discountPrice > 0 
        ? selectedProduct.discountPrice 
        : selectedProduct.price;
      
      const productTaxRate = selectedProduct.taxRate !== undefined && selectedProduct.taxRate > 0
        ? selectedProduct.taxRate
        : (profile?.taxRate || 0);

      const subtotal = basePrice * quantitySold;
      const taxAmount = (subtotal * productTaxRate) / 100;
      const totalAmount = subtotal + taxAmount;

      const saleData: Omit<Sale, 'id'> = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantitySold,
        soldAt: new Date().toISOString(),
        ownerId: user.uid,
        totalAmount: totalAmount,
        subtotal: subtotal,
        taxAmount: taxAmount,
        taxRate: productTaxRate,
        basePrice: basePrice,
        costPrice: selectedProduct.costPrice || 0
      };

      // 1. Add sale record
      const saleRef = await addDoc(collection(db, 'sales'), saleData);
      setLastSale({ id: saleRef.id, ...saleData });

      // 2. Deduct stock and update lastSoldAt
      const productRef = doc(db, 'products', selectedProduct.id);
      await updateDoc(productRef, {
        quantity: selectedProduct.quantity - quantitySold,
        lastSoldAt: new Date().toISOString(),
      });
      
      // 3. Low stock alert
      const remainingStock = selectedProduct.quantity - quantitySold;
      if (remainingStock < 5) {
        toast.warning(`Low Stock Alert: ${selectedProduct.name} has only ${remainingStock} items left!`, {
          description: 'Consider restocking soon.',
          duration: 5000,
        });
      }

      setSuccess(true);
      toast.success('Sale recorded successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sales');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.quantity > 0
  );

  const basePrice = selectedProduct ? (selectedProduct.discountPrice && selectedProduct.discountPrice > 0 ? selectedProduct.discountPrice : selectedProduct.price) : 0;
  const currentTaxRate = selectedProduct ? (selectedProduct.taxRate !== undefined && selectedProduct.taxRate > 0 ? selectedProduct.taxRate : (profile?.taxRate || 0)) : 0;
  const subtotal = basePrice * quantitySold;
  const taxAmount = (subtotal * currentTaxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/dashboard')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors md:hidden"
        >
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Record Daily Sale</h1>
          <p className="text-slate-500">Select a product and enter the quantity sold.</p>
        </div>
      </div>

      <AnimatePresence>
        {/* Loading overlay removed as per user request */}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Selection */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {filteredProducts.length > 0 ? filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                  selectedProduct?.id === product.id 
                    ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200" 
                    : "bg-white border-slate-100 hover:border-slate-200"
                )}
              >
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100 shrink-0">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <ShoppingCart className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.category} • {product.size}</p>
                </div>
                <div className="text-right">
                  <div className="flex flex-col items-end">
                    <p className={cn("font-bold text-slate-900", product.discountPrice && product.discountPrice > 0 && "text-xs line-through text-slate-400")}>
                      ₹{product.price}
                    </p>
                    {product.discountPrice && product.discountPrice > 0 && (
                      <p className="font-bold text-emerald-600">₹{product.discountPrice}</p>
                    )}
                  </div>
                  <p className={cn("text-xs font-bold", product.quantity < 5 ? "text-amber-600" : "text-slate-400")}>
                    Stock: {product.quantity}
                  </p>
                </div>
              </button>
            )) : (
              <div className="py-12 text-center text-slate-400">
                {searchTerm ? 'No matching products found.' : 'Search for a product to start.'}
              </div>
            )}
          </div>
        </div>

        {/* Sale Details */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedProduct ? (
              <motion.div
                key={selectedProduct.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100 shrink-0">
                    {selectedProduct.imageUrl ? (
                      <img 
                        src={selectedProduct.imageUrl} 
                        alt={selectedProduct.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <ShoppingCart className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedProduct.name}</h2>
                    <div className="flex items-center gap-2">
                      <p className={cn("text-slate-500", selectedProduct.discountPrice && selectedProduct.discountPrice > 0 && "text-xs line-through text-slate-400")}>
                        ₹{selectedProduct.price}
                      </p>
                      {selectedProduct.discountPrice && selectedProduct.discountPrice > 0 && (
                        <p className="text-emerald-600 font-bold">₹{selectedProduct.discountPrice}</p>
                      )}
                      <span className="text-slate-400 text-xs">per unit</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Quantity Sold</p>
                  <div className="flex items-center justify-center gap-6">
                    <button 
                      onClick={() => setQuantitySold(Math.max(1, quantitySold - 1))}
                      className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all"
                    >
                      <Minus className="w-6 h-6" />
                    </button>
                    <span className="text-4xl font-black text-slate-900 w-16 text-center">{quantitySold}</span>
                    <button 
                      onClick={() => setQuantitySold(Math.min(selectedProduct.quantity, quantitySold + 1))}
                      className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                  {quantitySold >= selectedProduct.quantity && (
                    <p className="text-xs text-amber-600 font-medium text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Max stock reached
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 space-y-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({currentTaxRate}%)</span>
                    <span>₹{taxAmount}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-900">Total Amount</span>
                    <span className="text-2xl font-black text-emerald-600">
                      ₹{totalAmount}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleRecordSale}
                  disabled={submitting || success}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2",
                    success 
                      ? "bg-emerald-100 text-emerald-700 shadow-none" 
                      : "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700"
                  )}
                >
                  {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    success ? (
                      <>
                        <CheckCircle2 className="w-6 h-6" />
                        Sale Recorded!
                      </>
                    ) : (
                      <>Record Sale</>
                    )
                  )}
                </button>

                {success && lastSale && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 gap-3 pt-2"
                  >
                    <button
                      onClick={() => generateInvoicePDF(lastSale, profile)}
                      className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all text-sm"
                    >
                      <Download className="w-4 h-4" /> Download Invoice
                    </button>
                    <button
                      onClick={() => {
                        if (sendWhatsAppInvoice(lastSale, profile)) {
                          toast.success('WhatsApp invoice message prepared!');
                        } else {
                          toast.error('Please add your WhatsApp number in Profile Settings first.');
                        }
                      }}
                      className="flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-all text-sm"
                    >
                      <Phone className="w-4 h-4" /> WhatsApp Invoice
                    </button>
                    <button
                      onClick={() => {
                        setSuccess(false);
                        setSelectedProduct(null);
                        setQuantitySold(1);
                        setLastSale(null);
                      }}
                      className="col-span-2 py-2 text-slate-400 text-xs font-bold hover:text-slate-600 transition-all"
                    >
                      New Sale
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center h-full flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                  <ShoppingCart className="text-slate-300 w-8 h-8" />
                </div>
                <p className="text-slate-400 font-medium">Select a product from the list to record a sale.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

