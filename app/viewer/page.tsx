'use client';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ChatPanel from '@/components/ChatPanel';
import { Session, TranscriptData, EntryGroup } from '@/lib/types';
import { loadChatIndex, transcriptDocId } from '@/lib/firestore';
import {
  parseFilename, buildSpeakers, getDuration, colorFor, initials,
  fmtTS, fmtDate, fmtDuration, groupEntries, speakerColor,
} from '@/lib/transcriptUtils';

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlight(text: string, q: string): string {
  if (!q.trim()) return esc(text);
  const parts: string[] = [];
  const ql = q.toLowerCase();
  const tl = text.toLowerCase();
  let pos = 0;
  while (true) {
    const idx = tl.indexOf(ql, pos);
    if (idx < 0) break;
    parts.push(esc(text.slice(pos, idx)));
    parts.push(`<mark>${esc(text.slice(idx, idx + q.length))}</mark>`);
    pos = idx + q.length;
  }
  parts.push(esc(text.slice(pos)));
  return parts.join('');
}

export default function ViewerPage() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [sideSearch, setSideSearch] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [matchIdx, setMatchIdx] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [speakerCursors, setSpeakerCursors] = useState<Record<string, number>>({});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatIndex, setChatIndex] = useState<Set<string>>(new Set());
  const txBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user) {
      loadChatIndex(user.uid).then(idx => setChatIndex(idx)).catch(() => {});
    }
  }, [user, loading, router]);

  useEffect(() => { autoLoad(); }, []);

  async function autoLoad() {
    try {
      const res = await fetch('/transcribes/manifest.json');
      if (!res.ok) return;
      const files: string[] = await res.json();
      if (!files.length) return;

      setLoadProgress({ done: 0, total: files.length });

      for (const filename of files) {
        try {
          const r = await fetch(`/transcribes/${encodeURIComponent(filename)}`);
          if (!r.ok) continue;
          const data: TranscriptData = await r.json();
          const { title, date, lecturer } = parseFilename(filename);
          const speakers = buildSpeakers(data.entries || []);
          const duration = getDuration(data);
          setSessions(prev => [
            ...prev,
            { id: prev.length, filename, data, title, date, lecturer, speakers, duration },
          ]);
        } catch { /* skip bad files */ }
        setLoadProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
      }

      setLoadProgress(null);
    } catch { /* no manifest */ }
  }

  async function loadFiles(files: FileList) {
    const added: Session[] = [];
    for (const file of Array.from(files)) {
      if (sessions.find(s => s.filename === file.name)) continue;
      try {
        const data: TranscriptData = JSON.parse(await file.text());
        const { title, date, lecturer } = parseFilename(file.name);
        const speakers = buildSpeakers(data.entries || []);
        const duration = getDuration(data);
        added.push({ id: sessions.length + added.length, filename: file.name, data, title, date, lecturer, speakers, duration });
      } catch { /* skip */ }
    }
    if (added.length) setSessions(prev => [...prev, ...added]);
  }

  const filteredSessions = useMemo(() => {
    const q = sideSearch.toLowerCase();
    return sessions
      .filter(s => !q || s.title.toLowerCase().includes(q) || s.lecturer.toLowerCase().includes(q) || s.date.includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, sideSearch]);

  const groups: EntryGroup[] = useMemo(() => {
    if (!active) return [];
    return groupEntries(active.data.entries || []);
  }, [active]);

  function openSession(s: Session) {
    setActive(s);
    setTxSearch('');
    setMatchCount(0);
    setMatchIdx(0);
    setSpeakerCursors({});
    if (isMobile) setSidebarOpen(false);
  }

  const doSearch = useCallback((q: string) => {
    setTxSearch(q);
    setMatchIdx(0);
    setTimeout(() => {
      const marks = Array.from(txBodyRef.current?.querySelectorAll('mark') || []);
      setMatchCount(marks.length);
      if (marks.length > 0) {
        marks.forEach((m, i) => m.classList.toggle('current', i === 0));
        marks[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }, []);

  function stepSearch(dir: number) {
    const marks = Array.from(txBodyRef.current?.querySelectorAll('mark') || []);
    if (!marks.length) return;
    const next = (matchIdx + dir + marks.length) % marks.length;
    setMatchIdx(next);
    marks.forEach((m, i) => m.classList.toggle('current', i === next));
    marks[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function jumpSpeaker(spkId: string) {
    if (!txBodyRef.current) return;
    const els = Array.from(txBodyRef.current.querySelectorAll(`[data-spk="${CSS.escape(spkId)}"]`));
    if (!els.length) return;
    const cur = ((speakerCursors[spkId] ?? -1) + 1) % els.length;
    setSpeakerCursors(prev => ({ ...prev, [spkId]: cur }));
    const target = els[cur] as HTMLElement;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.remove('flash');
    void target.offsetWidth;
    target.classList.add('flash');
  }

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#F7F8FA' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid #E4E7EC', borderTopColor: '#5B6AD0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Loading…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const sidebarStyle = isMobile ? {
    position: 'fixed' as const,
    top: 0, left: 0, bottom: 0,
    zIndex: 200,
    transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: sidebarOpen ? '4px 0 28px rgba(0,0,0,0.18)' : 'none',
    width: 280, minWidth: 280,
    background: '#fff',
    borderRight: '1px solid #E4E7EC',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100dvh',
    overflow: 'hidden' as const,
  } : {
    width: 260, minWidth: 260,
    background: '#fff',
    borderRight: '1px solid #E4E7EC',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100vh',
    overflow: 'hidden' as const,
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', minWidth: 0 }}>

      {/* ── MOBILE BACKDROP ──────────────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 150,
          }}
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────── */}
      <aside style={sidebarStyle}>
        {/* Brand */}
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #F0F2F5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            {/* Close button on mobile */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  width: 30, height: 30, border: 'none', background: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', borderRadius: 7, flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="#4A5568" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            {!isMobile && (
              <div style={{
                width: 30, height: 30, background: '#5B6AD0', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(91,106,208,.35)', flexShrink: 0,
              }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="4" width="14" height="1.8" rx=".9" fill="white"/>
                  <rect x="3" y="8.1" width="9" height="1.8" rx=".9" fill="white"/>
                  <rect x="3" y="12.2" width="11" height="1.8" rx=".9" fill="white"/>
                </svg>
              </div>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0F14', letterSpacing: '-.01em' }}>
              Transcript Viewer
            </span>
            {sessions.length > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 500,
                background: '#EEF0FC', color: '#5B6AD0', padding: '2px 7px', borderRadius: 10,
              }}>
                {sessions.length}
              </span>
            )}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
            </svg>
            <input
              type="text"
              placeholder="Filter sessions…"
              value={sideSearch}
              onChange={e => setSideSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px 8px 30px',
                border: '1px solid #E4E7EC', borderRadius: 5,
                font: '13px/1 Inter, sans-serif', color: '#0D0F14',
                background: '#F7F8FA', outline: 'none',
              }}
            />
          </div>

          <input type="file" accept=".json" multiple style={{ display: 'none' }}
            onChange={e => { if (e.target.files) loadFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {/* Loading progress bar */}
        {loadProgress && (
          <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A5568', marginBottom: 5 }}>
              <span>Loading transcripts…</span>
              <span style={{ color: '#5B6AD0', fontWeight: 600 }}>{loadProgress.done}/{loadProgress.total}</span>
            </div>
            <div style={{ height: 3, background: '#E4E7EC', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, background: '#5B6AD0',
                width: `${(loadProgress.done / loadProgress.total) * 100}%`,
                transition: 'width 0.2s ease',
              }} />
            </div>
          </div>
        )}

        {/* Session list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {filteredSessions.length === 0 && !loadProgress ? (
            <div style={{ padding: '28px 14px', textAlign: 'center', color: '#9CA3AF', fontSize: 12.5, lineHeight: 1.6 }}>
              {sessions.length ? 'No sessions match.' : 'Loading transcripts…'}
            </div>
          ) : filteredSessions.map(s => (
            <div
              key={s.id}
              onClick={() => openSession(s)}
              style={{
                padding: '11px 10px', borderRadius: 5, cursor: 'pointer',
                marginBottom: 1, border: '1px solid transparent',
                background: active?.id === s.id ? '#EEF0FC' : 'transparent',
                borderColor: active?.id === s.id ? '#C7CDF7' : 'transparent',
                position: 'relative', transition: 'background .1s',
              }}
            >
              {active?.id === s.id && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                  borderRadius: '3px 0 0 3px', background: '#5B6AD0',
                }} />
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 4 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 500, color: '#0D0F14', lineHeight: 1.35,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden', flex: 1, letterSpacing: '-.01em',
                }}>
                  {s.title}
                </div>
                {chatIndex.has(transcriptDocId(s.filename)) && (
                  <div title="Has chat history" style={{
                    flexShrink: 0, marginTop: 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#EEF0FC', border: '1px solid #C7CDF7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
                      <path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z" fill="#5B6AD0"/>
                    </svg>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {s.date && <span>{fmtDate(s.date)}</span>}
                {s.date && s.duration && <span>·</span>}
                {s.duration && <span>{fmtDuration(s.duration)}</span>}
                {s.speakers.length > 0 && <><span>·</span><span>{s.speakers.length} speakers</span></>}
              </div>
            </div>
          ))}
        </div>

        {/* User profile */}
        <div style={{ borderTop: '1px solid #F0F2F5', padding: '10px 12px', flexShrink: 0, position: 'relative' }}>
          <div
            onClick={() => setShowUserMenu(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
              padding: '6px 8px', borderRadius: 7,
              background: showUserMenu ? '#F7F8FA' : 'transparent',
              transition: 'background .1s',
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#E4E7EC' }}>
              {user.photoURL
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#4A5568' }}>
                    {(user.displayName || 'U')[0].toUpperCase()}
                  </div>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0F14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName || 'User'}
              </div>
              <div style={{ fontSize: 10.5, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
            </div>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, color: '#9CA3AF' }}>
              <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {showUserMenu && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 12, right: 12,
              background: '#fff', border: '1px solid #E4E7EC', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,.1)', padding: 6, zIndex: 100,
            }}>
              <button
                onClick={() => { setShowUserMenu(false); logOut(); router.replace('/login'); }}
                style={{
                  width: '100%', padding: '10px 10px', background: 'none', border: 'none',
                  borderRadius: 5, cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l4-4-4-4M14 8H6"/>
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden', minWidth: 0,
      }}>

        {/* ── MOBILE TOP BAR ───────────────────────────── */}
        {isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 12px', height: 52, flexShrink: 0,
            background: '#fff', borderBottom: '1px solid #E4E7EC',
          }}>
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                width: 38, height: 38, border: 'none', background: '#F7F8FA',
                borderRadius: 9, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M1 1h14M1 6h14M1 11h14" stroke="#0D0F14" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Brand / active title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {active ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0F14', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                  {active.title}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 26, height: 26, background: '#5B6AD0', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                      <rect x="3" y="4" width="14" height="1.8" rx=".9" fill="white"/>
                      <rect x="3" y="8.1" width="9" height="1.8" rx=".9" fill="white"/>
                      <rect x="3" y="12.2" width="11" height="1.8" rx=".9" fill="white"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0F14' }}>Transcript Viewer</span>
                </div>
              )}
            </div>

            {/* Chat toggle button (mobile) */}
            {active && (
              <button
                onClick={() => setChatOpen(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', border: 'none', borderRadius: 20,
                  background: chatOpen ? '#5B6AD0' : '#EEF0FC',
                  color: chatOpen ? '#fff' : '#5B6AD0',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z"/>
                </svg>
                Chat
              </button>
            )}
          </div>
        )}

        {!active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF', padding: 24 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M7 8h10M7 12h6M7 16h8"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#4A5568' }}>No session selected</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 240, textAlign: 'center' }}>
              {isMobile ? 'Tap the menu to select a transcript.' : 'Select a transcript from the sidebar.'}
            </div>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  marginTop: 8, padding: '10px 20px', border: 'none', borderRadius: 20,
                  background: '#5B6AD0', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Open Transcripts
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Header (hidden on mobile) */}
            {!isMobile && (
              <div style={{ background: '#fff', borderBottom: '1px solid #E4E7EC', padding: '16px 24px 12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#0D0F14', lineHeight: 1.3, letterSpacing: '-.02em' }}>
                      {active.title}
                      {active.lecturer && (
                        <span style={{ fontWeight: 400, color: '#4A5568', fontSize: 13, marginLeft: 8 }}>
                          {active.lecturer}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {[
                      active.date && { text: fmtDate(active.date) },
                      active.duration && { text: fmtDuration(active.duration) },
                      { text: `${active.speakers.length} speakers` },
                      { text: `${(active.data.entries || []).length.toLocaleString()} entries` },
                    ].filter(Boolean).map((b, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 9px', background: '#F7F8FA', border: '1px solid #E4E7EC',
                        borderRadius: 20, fontSize: 11.5, fontWeight: 500, color: '#4A5568', whiteSpace: 'nowrap',
                      }}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(b as any).text}
                      </div>
                    ))}

                    {/* Chat toggle */}
                    <button
                      onClick={() => setChatOpen(p => !p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 11px', border: 'none', borderRadius: 20,
                        background: chatOpen ? '#5B6AD0' : '#EEF0FC',
                        color: chatOpen ? '#fff' : '#5B6AD0',
                        fontSize: 11.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z"/>
                      </svg>
                      {chatOpen ? 'Close Chat' : 'Chat with AI'}
                    </button>
                  </div>
                </div>

                {/* Speaker chips */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {active.speakers.slice(0, 12).map((sp, i) => {
                    const c = colorFor(i);
                    return (
                      <div
                        key={sp.id}
                        onClick={() => jumpSpeaker(sp.id)}
                        title={`Click to jump to ${sp.name}'s messages`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '3px 9px 3px 4px', borderRadius: 20,
                          background: `${c}18`, border: `1px solid ${c}28`, color: c,
                          fontSize: 11.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 700, color: '#fff' }}>
                          {initials(sp.name)}
                        </div>
                        <span>{sp.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile compact header */}
            {isMobile && (
              <div style={{ background: '#fff', borderBottom: '1px solid #E4E7EC', padding: '8px 14px', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {active.speakers.slice(0, 6).map((sp, i) => {
                    const c = colorFor(i);
                    return (
                      <div
                        key={sp.id}
                        onClick={() => jumpSpeaker(sp.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px 3px 3px', borderRadius: 20,
                          background: `${c}18`, border: `1px solid ${c}28`, color: c,
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 700, color: '#fff' }}>
                          {initials(sp.name)}
                        </div>
                        <span>{sp.name}</span>
                      </div>
                    );
                  })}
                  {active.speakers.length > 6 && (
                    <div style={{ padding: '3px 8px', borderRadius: 20, background: '#F7F8FA', border: '1px solid #E4E7EC', fontSize: 11, color: '#9CA3AF' }}>
                      +{active.speakers.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search bar */}
            <div style={{ background: '#fff', borderBottom: '1px solid #E4E7EC', padding: isMobile ? '8px 12px' : '9px 24px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: isMobile ? 'none' : 380 }}>
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search in transcript…"
                  value={txSearch}
                  onChange={e => doSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.shiftKey ? stepSearch(-1) : stepSearch(1); e.preventDefault(); }
                    if (e.key === 'ArrowDown') { stepSearch(1); e.preventDefault(); }
                    if (e.key === 'ArrowUp') { stepSearch(-1); e.preventDefault(); }
                  }}
                  style={{
                    width: '100%', padding: '8px 10px 8px 30px',
                    border: '1px solid #E4E7EC', borderRadius: 5,
                    font: '13px/1 Inter, sans-serif', color: '#0D0F14', outline: 'none',
                  }}
                />
              </div>
              {txSearch && (
                <span style={{ fontSize: 11.5, color: '#9CA3AF', minWidth: 48, flexShrink: 0 }}>
                  {matchCount > 0 ? `${matchIdx + 1}/${matchCount}` : 'None'}
                </span>
              )}
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {(['↑', '↓'] as const).map((arrow, di) => (
                  <button
                    key={arrow}
                    onClick={() => stepSearch(di === 0 ? -1 : 1)}
                    disabled={matchCount < 2}
                    style={{
                      width: 30, height: 30, border: '1px solid #E4E7EC', background: '#fff',
                      borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: matchCount < 2 ? 'not-allowed' : 'pointer', color: '#4A5568', fontSize: 12,
                      opacity: matchCount < 2 ? .35 : 1,
                    }}
                  >
                    {arrow}
                  </button>
                ))}
              </div>
            </div>

            {/* Transcript body */}
            <div ref={txBodyRef} id="txBody" style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 14px 40px' : '22px 24px 40px' }}>
              {(() => {
                let prevHour = -1;
                return groups.map((group, gi) => {
                  const c = speakerColor(group.speakerId, active.speakers);
                  const ts = fmtTS(group.startOffset);
                  const hmatch = (group.startOffset || '').match(/^(\d+):/);
                  let divider: React.ReactNode = null;
                  if (hmatch) {
                    const h = +hmatch[1];
                    if (h !== prevHour) {
                      prevHour = h;
                      if (h > 0) divider = (
                        <div key={`div-${gi}`} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          margin: '20px 0 16px', color: '#9CA3AF', fontSize: 11,
                          fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase',
                        }}>
                          <div style={{ flex: 1, height: 1, background: '#E4E7EC' }} />
                          Hour {h}
                          <div style={{ flex: 1, height: 1, background: '#E4E7EC' }} />
                        </div>
                      );
                    }
                  }
                  return (
                    <div key={gi}>
                      {divider}
                      <div
                        className="msg-group"
                        data-spk={group.speakerId}
                        style={{ display: 'flex', gap: isMobile ? 8 : 11, marginBottom: 18 }}
                      >
                        <div style={{
                          width: isMobile ? 30 : 34, height: isMobile ? 30 : 34, borderRadius: '50%',
                          background: c, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1,
                        }} title={group.name}>
                          {initials(group.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0D0F14', letterSpacing: '-.01em' }}>
                              {group.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#9CA3AF', fontFamily: 'monospace', letterSpacing: '.01em' }}>
                              {ts}
                            </span>
                          </div>
                          {group.entries.map((e, ei) => (
                            <span
                              key={ei}
                              className={`msg-line${e.confidence < 0.25 ? ' conf-low' : ''}`}
                              style={{ background: `${c}12` }}
                              dangerouslySetInnerHTML={{ __html: highlight(e.text || '', txSearch) }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}
      </main>

      {/* ── CHAT PANEL ───────────────────────────────── */}
      {chatOpen && active && (
        isMobile ? (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column' }}>
            <ChatPanel
              session={active}
              user={user}
              onClose={() => setChatOpen(false)}
              onFirstMessage={id => setChatIndex(prev => new Set([...prev, id]))}
              mobile
            />
          </div>
        ) : (
          <ChatPanel
            session={active}
            user={user}
            onClose={() => setChatOpen(false)}
            onFirstMessage={id => setChatIndex(prev => new Set([...prev, id]))}
          />
        )
      )}
    </div>
  );
}
