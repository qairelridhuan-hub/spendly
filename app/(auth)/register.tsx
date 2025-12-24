import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Mail, Lock, User } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase/firebase'; // ✅ FIXED PATH

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');

    if (!fullName || !email || !password) {
      setError('All fields are required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        fullName,
        email,
        role: 'worker',
        createdAt: new Date(),
      });

      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#EEF2FF', '#E0E7FF']} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: 24 }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 24,
            padding: 28,
          }}
        >
          {/* BACK */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 16 }}
          >
            <Text style={{ color: '#4B2BFF' }}>← Back to Login</Text>
          </TouchableOpacity>

          {/* LOGO */}
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#4B2BFF',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 28, color: '#fff' }}>💰</Text>
          </View>

          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 4,
              color: '#4B2BFF',
            }}
          >
            Create Account
          </Text>

          <Text
            style={{
              textAlign: 'center',
              color: '#6B7280',
              marginBottom: 24,
            }}
          >
            Register as a part-time worker
          </Text>

          {/* FULL NAME */}
          <View style={{ position: 'relative', marginBottom: 12 }}>
            <User
              size={20}
              color="#9CA3AF"
              style={{ position: 'absolute', left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
              }}
            />
          </View>

          {/* EMAIL */}
          <View style={{ position: 'relative', marginBottom: 12 }}>
            <Mail
              size={20}
              color="#9CA3AF"
              style={{ position: 'absolute', left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
              }}
            />
          </View>

          {/* PASSWORD */}
          <View style={{ position: 'relative', marginBottom: 12 }}>
            <Lock
              size={20}
              color="#9CA3AF"
              style={{ position: 'absolute', left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
              }}
            />
          </View>

          {/* ERROR */}
          {error ? (
            <Text style={{ color: 'red', textAlign: 'center', marginBottom: 12 }}>
              {error}
            </Text>
          ) : null}

          {/* BUTTON */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            style={{
              backgroundColor: '#4B2BFF',
              padding: 16,
              borderRadius: 14,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: '#fff',
                textAlign: 'center',
                fontSize: 16,
                fontWeight: '600',
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}