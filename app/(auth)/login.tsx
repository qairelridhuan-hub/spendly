import { Link, router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
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
import { auth } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_EMAIL_KEY = "spendly:lastEmail";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    const loadRecentEmails = async () => {
      try {
        const storedList = await AsyncStorage.getItem("spendly:recentEmails");
        const list = storedList ? JSON.parse(storedList) : [];
        if (Array.isArray(list)) setRecentEmails(list);
        const lastEmail = await AsyncStorage.getItem(LAST_EMAIL_KEY);
        if (lastEmail) setEmail(lastEmail);
      } catch {
        // ignore storage errors
      }
    };
    loadRecentEmails();
  }, []);

  const validateEmail = () => {
    if (!email.trim()) { setError("Email is required"); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError("Please enter a valid email address"); return false; }
    return true;
  };

  const handleLogin = async () => {
    setError("");
    if (!validateEmail()) return;
    if (!password) { setError("Password is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      try {
        await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);
        const nextList = [trimmedEmail, ...recentEmails.filter(item => item !== trimmedEmail)].slice(0, 5);
        setRecentEmails(nextList);
        await AsyncStorage.setItem("spendly:recentEmails", JSON.stringify(nextList));
      } catch { /* ignore */ }
      router.replace("/(tabs)");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/user-not-found") {
        setError("Invalid email or password");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else {
        setError("Login failed. Please try again.");
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
            {/* Logo bubble */}
            <View style={styles.logoBubble}>
              <Text style={styles.logoEmoji}>💰</Text>
            </View>

            <Text style={styles.appName}>Spendly</Text>
            <Text style={styles.tagline}>Part-Time Work Management System</Text>

            {/* Email */}
            <View style={styles.inputWrap}>
              <Mail size={18} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                importantForAutofill="yes"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                style={styles.input}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <Lock size={18} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                importantForAutofill="yes"
                style={[styles.input, { paddingRight: 44 }]}
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? <Eye size={18} color="#9ca3af" /> : <EyeOff size={18} color="#9ca3af" />}
              </TouchableOpacity>
            </View>

            {/* Error */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Login button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryBtnText}>{loading ? "Logging in..." : "Login"}</Text>
            </TouchableOpacity>

            {/* Forgot */}
            <Link href="./forgot" asChild>
              <TouchableOpacity style={styles.linkBtn}>
                <Text style={styles.linkText}>Forgot Password?</Text>
              </TouchableOpacity>
            </Link>

            {/* Register */}
            <Link href="./register" asChild>
              <TouchableOpacity style={styles.linkBtn}>
                <Text style={styles.mutedText}>
                  Don't have an account?{" "}
                  <Text style={styles.linkTextBold}>Register</Text>
                </Text>
              </TouchableOpacity>
            </Link>
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
  logoBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  logoEmoji: { fontSize: 32 },
  appName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 32,
  },
  inputWrap: {
    position: "relative",
    marginBottom: 12,
  },
  inputIcon: {
    position: "absolute",
    left: 14,
    top: 15,
    zIndex: 1,
  },
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
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 15,
    zIndex: 1,
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
  linkBtn: { alignItems: "center", marginBottom: 10 },
  linkText: { color: "#111827", fontSize: 14, fontWeight: "600" },
  linkTextBold: { color: "#111827", fontWeight: "700" },
  mutedText: { color: "#6b7280", fontSize: 14 },
});
