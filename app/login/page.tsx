'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Image from 'next/image';

const IMAGES = [
  { src: '/baghlava/1.jpg', alt: 'Baghlava — golden layers of pastry and honey' },
  { src: '/baghlava/2.jpeg', alt: 'Baghlava — pistachio and walnut filling' },
  { src: '/baghlava/3.jpeg', alt: 'Baghlava — traditional Turkish sweet pastry' },
];

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/viewer');
  }, [user, loading, router]);

  const goTo = useCallback((idx: number) => {
    if (idx === active) return;
    setFading(true);
    setTimeout(() => {
      setActive(idx);
      setFading(false);
    }, 300);
  }, [active]);

  useEffect(() => {
    const timer = setInterval(() => {
      goTo((active + 1) % IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [active, goTo]);

  async function handleSignIn() {
    setError('');
    setSigningIn(true);
    try {
      await signIn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setSigningIn(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a0a00 0%, #3d1a00 100%)' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid rgba(255,255,255,.15)', borderTopColor: '#C8873A', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .login-panel { animation: fadeUp .55s ease both; }
        .gallery-img {
          transition: opacity .3s ease;
        }
        .gallery-img.fade { opacity: 0; }
        .dot-btn {
          border: none;
          cursor: pointer;
          transition: transform .2s, background .2s;
          padding: 0;
        }
        .dot-btn:hover { transform: scale(1.3); }
        .sign-btn {
          width: 100%; padding: 13px 20px;
          background: #fff; border: 1.5px solid #E4E7EC;
          border-radius: 10px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          font-size: 14px; font-weight: 500; color: #0D0F14;
          box-shadow: 0 1px 4px rgba(0,0,0,.07);
          transition: box-shadow .15s, border-color .15s, transform .1s;
        }
        .sign-btn:hover:not(:disabled) {
          box-shadow: 0 4px 14px rgba(0,0,0,.13);
          border-color: #C8873A;
          transform: translateY(-1px);
        }
        .sign-btn:disabled { opacity: .65; cursor: not-allowed; }
        .tag-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600; letter-spacing: .03em;
          text-transform: uppercase;
        }
        .lang-tab {
          padding: 5px 14px; border-radius: 20px; border: none;
          cursor: pointer; font-size: 12px; font-weight: 600;
          letter-spacing: .02em; transition: background .2s, color .2s;
        }

        @media (max-width: 860px) {
          .page-wrap { flex-direction: column !important; }
          .gallery-side { min-height: 280px !important; width: 100% !important; }
          .login-side { padding: 32px 20px !important; }
        }
      `}</style>

      <div className="page-wrap" style={{
        minHeight: '100vh', display: 'flex',
        background: '#0f0500',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>

        {/* ── LEFT — Gallery ── */}
        <div className="gallery-side" style={{
          position: 'relative', flex: '1 1 55%',
          minHeight: '100vh', overflow: 'hidden',
        }}>
          {/* Slideshow */}
          <Image
            key={IMAGES[active].src}
            src={IMAGES[active].src}
            alt={IMAGES[active].alt}
            fill
            priority
            sizes="55vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            className={`gallery-img${fading ? ' fade' : ''}`}
          />

          {/* Dark overlay gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(10,3,0,.18) 0%, rgba(10,3,0,.0) 50%, rgba(10,3,0,.65) 100%), linear-gradient(to top, rgba(10,3,0,.85) 0%, rgba(10,3,0,.25) 40%, rgba(10,3,0,.1) 100%)',
          }} />

          {/* Top badge */}
          <div style={{ position: 'absolute', top: 28, left: 28, display: 'flex', gap: 8 }}>
            <span className="tag-pill" style={{ background: 'rgba(200,135,58,.9)', color: '#fff' }}>
              🇹🇷 Turkish Sweet
            </span>
          </div>

          {/* Bottom info */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 32px 28px' }}>
            <LangInfo />

            {/* Dots */}
            <div style={{ display: 'flex', gap: 7, marginTop: 20 }}>
              {IMAGES.map((_, i) => (
                <button
                  key={i}
                  className="dot-btn"
                  onClick={() => goTo(i)}
                  aria-label={`Image ${i + 1}`}
                  style={{
                    width: i === active ? 26 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === active ? '#C8873A' : 'rgba(255,255,255,.4)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Left/Right arrow buttons */}
          <button
            onClick={() => goTo((active - 1 + IMAGES.length) % IMAGES.length)}
            style={{
              position: 'absolute', top: '50%', left: 14, transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.15)',
              borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', transition: 'background .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,135,58,.7)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,.35)')}
            aria-label="Previous image"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => goTo((active + 1) % IMAGES.length)}
            style={{
              position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.15)',
              borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', transition: 'background .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,135,58,.7)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,.35)')}
            aria-label="Next image"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2l5 5-5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* ── RIGHT — Login ── */}
        <div className="login-side" style={{
          flex: '0 0 400px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '48px 36px',
          background: 'linear-gradient(160deg, #1c0c02 0%, #120800 60%, #0a0400 100%)',
          borderLeft: '1px solid rgba(200,135,58,.12)',
        }}>
          <div className="login-panel" style={{ width: '100%', maxWidth: 340 }}>

            {/* Logo */}
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'linear-gradient(135deg, #C8873A, #E6A44A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 4px 20px rgba(200,135,58,.45)',
            }}>
              <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="4"   width="14" height="1.8" rx=".9" fill="white"/>
                <rect x="3" y="8.1" width="9"  height="1.8" rx=".9" fill="white"/>
                <rect x="3" y="12.2" width="11" height="1.8" rx=".9" fill="white"/>
              </svg>
            </div>

            <h1 style={{
              fontSize: 22, fontWeight: 700, color: '#F5DEB3',
              textAlign: 'center', marginBottom: 8, letterSpacing: '-.02em',
            }}>
              5G Transcript Viewer
            </h1>
            <p style={{
              fontSize: 13, color: 'rgba(245,222,179,.55)',
              textAlign: 'center', lineHeight: 1.6, marginBottom: 36,
            }}>
              View, search and chat with your lecture transcripts using AI.
            </p>

            <button
              className="sign-btn"
              onClick={handleSignIn}
              disabled={signingIn}
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
                background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.3)',
                borderRadius: 8, fontSize: 12.5, color: '#FCA5A5',
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            <p style={{ fontSize: 11.5, color: 'rgba(245,222,179,.3)', marginTop: 24, textAlign: 'center', lineHeight: 1.5 }}>
              Your chats are saved privately and only accessible to you.
            </p>

            {/* Divider + sweet promo */}
            <div style={{ marginTop: 36, borderTop: '1px solid rgba(200,135,58,.15)', paddingTop: 24 }}>
              <p style={{ fontSize: 11, color: 'rgba(200,135,58,.6)', textAlign: 'center', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                While you wait — discover Baghlava
              </p>
              <div style={{
                background: 'rgba(200,135,58,.07)', borderRadius: 10,
                border: '1px solid rgba(200,135,58,.15)', padding: '12px 14px',
              }}>
                <p style={{ fontSize: 12, color: 'rgba(245,222,179,.7)', lineHeight: 1.7 }}>
                  A flaky, syrup-drenched pastry layered with crushed pistachios & walnuts — born in the Ottoman kitchens of Istanbul.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

function LangInfo() {
  const [lang, setLang] = useState<'en' | 'it'>('en');

  const content = {
    en: {
      title: 'Baghlava',
      subtitle: 'The Crown Jewel of Turkish Confectionery',
      body: 'Made from paper-thin phyllo dough, generously filled with pistachios or walnuts, drenched in fragrant sugar syrup or honey, and baked to a perfect golden crisp. Originating in the imperial kitchens of the Ottoman Empire in Istanbul, Baghlava has been delighting palates for centuries.',
      flag: '🇬🇧',
    },
    it: {
      title: 'Baghlava',
      subtitle: 'Il Gioiello della Pasticceria Turca',
      body: 'Realizzata con sottilissimi strati di pasta fillo, farcita generosamente con pistacchi o noci, inondata di sciroppo di zucchero profumato o miele e cotta fino a diventare dorata e croccante. Nata nelle cucine imperiali dell\'Impero Ottomano a Istanbul, la Baghlava delizia i palati da secoli.',
      flag: '🇮🇹',
    },
  };

  const c = content[lang];

  return (
    <div>
      {/* Lang switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {(['en', 'it'] as const).map(l => (
          <button
            key={l}
            className="lang-tab"
            onClick={() => setLang(l)}
            style={{
              background: lang === l ? 'rgba(200,135,58,.85)' : 'rgba(255,255,255,.1)',
              color: lang === l ? '#fff' : 'rgba(255,255,255,.6)',
              border: '1px solid ' + (lang === l ? 'rgba(200,135,58,.8)' : 'rgba(255,255,255,.15)'),
            }}
          >
            {content[l].flag} {l.toUpperCase()}
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#F5DEB3', letterSpacing: '-.02em', marginBottom: 4 }}>
        {c.title}
      </h2>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#C8873A', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>
        {c.subtitle}
      </p>
      <p style={{ fontSize: 13, color: 'rgba(245,222,179,.78)', lineHeight: 1.75, maxWidth: 460 }}>
        {c.body}
      </p>
    </div>
  );
}
