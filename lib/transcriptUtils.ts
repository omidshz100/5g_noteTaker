import { TranscriptData, TranscriptEntry, Speaker, EntryGroup } from './types';

export const PALETTE = [
  '#5B6AD0','#E05A7A','#0D9488','#D97706','#7C3AED',
  '#0891B2','#DC2626','#16A34A','#9333EA','#C2410C',
  '#1D4ED8','#BE185D','#047857','#B45309','#6D28D9',
];

export function colorFor(idx: number): string {
  return PALETTE[idx % PALETTE.length];
}

export function initials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function fmtTS(off: string | null | undefined): string {
  if (!off) return '';
  const m = off.match(/^(\d+):(\d+):(\d+)/);
  if (!m) return '';
  const h = +m[1], min = +m[2], s = +m[3];
  const mm = String(min).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDate(d: string): string {
  if (!d) return '';
  const [y, mo, day] = d.split('-');
  return new Date(+y, +mo - 1, +day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function fmtDuration(off: string | null | undefined): string {
  if (!off) return '';
  const m = off.match(/^(\d+):(\d+):(\d+)/);
  if (!m) return '';
  const h = +m[1], min = +m[2], s = +m[3];
  if (h > 0) return `${h}h ${min}m`;
  if (min > 0) return `${min}m ${s}s`;
  return `${s}s`;
}

function clean(s: string): string {
  return s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

export function parseFilename(name: string): { title: string; date: string; lecturer: string } {
  name = name.replace(/\.json$/i, '');
  const dm = name.match(/[_\-](\d{8})[_\-](\d{6})/);
  if (!dm) return { title: clean(name), date: '', lecturer: '' };

  const before = name.slice(0, dm.index);
  const ds = dm[1];
  const date = `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`;

  let title = '', lecturer = '';
  const raw = before.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const lm = raw.match(/(.+?)\s+(prof[._\s]|dr[._\s]|lecturer\s|team\s).+/i);
  if (lm) {
    title = lm[1].trim();
    lecturer = raw.slice(lm[1].length).trim();
  } else {
    title = raw;
  }
  title = titleCase(title);
  lecturer = titleCase(lecturer);
  title = title.replace(/\s*-\s*view[\s-]?only\s*$/i, '').trim();
  if (!title) title = clean(name);

  return { title, date, lecturer };
}

export function buildSpeakers(entries: TranscriptEntry[]): Speaker[] {
  const map: Record<string, Speaker> = {};
  for (const e of entries) {
    if (!e.speakerId) continue;
    if (!map[e.speakerId]) {
      map[e.speakerId] = { id: e.speakerId, name: e.speakerDisplayName || 'Unknown', count: 0 };
    }
    map[e.speakerId].count++;
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

export function getDuration(data: TranscriptData): string | null {
  const entries = data.entries || [];
  if (!entries.length) return null;
  const last = entries[entries.length - 1];
  return last.endOffset || last.startOffset || null;
}

export function speakerColor(speakerId: string, speakers: Speaker[]): string {
  const i = speakers.findIndex(s => s.id === speakerId);
  return colorFor(i < 0 ? 0 : i);
}

export function groupEntries(entries: TranscriptEntry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];
  let cur: EntryGroup | null = null;
  for (const e of entries) {
    if (!cur || cur.speakerId !== e.speakerId) {
      cur = { speakerId: e.speakerId, name: e.speakerDisplayName || 'Unknown', startOffset: e.startOffset, entries: [] };
      groups.push(cur);
    }
    cur.entries.push(e);
  }
  return groups;
}

export function transcriptToText(data: TranscriptData): string {
  const groups = groupEntries(data.entries || []);
  const text = groups.map(g =>
    `[${fmtTS(g.startOffset)}] ${g.name}: ${g.entries.map(e => e.text).join(' ')}`
  ).join('\n\n');
  const MAX = 80_000;
  if (text.length > MAX) return text.slice(0, MAX) + '\n[Transcript truncated due to length]';
  return text;
}
