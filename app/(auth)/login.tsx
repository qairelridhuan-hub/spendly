import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthWaveBackground } from "@/components/AuthWaveBackground";

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
        if (Array.isArray(list)) {
          setRecentEmails(list);
        }
        const lastEmail = await AsyncStorage.getItem(LAST_EMAIL_KEY);
        if (lastEmail) setEmail(lastEmail);
      } catch {
        // ignore storage errors
      }
    };
    loadRecentEmails();
  }, []);

  const validateEmail = () => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    setError("");

    if (!validateEmail()) return;

    if (!password) {
      setError("Password is required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      try {
        await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmedEmail);
        const nextList = [
          trimmedEmail,
          ...recentEmails.filter(item => item !== trimmedEmail),
        ].slice(0, 5);
        setRecentEmails(nextList);
        await AsyncStorage.setItem(
          "spendly:recentEmails",
          JSON.stringify(nextList)
        );
      } catch {
        // ignore storage errors
      }
      router.replace("/(auth)/splash");
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
    <LinearGradient colors={["#0b1220", "#0f1a1a", "#0b0f12"]} style={{ flex: 1 }}>
      <AuthWaveBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 24 }}
      >
        <View
          style={{
            backgroundColor: "rgba(15,23,42,0.9)",
            borderRadius: 24,
            padding: 28,
            borderWidth: 1,
            borderColor: "rgba(148,163,184,0.2)",
          }}
        >
          {/* LOGO */}
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "rgba(183,243,77,0.2)",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "rgba(183,243,77,0.6)",
            }}
          >
            <Text style={{ fontSize: 28, color: "#fff" }}>💰</Text>
          </View>

          <Text
            style={{
              fontSize: 26,
              fontWeight: "700",
              textAlign: "center",
              marginBottom: 6,
              color: "#e2e8f0",
            }}
          >
            Spendly
          </Text>

          <Text
            style={{
              textAlign: "center",
              color: "#94a3b8",
              marginBottom: 24,
            }}
          >
            Part-Time Work Management System
          </Text>

          {/* EMAIL */}
          <View style={{ position: "relative", marginBottom: 12 }}>
            <Mail
              size={20}
              color="#94a3b8"
              style={{ position: "absolute", left: 14, top: 16 }}
            />
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
              style={{
                borderWidth: 1,
                borderColor: "rgba(148,163,184,0.3)",
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
                color: "#e2e8f0",
                backgroundColor: "rgba(15,23,42,0.6)",
              }}
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* PASSWORD */}
          <View style={{ position: "relative", marginBottom: 12 }}>
            <Lock
              size={20}
              color="#94a3b8"
              style={{ position: "absolute", left: 14, top: 16 }}
            />
            <TextInput
              ref={passwordRef}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              importantForAutofill="yes"
              style={{
                borderWidth: 1,
                borderColor: "rgba(148,163,184,0.3)",
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
                paddingRight: 44,
                color: "#e2e8f0",
                backgroundColor: "rgba(15,23,42,0.6)",
              }}
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 14, top: 16 }}
            >
              {showPassword ? (
                <Eye size={20} color="#94a3b8" />
              ) : (
                <EyeOff size={20} color="#94a3b8" />
              )}
            </TouchableOpacity>
          </View>

          {/* ERROR */}
          {error ? (
            <Text style={{ color: "red", textAlign: "center", marginBottom: 12 }}>
              {error}
            </Text>
          ) : null}

          {/* LOGIN BUTTON */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: "#B7F34D",
              padding: 16,
              borderRadius: 14,
              marginBottom: 16,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: "#0b0f12",
                textAlign: "center",
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {loading ? "Logging in..." : "Login"}
            </Text>
          </TouchableOpacity>

          {/* LINKS */}
          <Link href="./forgot" asChild>
            <TouchableOpacity>
              <Text
                style={{
                  textAlign: "center",
                  color: "#B7F34D",
                  marginBottom: 10,
                }}
              >
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </Link>

          <Link href="./register" asChild>
            <TouchableOpacity>
              <Text
                style={{
                  textAlign: "center",
                  color: "#e2e8f0",
                  fontWeight: "600",
                }}
              >
                Don’t have an account? Register
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = {
  emailList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingVertical: 4,
  },
  emailRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  emailRowText: { color: "#374151", fontSize: 14 },
};
