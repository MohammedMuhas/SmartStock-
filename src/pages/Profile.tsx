import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { User, Phone, Mail, Save, Loader2, CheckCircle2, Camera, Image as ImageIcon, ArrowLeft, Bell, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import imageCompression from 'browser-image-compression';
import { NotificationService } from '../services/notificationService';

export const Profile: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { profile, user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(prev => prev || profile.displayName || '');
      setWhatsappNumber(prev => prev || profile.whatsappNumber || '');
      setNotificationsEnabled(profile.notificationsEnabled || false);
      // Only update image preview from profile if we're not currently picking a new one
      if (!imageFile) {
        setImagePreview(profile.photoURL || null);
      }
    }
  }, [profile, imageFile]);

  const toggleNotifications = async () => {
    const newState = !notificationsEnabled;
    if (newState) {
      const granted = await NotificationService.requestPermission();
      if (!granted) {
        toast.info('Browser notifications are blocked in this preview, but we will use in-app alerts instead.', {
          description: 'To get real system-level alerts, please open the app in a new tab.',
          duration: 5000,
        });
      }
    }
    setNotificationsEnabled(newState);
  };

  const testNotification = async () => {
    if (!notificationsEnabled) {
      toast.info('Please enable notifications first.');
      return;
    }
    await NotificationService.showNotification('Test Notification', {
      body: 'If you see this, your notifications are working correctly!',
      tag: 'test-notification'
    });
    toast.success('Test notification sent!');
  };

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
        toast.info('Image selected. Click "Save Changes" to upload.', {
          icon: <ImageIcon className="w-4 h-4" />,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    // Loading toast removed as per user request
    
    try {
      let photoURL = profile?.photoURL || '';

      if (imageFile) {
        setIsUploadingLogo(true);
        // Update Firestore to show uploading state globally
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            isUploading: true
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        }
        
        const options = {
          maxSizeMB: 2,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          initialQuality: 0.8
        };
        
        try {
          const compressedFile = await imageCompression(imageFile, options);
          const fileExtension = imageFile.name.split('.').pop() || 'jpg';
          const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_logo.${fileExtension}`);
          
          // Use uploadBytesResumable for better reliability
          const uploadTask = uploadBytesResumable(storageRef, compressedFile);
          
          photoURL = await new Promise((resolve, reject) => {
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
        } catch (compressionError) {
          console.error('Compression error:', compressionError);
          const fileExtension = imageFile.name.split('.').pop() || 'jpg';
          const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_logo.${fileExtension}`);
          
          const uploadTaskFallback = uploadBytesResumable(storageRef, imageFile);
          
          photoURL = await new Promise((resolve, reject) => {
            uploadTaskFallback.on('state_changed', 
              null, 
              (error) => reject(error), 
              async () => {
                const downloadURL = await getDownloadURL(uploadTaskFallback.snapshot.ref);
                resolve(downloadURL);
              }
            );
          });
        } finally {
          setIsUploadingLogo(false);
        }
      }

      try {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName,
          whatsappNumber,
          photoURL,
          notificationsEnabled,
          isUploading: false,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
      
      toast.success('Profile updated successfully!');
      setImageFile(null); // Clear the file after successful upload
    } catch (error) {
      // If it's a firestore error already handled, don't show generic toast
      if (!(error instanceof Error && error.message.startsWith('{'))) {
        console.error('Error updating profile:', error);
        toast.error('Failed to update profile. Please try again.');
      }
      
      // Clear uploading flag in Firestore on error
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          isUploading: false
        });
      } catch (err) {
        console.error('Error clearing isUploading:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors group md:hidden"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-semibold">Back</span>
          </button>
        )}
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-slate-500">Manage your account information and contact details.</p>
      </div>

      <AnimatePresence mode="wait">
        {/* Loading overlay removed as per user request */}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-6 mb-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all group"
          >
            <div className="relative">
              <div 
                className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center border-2 border-emerald-100 shadow-sm overflow-hidden group-hover:border-emerald-500 transition-all relative"
              >
                {(profile?.isUploading || loading) ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Updating...</span>
                  </div>
                ) : imagePreview ? (
                  <img 
                    key={imagePreview}
                    src={imagePreview} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/shop/200/200';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <ImageIcon className="w-8 h-8 mb-1" />
                    <span className="text-[10px] font-bold">UPLOAD LOGO FROM GALLERY</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              {profile?.subscriptionStatus === 'premium' && (
                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg z-10">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Account Status</p>
              <div className="flex flex-col">
                <span className={cn(
                  "text-xl font-black tracking-tight",
                  profile?.subscriptionStatus === 'premium' ? "text-emerald-600" : "text-slate-600"
                )}>
                  {profile?.subscriptionStatus === 'premium' ? 'SMARTSTOCK PRIME' : 'FREE PLAN'}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <ImageIcon className="w-3 h-3 text-emerald-500" />
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Click to upload gallery image</p>
                </div>
              </div>
            </div>
          </div>
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
            accept="image/*"
          />

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Shop Name / Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                placeholder="Your Shop Name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={profile?.email || ''}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed outline-none"
              />
              <p className="text-[10px] text-slate-400 ml-1">Email cannot be changed.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                WhatsApp Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                  placeholder="919876543210"
                />
              </div>
              <p className="text-[10px] text-slate-400 ml-1">Include country code without + (e.g., 91 for India). This is used for sending welcome messages and notifications.</p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    notificationsEnabled ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"
                  )}>
                    {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Browser Notifications</p>
                    <p className="text-[10px] text-slate-500">Daily alerts at 9:00 AM and 8:00 PM.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleNotifications}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    notificationsEnabled ? "bg-emerald-600" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    notificationsEnabled ? "left-7" : "left-1"
                  )} />
                </button>
              </div>
              
              {notificationsEnabled && (
                <div className="mt-3 px-4">
                  <button
                    type="button"
                    onClick={testNotification}
                    className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex items-center gap-1 group"
                  >
                    <Bell className="w-3 h-3 group-hover:animate-bounce" />
                    Send Test Notification
                  </button>
                </div>
              )}

            </div>
          </div>


          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
