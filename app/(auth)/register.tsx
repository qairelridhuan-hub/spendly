import { router } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ArrowLeft, Lock, Mail, User } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "@/lib/firebase";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleRegister = async () => {
    setError("");
    if (!fullName.trim() || !email.trim() || !password) { setError("All fields are required"); return; }
    if (!validateEmail(email.trim())) { setError("Invalid email address"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      await setDoc(doc(db, "users", credential.user.uid), {
        fullName: fullName.trim(),
        email: email.trim(),
        createdAt: serverTimestamp(),
      });
      router.replace("/(tabs)");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("Email is already registered");
      } else if (code === "auth/weak-password") {
        setError("Password is too weak");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.kav}
        >
          <View style={styles.inner}>
            {/* Back button */}
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={20} color="#111827" />
            </TouchableOpacity>

            {/* Logo bubble */}
            <View style={styles.logoBubble}>
              <Text style={styles.logoEmoji}>💰</Text>
            </View>

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Register as a part-time worker</Text>

            {/* Full Name */}
            <View style={styles.inputWrap}>
              <User size={18} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                placeholder="Full Name"
                value={fullName}
                onChangeText={setFullName}
                style={styles.input}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Email */}
            <View style={styles.inputWrap}>
              <Mail size={18} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <Lock size={18} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryBtnText}>{loading ? "Creating Account..." : "Create Account"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
              <Text style={styles.mutedText}>
                Already have an account? <Text style={styles.linkTextBold}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  safe: { flex: 1 },
  kav: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  logoEmoji: { fontSize: 28 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 28,
  },
  inputWrap: { position: "relative", marginBottom: 12 },
  inputIcon: { position: "absolute", left: 14, top: 15, zIndex: 1 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 14,
    paddingLeft: 44,
    paddingRight: 14,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9f9f9",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: "#111827",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  linkBtn: { alignItems: "center" },
  mutedText: { color: "#6b7280", fontSize: 14 },
  linkTextBold: { color: "#111827", fontWeight: "700" },
});
