import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// getReactNativePersistence isn't typed in firebase/auth but exists at runtime
const getReactNativePersistence: (s: any) => any =
  (require('firebase/auth') as any).getReactNativePersistence;

const firebaseConfig = {
  apiKey: 'AIzaSyASk5LevC-uI3_7RmP8ogbnC4ubeoa49s0',
  authDomain: 'spendly-68ea0.firebaseapp.com',
  projectId: 'spendly-68ea0',
  storageBucket: 'spendly-68ea0.firebasestorage.app',
  messagingSenderId: '761591899210',
  appId: '1:761591899210:web:30faf58a51ba1c341972b3',
};

const hasApps = getApps().length > 0;
const app = hasApps ? getApp() : initializeApp(firebaseConfig);

// Expo-safe Auth with persistence (native) and standard auth (web)
export const auth = hasApps
  ? getAuth(app)
  : Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
export const db =
  Platform.OS === 'web' || hasApps
    ? getFirestore(app)
    : initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
      } as any);
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app);
export const firebaseProjectId = firebaseConfig.projectId;
