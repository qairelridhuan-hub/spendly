import { Stack, router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase/firebase';
import { useEffect, useState } from 'react';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(tabs)');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}