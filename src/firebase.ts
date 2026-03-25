import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// This will be replaced by the real config from firebase-applet-config.json
// if it exists, or from environment variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Try to load from the config file if it exists
let config = firebaseConfig;
try {
  // @ts-ignore
  const configModule = await import('../firebase-applet-config.json');
  if (configModule.default) {
    config = {
      ...config,
      ...configModule.default,
    };
  }
} catch (e) {
  // Config file not found, using env vars
}

const app = initializeApp(config);
export const auth = getAuth(app);
// @ts-ignore
export const db = getFirestore(app, config.firestoreDatabaseId);
export const storage = getStorage(app);
