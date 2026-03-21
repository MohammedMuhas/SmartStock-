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
  CreditCard
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const Subscription: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = () => {
    if (!user) return;
    
    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
    
    // Demo Mode: If no Razorpay key is configured, allow a direct upgrade for testing
    if (!razorpayKey || razorpayKey === 'rzp_test_dummykey') {
      setLoading(true);
      setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            subscriptionStatus: 'premium',
            paymentId: 'demo_payment_' + Math.random().toString(36).substring(7),
            upgradedAt: new Date().toISOString()
          });
          toast.success('Prime Plan Activated!', {
            description: 'You now have access to all Prime features.',
            duration: 5000,
          });
        } catch (error) {
          console.error('Error upgrading:', error);
          toast.error('Failed to update subscription.');
        } finally {
          setLoading(false);
        }
      }, 1500);
      return;
    }

    setLoading(true);

    const options = {
      key: razorpayKey,
      amount: 29900, // Amount in paise (₹299)
      currency: "INR",
      name: "SmartStock Prime",
      description: "Monthly Subscription",
      handler: async function (response: any) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            subscriptionStatus: 'premium',
            paymentId: response.razorpay_payment_id,
            upgradedAt: new Date().toISOString()
          });
          toast.success('Payment Received! Welcome to Prime.', {
            description: `Payment ID: ${response.razorpay_payment_id}`,
            duration: 5000,
          });
        } catch (error) {
          console.error('Error upgrading:', error);
          toast.error('Failed to update subscription. Please contact support.');
        } finally {
          setLoading(false);
        }
      },
      modal: {
        ondismiss: function() {
          setLoading(false);
        }
      },
      prefill: {
        name: profile?.displayName,
        email: profile?.email
      },
      theme: {
        color: "#059669"
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Razorpay failed to open:', err);
      toast.error('Could not open payment gateway. Check your internet connection.');
      setLoading(false);
    }
  };

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
      buttonText: 'Current Plan',
      buttonAction: null,
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
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Simple, Transparent Pricing</h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
          Choose the plan that's right for your shop. Upgrade or downgrade at any time.
        </p>
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
                onClick={() => plan.buttonAction?.()}
                disabled={!plan.buttonAction || loading}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 mt-8",
                  plan.highlight
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200",
                  !plan.buttonAction && "opacity-50 cursor-default"
                )}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : plan.buttonText}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Comparison */}
      <div className="bg-slate-900 rounded-[3rem] p-12 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <Infinity className="text-emerald-400 w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Unlimited Growth</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Premium users can track as many products as they want. No limits, no worries.</p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <MessageSquare className="text-emerald-400 w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">WhatsApp Alerts</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Get instant notifications on your phone when stock is low. Never miss a sale.</p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <BarChart3 className="text-emerald-400 w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Smart Insights</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Identify dead stock and top performing items with our advanced reporting tools for Prime users.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
