import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Lightbulb, Mail, Loader2 } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'sonner';
import { OperationType } from '../types';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [request, setRequest] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim()) {
      toast.error('Please describe your request');
      return;
    }

    setIsSubmitting(true);
    const path = 'support_requests';
    try {
      const data: any = {
        userId: auth.currentUser?.uid || 'anonymous',
        userEmail: auth.currentUser?.email || 'anonymous',
        request: request.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      if (email.trim()) {
        data.contactEmail = email.trim();
      }

      await addDoc(collection(db, path), data);

      // Send email notification via backend
      try {
        await fetch('/api/support', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // We don't block the user if email fails, as the request is already in Firestore
      }

      toast.success('Request submitted successfully! We will review it soon.');
      setRequest('');
      setEmail('');
      onClose();
    } catch (error) {
      console.error('Error submitting support request:', error);
      try {
        handleFirestoreError(error, OperationType.CREATE, path);
      } catch (innerError) {
        // Error already logged to console
      }
      toast.error('Failed to submit request. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Lightbulb className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Request a Solution</h2>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">Any problem. Any request.</h3>
                <p className="text-slate-500 text-sm">
                  Tell us what you need help with and we'll find a solution.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    Your Request <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder="Example: Describe the problem or task you need solved"
                    className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all resize-none text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Email (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  We'll review your request and contact you soon.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Submit Request <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
