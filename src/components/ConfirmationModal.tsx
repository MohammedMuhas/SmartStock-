import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}) => {
  const colors = {
    danger: 'bg-rose-600 hover:bg-rose-700 shadow-rose-100',
    warning: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100',
    info: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
  };

  const iconColors = {
    danger: 'text-rose-600 bg-rose-50',
    warning: 'text-amber-600 bg-amber-50',
    info: 'text-emerald-600 bg-emerald-50'
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${iconColors[type]}`}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-500 mb-8">{message}</p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${colors[type]}`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
