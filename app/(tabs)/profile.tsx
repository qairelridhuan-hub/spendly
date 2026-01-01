import { View, Text, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';
import { auth } from '@/lib/firebase';

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Profile</Text>

      <TouchableOpacity
        style={{ marginTop: 20 }}
        onPress={async () => {
          try {
            await signOut(auth);
          } finally {
            router.replace('/(auth)/login');
          }
        }}
      >
        <Text style={{ color: 'red' }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
