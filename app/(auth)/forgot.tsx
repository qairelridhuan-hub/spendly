import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Mail, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = () => {
    setError('');

    if (!email) {
      setError('Email is required');
      return;
    }

    // 🔹 SIMULATED RESET (UI ONLY)
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      alert('Reset link sent (simulated)');
      router.back();
    }, 800);
  };

  return (
    <LinearGradient
      colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.45)']}
      style={{ flex: 1 }}
    >
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
            style={{ marginBottom: 12 }}
          >
            <Text style={{ color: '#4B2BFF' }}>← Back to Login</Text>
          </TouchableOpacity>

          {/* CLOSE */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: 'absolute', top: 16, right: 16 }}
          >
            <X size={22} color="#6B7280" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            Reset Password
          </Text>

          <Text
            style={{
              color: '#6B7280',
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            Enter your email address and we’ll send you a link to reset your
            password.
          </Text>

          {/* EMAIL */}
          <View style={{ position: 'relative', marginBottom: 12 }}>
            <Mail
              size={20}
              color="#9CA3AF"
              style={{ position: 'absolute', left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Email Address"
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

          {/* ERROR */}
          {error ? (
            <Text
              style={{
                color: 'red',
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              {error}
            </Text>
          ) : null}

          {/* BUTTON */}
          <TouchableOpacity
            onPress={handleReset}
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
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}