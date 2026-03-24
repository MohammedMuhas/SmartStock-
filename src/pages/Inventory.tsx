import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Product } from '../types';
import { cn } from '../lib/utils';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Package, 
  Filter,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Upload,
  Palette,
  Layers,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { toast } from 'sonner';

export const Inventory: React.FC = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'out'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    size: '',
    color: '',
    material: '',
    supplier: '',
    quantity: 0,
    price: 0,
    costPrice: 0,
    discountPrice: 0,
    taxRate: 0
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Derive current viewing product from products array to keep it in sync
  const currentViewingProduct = viewingProduct 
    ? products.find(p => p.id === viewingProduct.id) || viewingProduct 
    : null;

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'products'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      // Sort by createdAt desc in memory to ensure newest is always at top
      fetchedProducts.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setProducts(fetchedProducts);
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'products');
      } catch (e) {
        console.error("Products fetch error handled:", e);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      category: '',
      size: '',
      color: '',
      material: '',
      supplier: '',
      quantity: 0,
      price: 0,
      costPrice: 0,
      discountPrice: 0,
      taxRate: 0
    });
    setImageFile(null);
    setImagePreview(null);
    setViewingProduct(null);
    setIsViewModalOpen(false);
    setEditingProduct(null);
  }, []);

  const handleViewProduct = (product: Product) => {
    setViewingProduct(product);
    setImageLoading(true);
    setIsViewModalOpen(true);
  };

  const handleOpenModal = useCallback((product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        size: product.size,
        color: product.color || '',
        material: product.material || '',
        supplier: product.supplier || '',
        quantity: product.quantity,
        price: product.price,
        costPrice: product.costPrice || 0,
        discountPrice: product.discountPrice || 0,
        taxRate: product.taxRate || 0
      });
      setImagePreview(product.imageUrl || null);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  }, [resetForm]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (20MB limit)
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('Image size too large. Maximum allowed size is 20MB.');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Subscription check
    if (!editingProduct && profile?.subscriptionStatus === 'free' && products.length >= 50) {
      toast.error('Free plan limit reached (50 products). Please upgrade to Premium for unlimited products.');
      return;
    }

    setSubmitting(true);
    
    const productRef = editingProduct 
      ? doc(db, 'products', editingProduct.id) 
      : doc(collection(db, 'products'));

    try {
      const now = new Date().toISOString();
      let imageUrl = editingProduct?.imageUrl || '';

      const productId = productRef.id;

      // 1. Prepare initial product data
      const productData: any = {
        ...formData,
        imageUrl,
        quantity: Number(formData.quantity),
        price: Number(formData.price),
        costPrice: Number(formData.costPrice),
        discountPrice: Number(formData.discountPrice) || 0,
        taxRate: Number(formData.taxRate) || 0,
        ownerId: user.uid,
        updatedAt: now,
        isUploading: false, // Default to false
      };

      // 2. Handle image upload if needed
      if (imageFile) {
        try {
          // Set uploading state in Firestore for real-time feedback
          if (editingProduct) {
            try {
              await updateDoc(productRef, { isUploading: true });
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, `products/${productRef.id}`);
            }
          } else {
            // For new products, create the document immediately with isUploading: true
            // so the user sees it in the list with a loading state
            try {
              await setDoc(productRef, {
                ...productData,
                isUploading: true,
                createdAt: now,
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `products/${productRef.id}`);
            }
          }

          // Compress image
          const options = {
            maxSizeMB: 2,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
            initialQuality: 0.8
          };
          
          let fileToUpload: File | Blob = imageFile;
          try {
            fileToUpload = await imageCompression(imageFile, options);
          } catch (compressionError) {
            console.error('Compression error:', compressionError);
          }

          const fileExtension = imageFile.name.split('.').pop() || 'jpg';
          const storageRef = ref(storage, `products/${user.uid}/${Date.now()}_product.${fileExtension}`);
          
          // Use uploadBytesResumable for better reliability
          const uploadTask = uploadBytesResumable(storageRef, fileToUpload);
          
          imageUrl = await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
              }, 
              (error) => {
                console.error('Upload error:', error);
                reject(error);
              }, 
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              }
            );
          });
          
          // Update productData with the new imageUrl
          productData.imageUrl = imageUrl;
          productData.isUploading = false;
        } catch (error) {
          console.error('Image upload error:', error);
          productData.isUploading = false;
          // Even if upload fails, we should clear the uploading state in Firestore
          await updateDoc(productRef, { isUploading: false }).catch(() => {});
          toast.error('Image upload failed, but product details were saved.');
        }
      } else {
        productData.isUploading = false;
      }

      // 3. Save final product details
      if (editingProduct) {
        try {
          await updateDoc(productRef, {
            ...productData,
          });
          toast.success('Product updated successfully!');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `products/${productRef.id}`);
        }
      } else {
        try {
          await setDoc(productRef, {
            ...productData,
            createdAt: now,
          });
          toast.success('Product added successfully!');
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `products/${productRef.id}`);
        }
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product.');
      // Clear uploading flag in Firestore on error for both new and existing products
      if (productRef) {
        await updateDoc(productRef, { isUploading: false }).catch(err => console.error('Error clearing isUploading:', err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setProductToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      toast.success('Product deleted successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productToDelete}`);
    } finally {
      setProductToDelete(null);
    }
  };

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' ? true :
                         filterType === 'low' ? p.quantity > 0 && p.quantity < 5 :
                         filterType === 'out' ? p.quantity === 0 : true;
    
    const matchesCategory = selectedCategory === 'all' ? true : p.category === selectedCategory;

    return matchesSearch && matchesFilter && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500">Manage your shop's clothing stock.</p>
          {profile?.subscriptionStatus === 'free' && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    products.length >= 45 ? "bg-rose-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min((products.length / 50) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {products.length}/50 Products Used
              </span>
            </div>
          )}
        </div>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
        >
          <Plus className="w-5 h-5" /> Add New Product
        </motion.button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            >
              <option value="all">All Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? filteredProducts.map((product) => (
                <tr key={product.id} 
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  onClick={() => handleViewProduct(product)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 overflow-hidden border border-slate-200 shrink-0 relative">
                        {product.isUploading ? (
                          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                        ) : product.imageUrl ? (
                          <img 
                            key={product.imageUrl}
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/error/200/200';
                            }}
                          />
                        ) : (
                          <Package className="w-6 h-6" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 block truncate">{product.name}</span>
                        {product.color && <span className="text-[10px] text-slate-400 uppercase font-bold">{product.color}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    <div>
                      <p className="font-medium">{product.category}</p>
                      {product.supplier && <p className="text-[10px] text-slate-400 font-bold truncate">By: {product.supplier}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase">{product.size}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold",
                        product.quantity < 5 ? "text-amber-600" : "text-slate-900"
                      )}>
                        {product.quantity}
                      </span>
                      {product.quantity < 5 && <AlertCircle className="w-4 h-4 text-amber-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={cn("font-bold text-slate-900", product.discountPrice && product.discountPrice > 0 && "text-xs line-through text-slate-400")}>
                        ₹{product.price}
                      </span>
                      {product.discountPrice && product.discountPrice > 0 && (
                        <span className="font-bold text-emerald-600">₹{product.discountPrice}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(product);
                        }}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(product.id);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No products found. Add your first product to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      <AnimatePresence>
        {isViewModalOpen && currentViewingProduct && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsViewModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-1/2 h-64 md:h-auto bg-slate-100 relative">
                  {currentViewingProduct.imageUrl ? (
                    <>
                        <img 
                          key={currentViewingProduct.imageUrl}
                          src={currentViewingProduct.imageUrl} 
                          alt={currentViewingProduct.name} 
                          onLoad={() => setImageLoading(false)}
                          className={cn(
                            "w-full h-full object-cover transition-opacity duration-300", 
                            (currentViewingProduct.isUploading || imageLoading) ? "opacity-50" : "opacity-100"
                          )} 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/error/200/200';
                            setImageLoading(false);
                          }}
                        />
                      {(currentViewingProduct.isUploading || imageLoading) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              {currentViewingProduct.isUploading ? 'Uploading...' : 'Loading Image...'}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Package className="w-20 h-20" />
                    </div>
                  )}
                  <button 
                    onClick={() => setIsViewModalOpen(false)}
                    className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm md:hidden"
                  >
                    <X className="w-5 h-5 text-slate-900" />
                  </button>
                </div>
                <div className="w-full md:w-1/2 p-8 space-y-6">
                  <div className="hidden md:flex justify-end">
                    <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  <div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-wider">
                      {currentViewingProduct.category}
                    </span>
                    <h2 className="text-3xl font-bold text-slate-900 mt-2">{currentViewingProduct.name}</h2>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className={cn("text-2xl font-bold text-emerald-600", currentViewingProduct.discountPrice && currentViewingProduct.discountPrice > 0 && "text-sm line-through text-slate-400")}>
                        ₹{currentViewingProduct.price}
                      </p>
                      {currentViewingProduct.discountPrice && currentViewingProduct.discountPrice > 0 && (
                        <p className="text-2xl font-bold text-emerald-600">₹{currentViewingProduct.discountPrice}</p>
                      )}
                    </div>
                    {currentViewingProduct.taxRate && currentViewingProduct.taxRate > 0 && (
                      <p className="text-xs text-slate-400 font-medium mt-1">+ {currentViewingProduct.taxRate}% Tax</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Size</p>
                      <p className="text-slate-900 font-semibold">{currentViewingProduct.size}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Stock</p>
                      <p className={cn(
                        "font-semibold",
                        currentViewingProduct.quantity < 5 ? "text-amber-600" : "text-slate-900"
                      )}>{currentViewingProduct.quantity} units</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cost Price</p>
                      <p className="text-slate-900 font-semibold">₹{currentViewingProduct.costPrice}</p>
                    </div>
                    {currentViewingProduct.color && (
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Color</p>
                        <p className="text-slate-900 font-semibold">{currentViewingProduct.color}</p>
                      </div>
                    )}
                    {currentViewingProduct.material && (
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Material</p>
                        <p className="text-slate-900 font-semibold">{currentViewingProduct.material}</p>
                      </div>
                    )}
                    {currentViewingProduct.supplier && (
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Supplier</p>
                        <p className="text-slate-900 font-semibold">{currentViewingProduct.supplier}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      onClick={() => {
                        setIsViewModalOpen(false);
                        handleOpenModal(currentViewingProduct);
                      }}
                      className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Product
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex flex-col items-center justify-center mb-6">
                  <div className="relative">
                    <div className="w-40 h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center overflow-hidden transition-all hover:border-emerald-500 relative group">
                      {submitting ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Uploading...</p>
                        </div>
                      ) : imagePreview ? (
                        <>
                          <img key={imagePreview} src={imagePreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/product/200/200'; }} />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Upload className="w-8 h-8 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-6 h-6 text-emerald-600" />
                          </div>
                          <p className="text-sm font-bold text-slate-900">Upload Image from Gallery</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">Tap to take a picture or upload</p>
                        </div>
                      )}
                      <input 
                        type="file" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handleImageChange} 
                        disabled={submitting}
                      />
                    </div>
                    {imagePreview && !submitting && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Blue Denim Shirt"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Category</label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Shirts"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Size</label>
                    <select
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Select Size</option>
                      <option value="XS">XS</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                      <option value="XXL">XXL</option>
                      <option value="Free Size">Free Size</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <Palette className="w-3 h-3" /> Color
                    </label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="e.g. Navy Blue"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Material
                    </label>
                    <input
                      type="text"
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="e.g. Cotton"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> Supplier
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. Fashion Hub Inc."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Quantity</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Cost Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Price you paid"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Selling Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Discount Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.discountPrice}
                      onChange={(e) => setFormData({ ...formData, discountPrice: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.taxRate}
                      onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{editingProduct ? 'Updating...' : 'Adding...'}</span>
                      </>
                    ) : (
                      editingProduct ? 'Update Product' : 'Add Product'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};
