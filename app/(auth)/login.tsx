import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);

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

  const handleLogin = () => {
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

    // 🔹 UI ONLY (no Firebase)
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      router.replace("/(tabs)");
    }, 1000);
  };

  return (
    <LinearGradient colors={["#EEF2FF", "#E0E7FF"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 24 }}
      >
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 28 }}>
          {/* LOGO */}
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "#4B2BFF",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              marginBottom: 16,
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
              color: "#4B2BFF",
            }}
          >
            Spendly
          </Text>

          <Text
            style={{
              textAlign: "center",
              color: "#6B7280",
              marginBottom: 24,
            }}
          >
            Part-Time Work Management System
          </Text>

          {/* EMAIL */}
          <View style={{ position: "relative", marginBottom: 12 }}>
            <Mail
              size={20}
              color="#9CA3AF"
              style={{ position: "absolute", left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
              }}
            />
          </View>

          {/* PASSWORD */}
          <View style={{ position: "relative", marginBottom: 12 }}>
            <Lock
              size={20}
              color="#9CA3AF"
              style={{ position: "absolute", left: 14, top: 16 }}
            />
            <TextInput
              ref={passwordRef}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
                paddingRight: 44,
              }}
            />

            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 14, top: 16 }}
            >
              {showPassword ? (
                <Eye size={20} color="#9CA3AF" />
              ) : (
                <EyeOff size={20} color="#9CA3AF" />
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
              backgroundColor: "#4B2BFF",
              padding: 16,
              borderRadius: 14,
              marginBottom: 16,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: "#fff",
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
                  color: "#4B2BFF",
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
                  color: "#4B2BFF",
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