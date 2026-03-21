import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Package, Mail, Lock, User, ArrowRight, Loader2, Chrome, Phone } from 'lucide-react';
import { motion } from 'motion/react';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sendWelcomeMessage = (number: string, name: string) => {
    const message = `Hello ${name}! Welcome to SmartStock. We're excited to have you on board!`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${number.replace(/\D/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', user.uid));
      } catch (err: any) {
        const errInfo = {
          error: err.message,
          operationType: 'get',
          path: `users/${user.uid}`,
          authInfo: {
            userId: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            isAnonymous: user.isAnonymous,
          }
        };
        console.error('Firestore Error (getDoc):', JSON.stringify(errInfo));
        throw err;
      }

      if (!userDoc.exists()) {
        const profileData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Shop Owner',
          subscriptionStatus: 'free',
          role: 'user',
          createdAt: new Date().toISOString(),
          whatsappNumber: '', // Default empty for Google sign-in
        };

        try {
          await setDoc(doc(db, 'users', user.uid), profileData);
        } catch (err: any) {
          const errInfo = {
            error: err.message,
            operationType: 'create',
            path: `users/${user.uid}`,
            authInfo: {
              userId: user.uid,
              email: user.email,
              emailVerified: user.emailVerified,
              isAnonymous: user.isAnonymous,
            }
          };
          console.error('Firestore Error (setDoc):', JSON.stringify(errInfo));
          throw err;
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, don't show an error message
        console.log('Sign-in popup closed by user');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Multiple popups were opened, ignore
        console.log('Sign-in popup request cancelled');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email,
          displayName,
          whatsappNumber,
          subscriptionStatus: 'free',
          role: 'user',
          createdAt: new Date().toISOString(),
        });

        if (whatsappNumber) {
          sendWelcomeMessage(whatsappNumber, displayName);
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password login is not enabled in Firebase Console. Please enable it or use Google Sign-in.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-200 mx-auto mb-4">
            <Package className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">SmartStock</h1>
          <p className="text-slate-500 mt-2">Inventory management for small shops</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 ml-1">Shop Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                      placeholder="John's Boutique"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 ml-1">WhatsApp Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="tel"
                      required
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                      placeholder="919876543210"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">Include country code without + (e.g., 91 for India)</p>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
            {message && <p className="text-sm text-emerald-600 font-medium">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isLogin ? 'Sign In' : 'Get Started'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-bold tracking-wider">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-6 w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <Chrome className="w-5 h-5 text-emerald-600" />
            Google Account
          </button>

          <div className="mt-6 flex flex-col gap-3 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
            {isLogin && (
              <button
                onClick={handleResetPassword}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Forgot password?
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
