'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
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
    const timeout = setTimeout(() => setLoading(false), 8000);

    // Process redirect result (mobile sign-in comes back here)
    getRedirectResult(auth).catch(() => {});

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
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    try {
      if (isMobile) {
        // Mobile: use redirect (popup blocked / sessionStorage issue on iOS)
        await signInWithRedirect(auth, provider);
        // Page navigates away — code below won't run on mobile
      } else {
        // Desktop: use popup for better UX
        await signInWithPopup(auth, provider);
      }
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
