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

  return (
    <LinearGradient
      colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.45)']}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 24,
            padding: 28,
          }}
        >
          {/* 🔙 BACK TO LOGIN (TEXT BUTTON) */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 12 }}
          >
            <Text style={{ color: '#4B2BFF' }}>
              ← Back to Login
            </Text>
          </TouchableOpacity>

          {/* ❌ CLOSE ICON */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
            }}
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

          {/* EMAIL INPUT */}
          <View style={{ position: 'relative', marginBottom: 20 }}>
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

          {/* BUTTON */}
          <TouchableOpacity
            style={{
              backgroundColor: '#4B2BFF',
              padding: 16,
              borderRadius: 14,
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
              Send Reset Link
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}