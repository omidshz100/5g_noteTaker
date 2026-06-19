'use client';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ChatPanel from '@/components/ChatPanel';
import { Session, TranscriptData, EntryGroup } from '@/lib/types';
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
  const txBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', minWidth: 0 }}>

      {/* ── SIDEBAR ──────────────────────────────────── */}
      <aside style={{
        width: 260, minWidth: 260,
        background: '#fff', borderRight: '1px solid #E4E7EC',
        display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #F0F2F5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
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
                width: '100%', padding: '7px 10px 7px 30px',
                border: '1px solid #E4E7EC', borderRadius: 5,
                font: '13px/1 Inter, sans-serif', color: '#0D0F14',
                background: '#F7F8FA', outline: 'none',
              }}
            />
          </div>

          {/* Load button — hidden, transcripts auto-load from server */}
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
              {sessions.length ? 'No sessions match.' : 'Load .json transcript files to get started.'}
            </div>
          ) : filteredSessions.map(s => (
            <div
              key={s.id}
              onClick={() => openSession(s)}
              style={{
                padding: '10px 10px', borderRadius: 5, cursor: 'pointer',
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
              <div style={{
                fontSize: 12.5, fontWeight: 500, color: '#0D0F14', lineHeight: 1.35,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', marginBottom: 4, letterSpacing: '-.01em',
              }}>
                {s.title}
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
            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#E4E7EC' }}>
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
                  width: '100%', padding: '8px 10px', background: 'none', border: 'none',
                  borderRadius: 5, cursor: 'pointer', textAlign: 'left',
                  fontSize: 12.5, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8,
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
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', minWidth: 0 }}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#9CA3AF' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M7 8h10M7 12h6M7 16h8"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#4A5568' }}>No session selected</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 260, textAlign: 'center' }}>
              Load transcript files and select one from the sidebar.
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
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
                    active.date && { icon: 'cal', text: fmtDate(active.date) },
                    active.duration && { icon: 'clk', text: fmtDuration(active.duration) },
                    { icon: 'usr', text: `${active.speakers.length} speakers` },
                    { icon: 'msg', text: `${(active.data.entries || []).length.toLocaleString()} entries` },
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

            {/* Search bar */}
            <div style={{ background: '#fff', borderBottom: '1px solid #E4E7EC', padding: '9px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ position: 'relative', maxWidth: 380, flex: 1 }}>
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
                    width: '100%', padding: '7px 10px 7px 30px',
                    border: '1px solid #E4E7EC', borderRadius: 5,
                    font: '13px/1 Inter, sans-serif', color: '#0D0F14', outline: 'none',
                  }}
                />
              </div>
              <span style={{ fontSize: 11.5, color: '#9CA3AF', minWidth: 56 }}>
                {txSearch ? (matchCount > 0 ? `${matchIdx + 1} / ${matchCount}` : 'No results') : ''}
              </span>
              <div style={{ display: 'flex', gap: 3 }}>
                {(['↑', '↓'] as const).map((arrow, di) => (
                  <button
                    key={arrow}
                    onClick={() => stepSearch(di === 0 ? -1 : 1)}
                    disabled={matchCount < 2}
                    style={{
                      width: 26, height: 26, border: '1px solid #E4E7EC', background: '#fff',
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
            <div ref={txBodyRef} id="txBody" style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 40px' }}>
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
                        style={{ display: 'flex', gap: 11, marginBottom: 18 }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: c, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1,
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

      {/* ── CHAT PANEL — inline next to transcript ───── */}
      {chatOpen && active && (
        <ChatPanel
          session={active}
          user={user}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
