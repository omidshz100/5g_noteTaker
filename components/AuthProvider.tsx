'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { saveUserProfile } from '@/lib/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);

    const unsubscribe = onAuthStateChanged(auth, async u => {
      clearTimeout(timeout);
      setUser(u);
      if (u) {
        try {
          await saveUserProfile(u.uid, {
            name: u.displayName || '',
            email: u.email || '',
            photoURL: u.photoURL || '',
          });
        } catch { /* Firestore rules may not be published yet */ }
      }
      setLoading(false);
    });

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  const signIn = async () => {
    // Set loading BEFORE popup so the viewer page shows a spinner
    // instead of seeing user=null and redirecting to login
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will call setUser + setLoading(false)
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logOut = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
