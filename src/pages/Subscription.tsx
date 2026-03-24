import React, { useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Check, 
  Zap, 
  ShieldCheck, 
  MessageSquare, 
  BarChart3, 
  Infinity,
  Loader2,
  Package,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const Subscription: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const [scriptLoaded, setScriptLoaded] = useState(!!window.Razorpay);
  const [isIframe, setIsIframe] = useState(false);

  React.useEffect(() => {
    setIsIframe(window.self !== window.top);
    const checkScript = () => {
      if (window.Razorpay) {
        setScriptLoaded(true);
      }
    };
    
    const interval = setInterval(checkScript, 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setInterval(() => {
        setLoadingTime(prev => prev + 1);
      }, 1000);
    } else {
      setLoadingTime(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  React.useEffect(() => {
    if (loading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [loading]);

  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const runDiagnostic = async () => {
    try {
      const response = await fetch('/api/razorpay/diagnostic');
      const data = await response.json();
      setDiagnosticData(data);
      setShowDiagnostic(true);
    } catch (err) {
      toast.error('Failed to run diagnostic.');
    }
  };

  const completeMockUpgrade = async () => {
    if (!user) return;
    setLoading(true);
    toast.info('Mock Payment Mode', {
      description: 'Simulating a successful payment...',
    });
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionStatus: 'premium',
        paymentMethod: 'mock_gateway',
        upgradedAt: new Date().toISOString()
      });
      toast.success('Mock Upgrade Successful!', {
        description: 'You now have full access to Prime features (Simulated).',
      });
    } catch (err) {
      toast.error('Mock upgrade failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!user) return;

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    
    if (!razorpayKey || razorpayKey === 'rzp_test_dummykey') {
      toast.error('Payment gateway not configured.', {
        description: 'Please set VITE_RAZORPAY_KEY_ID in the app settings.',
      });
      return;
    }

    if (!window.Razorpay) {
      toast.error('Payment gateway failed to load.', {
        description: 'Please check your internet connection or disable ad-blockers.',
      });
      return;
    }

    setLoading(true);

    try {
      const options = {
        key: razorpayKey,
        amount: 29900, // ₹299 in paise
        currency: "INR",
        name: "SmartStock",
        description: "Premium Plan",
        handler: async function (response: any) {
          alert("Payment Successful");
          localStorage.setItem("isPremium", "true");
          
          // Update Firestore for app consistency
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              subscriptionStatus: 'premium',
              upgradedAt: new Date().toISOString()
            });
          } catch (err) {
            console.error('Firestore update failed:', err);
          }
          
          window.location.href = '/dashboard';
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        },
        prefill: {
          name: profile?.displayName || user.displayName || 'User',
          email: profile?.email || user.email || ''
        },
        theme: {
          color: "#059669"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('Razorpay failed to open:', err);
      toast.error('Could not open payment gateway.');
      setLoading(false);
    }
  };

  const handleDowngrade = async () => {
    if (!user) return;
    
    if (!window.confirm('Are you sure you want to downgrade to the Free plan? You will lose access to Prime features.')) {
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionStatus: 'free',
        downgradedAt: new Date().toISOString()
      });
      toast.success('Subscription Updated', {
        description: 'You have been downgraded to the Free plan.',
      });
    } catch (error) {
      console.error('Error downgrading:', error);
      toast.error('Failed to update subscription.');
    } finally {
      setLoading(false);
    }
  };

  const isDummyKey = !import.meta.env.VITE_RAZORPAY_KEY_ID || 
                   import.meta.env.VITE_RAZORPAY_KEY_ID === "rzp_test_SUGn0AqySjAbLV" ||
                   import.meta.env.VITE_RAZORPAY_KEY_ID === "rzp_test_dummykey";

  const plans = [
    {
      name: 'Free',
      price: '₹0',
      description: 'Perfect for getting started',
      features: [
        'Up to 50 products',
        'Basic stock alerts',
        'Basic dashboard',
        'Standard support'
      ],
      current: profile?.subscriptionStatus === 'free',
      buttonText: profile?.subscriptionStatus === 'free' ? 'Current Plan' : 'Downgrade to Free',
      buttonAction: profile?.subscriptionStatus === 'premium' ? handleDowngrade : null,
    },
    {
      name: 'Prime',
      price: '₹299',
      period: '/ month',
      description: 'For growing businesses',
      features: [
        'Unlimited products',
        'Dead stock detection',
        'Advanced sales reports',
        'WhatsApp low stock alerts',
        'Priority support'
      ],
      current: profile?.subscriptionStatus === 'premium',
      buttonText: profile?.subscriptionStatus === 'premium' ? 'Current Plan' : 'Upgrade Now',
      buttonAction: profile?.subscriptionStatus === 'premium' ? null : handleUpgrade,
      highlight: true
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-8">
      {isDummyKey && (
        <div className="p-8 bg-amber-50 border border-amber-200 rounded-[3rem] flex flex-col md:flex-row items-center md:items-start gap-6 animate-in slide-in-from-top duration-500">
          <div className="p-4 bg-amber-100 rounded-3xl shrink-0">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <div className="space-y-3 text-center md:text-left">
            <h3 className="text-xl font-black text-amber-900">Payment Setup Required</h3>
            <p className="text-amber-800 font-medium leading-relaxed max-w-2xl">
              The application is currently using <strong>placeholder (dummy) keys</strong> for Razorpay. 
              Payments will fail until you provide your own real keys from the Razorpay Dashboard.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
              <a 
                href="https://dashboard.razorpay.com/app/keys" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 bg-amber-900 text-white text-xs font-black rounded-xl hover:bg-amber-800 transition-colors uppercase tracking-widest"
              >
                Get Real Keys
              </a>
              <button 
                onClick={() => toast.info("Go to Settings -> Environment Variables in AI Studio to update your keys.")}
                className="px-4 py-2 border-2 border-amber-900 text-amber-900 text-xs font-black rounded-xl hover:bg-amber-100 transition-colors uppercase tracking-widest"
              >
                How to update?
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">Opening Secure Gateway</h3>
              <p className="text-slate-500 font-medium">Please wait while we connect to Razorpay. Do not refresh the page.</p>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-4 text-sm font-bold text-slate-400 uppercase tracking-widest">
              Time Elapsed: {loadingTime}s
            </div>

            {loadingTime > 5 && (
              <div className="space-y-3 pt-2">
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Try in New Tab
                </button>
                <button 
                  onClick={() => setLoading(false)}
                  className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel & Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Simple, Transparent Pricing</h1>
        
        {(!import.meta.env.VITE_RAZORPAY_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID === 'rzp_test_dummykey') && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 max-w-2xl mx-auto flex items-center gap-3 text-amber-800 text-sm font-medium">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-left">Payment gateway is not configured. Please set <code className="bg-amber-100 px-1 rounded">VITE_RAZORPAY_KEY_ID</code> in the app settings to enable upgrades.</p>
          </div>
        )}
        
        {!scriptLoaded && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 max-w-2xl mx-auto flex items-center gap-3 text-rose-800 text-sm font-medium">
            <Loader2 className="w-5 h-5 text-rose-500 animate-spin shrink-0" />
            <p className="flex-1 text-left">Loading payment gateway... Please ensure you have a stable internet connection and ad-blockers are disabled.</p>
            <button 
              onClick={() => window.location.reload()}
              className="text-xs bg-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {plans.map((plan) => (
          <div 
            key={plan.name}
            className={cn(
              "relative bg-white rounded-[2.5rem] p-10 border-2 transition-all duration-300",
              plan.highlight 
                ? "border-emerald-500 shadow-2xl shadow-emerald-100 scale-105 z-10" 
                : "border-slate-100 shadow-sm hover:border-slate-200"
            )}
          >
            {plan.highlight && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                Most Popular
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{plan.name}</h2>
                <p className="text-slate-500 mt-1">{plan.description}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                {plan.period && <span className="text-slate-400 font-medium">{plan.period}</span>}
              </div>

              <div className="space-y-4 pt-6">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center",
                      plan.highlight ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                    )}>
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-slate-600 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                id={plan.name === 'Prime' ? 'payBtn' : undefined}
                onClick={() => plan.buttonAction?.()}
                disabled={!plan.buttonAction || (loading && plan.name === 'Prime')}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold transition-all flex flex-col items-center justify-center gap-2 mt-8",
                  plan.highlight
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200",
                  !plan.buttonAction && "opacity-50 cursor-default"
                )}
              >
                {loading && plan.name === 'Prime' ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : plan.buttonText}
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
