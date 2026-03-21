import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          const errInfo = {
            error: error.message,
            operationType: 'get',
            path: `users/${firebaseUser.uid}`,
            authInfo: {
              userId: firebaseUser.uid,
              email: firebaseUser.email,
              emailVerified: firebaseUser.emailVerified,
              isAnonymous: firebaseUser.isAnonymous,
            }
          };
          console.error("Profile snapshot error:", JSON.stringify(errInfo));
          setLoading(false);
        });
        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
