import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isShopOwner: boolean;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  login: (email?: string, password?: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string, whatsappNumber: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isShopOwner: false,
  updateProfile: async () => {},
  login: async () => {},
  signup: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Listen to profile changes
        const unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Profile might be created during signup, but if not (e.g. Google login first time)
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              subscriptionStatus: 'free',
              role: 'shop_owner',
              createdAt: new Date().toISOString(),
              photoURL: firebaseUser.photoURL || ''
            };
            setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const login = async (email?: string, password?: string) => {
    if (email === 'google') {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } else if (email && password) {
      await signInWithEmailAndPassword(auth, email, password);
    }
  };

  const signup = async (email: string, password: string, displayName: string, whatsappNumber: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    await updateFirebaseProfile(firebaseUser, { displayName });

    const newProfile: UserProfile = {
      uid: firebaseUser.uid,
      displayName,
      email,
      whatsappNumber,
      subscriptionStatus: 'free',
      role: 'shop_owner',
      createdAt: new Date().toISOString(),
      photoURL: ''
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), data, { merge: true });
  };

  const isAdmin = profile?.role === 'admin' || profile?.email === 'mohamedmukasin@gmail.com';
  const isShopOwner = profile?.role === 'shop_owner';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isShopOwner, updateProfile, login, signup, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
