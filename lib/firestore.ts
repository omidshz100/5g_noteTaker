import { db } from './firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, query, orderBy, limit, serverTimestamp, increment,
} from 'firebase/firestore';
import { ChatMessage } from './types';

export function transcriptDocId(filename: string): string {
  return filename.replace(/[/\\]/g, '_').slice(0, 1400);
}

export async function saveUserProfile(uid: string, data: { name: string; email: string; photoURL: string }) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...data, totalTokensInput: 0, totalTokensOutput: 0, totalCostEur: 0 });
  }
}

export async function saveChatMessage(
  uid: string,
  transcriptId: string,
  transcriptTitle: string,
  message: Omit<ChatMessage, 'id'>
) {
  const chatRef = doc(db, 'users', uid, 'chats', transcriptId);
  await setDoc(chatRef, { transcriptTitle, lastUpdated: serverTimestamp() }, { merge: true });

  if (message.role === 'assistant' && message.costEur) {
    await updateDoc(chatRef, { totalCostEur: increment(message.costEur) });
    await updateDoc(doc(db, 'users', uid), {
      totalCostEur: increment(message.costEur),
      totalTokensInput: increment(message.inputTokens || 0),
      totalTokensOutput: increment(message.outputTokens || 0),
    });
  }

  const messagesRef = collection(db, 'users', uid, 'chats', transcriptId, 'messages');
  await addDoc(messagesRef, { ...message, timestamp: serverTimestamp() });
}

export async function loadChatMessages(uid: string, transcriptId: string): Promise<ChatMessage[]> {
  const messagesRef = collection(db, 'users', uid, 'chats', transcriptId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(60));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
}

export async function getUserStats(uid: string): Promise<{ totalCostEur: number; totalTokensInput: number; totalTokensOutput: number } | null> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as { totalCostEur: number; totalTokensInput: number; totalTokensOutput: number }) : null;
}
