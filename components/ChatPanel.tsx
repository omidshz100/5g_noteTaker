'use client';
import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Session, ChatMessage } from '@/lib/types';
import { transcriptToText } from '@/lib/transcriptUtils';
import { saveChatMessage, loadChatMessages, transcriptDocId } from '@/lib/firestore';

interface Props {
  session: Session;
  user: User;
  onClose: () => void;
  onFirstMessage?: (docId: string) => void;
  mobile?: boolean;
}

const MAX_HISTORY = 20;

export default function ChatPanel({ session, user, onClose, onFirstMessage, mobile }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const docId = transcriptDocId(session.filename);

  useEffect(() => {
    setMessages([]);
    setSessionCost(0);
    setLoadingHistory(true);
    loadChatMessages(user.uid, docId)
      .then(msgs => {
        setMessages(msgs);
        setSessionCost(msgs.filter(m => m.costEur).reduce((s, m) => s + (m.costEur || 0), 0));
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [session.filename, user.uid, docId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    // Save user message — don't block chat if Firestore fails
    saveChatMessage(user.uid, docId, session.title, userMsg).catch(() => {});
    if (messages.length === 0) onFirstMessage?.(docId);

    const history = newMessages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          transcriptText: transcriptToText(session.data),
          transcriptTitle: session.title,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.content,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        costEur: data.costEur,
      };

      setMessages(prev => [...prev, assistantMsg]);
      setSessionCost(prev => prev + (data.costEur || 0));
      // Save assistant message — don't block UI if Firestore fails
      saveChatMessage(user.uid, docId, session.title, assistantMsg).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      const errMsg: ChatMessage = { role: 'assistant', content: `Error: ${msg}` };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{
      width: mobile ? '100%' : 360,
      minWidth: mobile ? 0 : 320,
      maxWidth: mobile ? '100%' : 360,
      flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      height: mobile ? '100%' : '100vh',
      background: '#fff',
      borderLeft: mobile ? 'none' : '1px solid #E4E7EC',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #E4E7EC',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: '#5B6AD0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M3 6h14M3 10h10M3 14h7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0F14', letterSpacing: '-.01em' }}>
              Chat with Transcript
            </div>
            <div style={{
              fontSize: 10.5, color: '#9CA3AF',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {session.title}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 26, height: 26, border: '1px solid #E4E7EC',
            borderRadius: 5, background: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF',
            flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Session cost */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px',
          background: '#F7F8FA',
          borderRadius: 6,
          fontSize: 11,
        }}>
          <span style={{ color: '#9CA3AF' }}>This chat:</span>
          <span style={{ fontWeight: 600, color: '#5B6AD0' }}>€{sessionCost.toFixed(4)}</span>
          <span style={{ color: '#E4E7EC', margin: '0 2px' }}>|</span>
          <span style={{ color: '#9CA3AF' }}>
            {messages.filter(m => m.role === 'assistant').length} responses
          </span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loadingHistory ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, paddingTop: 40 }}>
            Loading history…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, paddingTop: 40, lineHeight: 1.7 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
            Ask anything about this transcript.<br />
            Your conversation is saved and remembered next time.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} style={{ marginBottom: 14 }}>
              <div style={{
                display: 'flex', gap: 8,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                {msg.role === 'assistant' ? (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: '#5B6AD0', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2a4 4 0 100 8 4 4 0 000-8zm-7 14c0-3 3-5 7-5s7 2 7 5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                ) : (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: '#E4E7EC', flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    {user.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#4A5568',
                      }}>
                        {(user.displayName || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                {/* Bubble */}
                <div style={{ maxWidth: '75%' }}>
                  <div style={{
                    padding: '8px 11px',
                    borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                    background: msg.role === 'user' ? '#5B6AD0' : '#F7F8FA',
                    color: msg.role === 'user' ? '#fff' : '#0D0F14',
                    fontSize: 13, lineHeight: 1.6,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>

                  {/* Token info for assistant messages */}
                  {msg.role === 'assistant' && msg.inputTokens != null && (
                    <div style={{
                      marginTop: 4, fontSize: 10,
                      color: '#9CA3AF', display: 'flex', gap: 5, flexWrap: 'wrap',
                    }}>
                      <span>{(msg.inputTokens / 1000).toFixed(1)}k in</span>
                      <span>·</span>
                      <span>{msg.outputTokens} out</span>
                      <span>·</span>
                      <span style={{ color: '#5B6AD0', fontWeight: 500 }}>
                        €{(msg.costEur || 0).toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: '#5B6AD0', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <path d="M10 2a4 4 0 100 8 4 4 0 000-8zm-7 14c0-3 3-5 7-5s7 2 7 5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: '2px 12px 12px 12px',
              background: '#F7F8FA', display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px 14px',
        borderTop: '1px solid #E4E7EC',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: '#F7F8FA', borderRadius: 10,
          border: '1px solid #E4E7EC', padding: '8px 10px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about this transcript… (Enter to send)"
            rows={1}
            disabled={loading}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              resize: 'none', outline: 'none',
              font: '13px/1.5 Inter, system-ui, sans-serif',
              color: '#0D0F14', maxHeight: 100, overflowY: 'auto',
            }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 100) + 'px';
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: input.trim() && !loading ? '#5B6AD0' : '#E4E7EC',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background .15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 8l12-6-6 12V9L2 8z" fill={input.trim() && !loading ? 'white' : '#9CA3AF'}/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 5, textAlign: 'center' }}>
          Shift+Enter for new line · claude-haiku-4-5
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
