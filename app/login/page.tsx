'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/viewer');
  }, [user, loading, router]);

  async function handleSignIn() {
    setError('');
    setSigningIn(true);
    try {
      await signIn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F7F8FA 0%, #EEF0FC 100%)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '48px 44px',
        boxShadow: '0 8px 32px rgba(0,0,0,.1), 0 1px 4px rgba(0,0,0,.06)',
        width: '100%', maxWidth: 420, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: '#5B6AD0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', boxShadow: '0 4px 14px rgba(91,106,208,.4)',
        }}>
          <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="4" width="14" height="1.8" rx=".9" fill="white"/>
            <rect x="3" y="8.1" width="9" height="1.8" rx=".9" fill="white"/>
            <rect x="3" y="12.2" width="11" height="1.8" rx=".9" fill="white"/>
          </svg>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D0F14', marginBottom: 8, letterSpacing: '-.02em' }}>
          5G Transcript Viewer
        </h1>
        <p style={{ fontSize: 13.5, color: '#4A5568', lineHeight: 1.6, marginBottom: 32 }}>
          View, search and chat with your lecture transcripts using AI.
        </p>

        <button
          onClick={handleSignIn}
          disabled={signingIn}
          style={{
            width: '100%', padding: '12px 20px',
            background: '#fff', border: '1.5px solid #E4E7EC',
            borderRadius: 10, cursor: signingIn ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontSize: 14, fontWeight: 500, color: '#0D0F14',
            boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            opacity: signingIn ? 0.7 : 1,
            transition: 'box-shadow .15s, border-color .15s',
          }}
          onMouseEnter={e => { if (!signingIn) { e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,.12)'; e.currentTarget.style.borderColor = '#C7CDF7'; }}}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.07)'; e.currentTarget.style.borderColor = '#E4E7EC'; }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </button>

        {error && (
          <div style={{
            marginTop: 16, padding: '10px 14px',
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 8, fontSize: 12.5, color: '#DC2626', textAlign: 'left',
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <p style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 20, lineHeight: 1.5 }}>
          Your chats are saved privately and only accessible to you.
        </p>
      </div>
    </div>
  );
}
