
import { db, isFirebaseConfigured } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type EventType = 
  | 'SESSION_START' 
  | 'SESSION_END'
  | 'LOGIN'
  | 'SIGNUP'
  | 'ADD_ITEM'
  | 'DELETE_ITEM'
  | 'UPDATE_THEME'
  | 'AI_GENERATION'
  | 'PRESENTATION_START'
  | 'SLIDE_CHANGE'
  | 'ERROR';

interface EventData {
  [key: string]: any;
}

export const logActivity = async (userId: string | undefined, event: EventType, data: EventData = {}) => {
  const payload = {
    userId: userId || 'anonymous',
    event,
    data,
    timestamp: serverTimestamp(),
    clientTimestamp: Date.now(),
    userAgent: navigator.userAgent
  };

  if (isFirebaseConfigured && db) {
    try {
      await addDoc(collection(db, "user_activity_logs"), payload);
    } catch (e) {
      console.error("Failed to log analytics to Firestore", e);
    }
  } else {
    // Fallback for Demo Mode
    console.log(`[Analytics] ${event}:`, payload);
  }
};

// "Sentiment" Analysis helper for AI prompts
// Detects mood based on keywords to categorize usage (Worship vs Planning vs Sorrow, etc.)
export const analyzeSentimentContext = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.match(/praise|worship|joy|happy|celebrate|glory|sing/)) return 'JOYFUL_WORSHIP';
  if (lower.match(/mourn|sad|loss|grief|funeral|sorrow|tear/)) return 'SOLEMN_REFLECTION';
  if (lower.match(/announce|event|coffee|meeting|welcome/)) return 'LOGISTICAL';
  if (lower.match(/sermon|preach|bible|scripture|verse/)) return 'TEACHING';
  return 'GENERAL';
};
