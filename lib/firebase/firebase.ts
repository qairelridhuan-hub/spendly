import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
  Platform.OS === 'web'
    ? getFirestore(app)
    : initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
        useFetchStreams: false,
      });
export const functions = getFunctions(app, 'us-central1');
export const firebaseProjectId = firebaseConfig.projectId;
