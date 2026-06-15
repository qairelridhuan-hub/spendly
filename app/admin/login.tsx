import { router } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "@/lib/firebase";

export default function AdminLogin() {
  const adminUi = {
    background: "#ffffff",
    card: "#ffffff",
    cardBorder: "#e5e5e5",
    text: "#000000",
    textMuted: "#6b7280",
    accent: "#000000",
    accentStrong: "#000000",
    inputBg: "#f9f9f9",
    inputBorder: "#e5e5e5",
    danger: "#ef4444",
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleLogin = async () => {
    setError("");
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Email and password are required");
      return;
    }
    if (!emailPattern.test(trimmedEmail)) {
      setError("Invalid email format. Please try again.");
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );
      const snap = await getDoc(doc(db, "users", credential.user.uid));
      const role = snap.data()?.role;
      if (role !== "admin") {
        await signOut(auth);
        setError("Admin access only");
        return;
      }
      router.replace("/admin");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential") {
        setError("Invalid email or password");
      } else if (code === "auth/invalid-email") {
        setError("Invalid email format. Please try again.");
      } else {
        setError("Login failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: adminUi.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 24 }}
      >
        <View
          style={{
            backgroundColor: adminUi.card,
            borderRadius: 20,
            padding: 28,
            borderWidth: 1,
            borderColor: adminUi.cardBorder,
            maxWidth: 380,
            alignSelf: "center",
            width: "100%",
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: adminUi.accent,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Lock size={18} color="#ffffff" />
          </View>

          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: adminUi.text,
              letterSpacing: 0.2,
            }}
          >
            Admin sign in
          </Text>
          <Text style={{ color: adminUi.textMuted, fontSize: 13, marginTop: 4, marginBottom: 24 }}>
            Enter your credentials to access the Spendly admin console.
          </Text>

          <View style={{ position: "relative", marginBottom: 12 }}>
            <Mail
              size={20}
              color={adminUi.textMuted}
              style={{ position: "absolute", left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={value => {
                setEmail(value);
                if (error) setError("");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: adminUi.inputBorder,
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
                color: adminUi.text,
                backgroundColor: adminUi.inputBg,
              }}
              placeholderTextColor={adminUi.textMuted}
            />
          </View>

          <View style={{ position: "relative", marginBottom: 12 }}>
            <Lock
              size={20}
              color={adminUi.textMuted}
              style={{ position: "absolute", left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={value => {
                setPassword(value);
                if (error) setError("");
              }}
              secureTextEntry={!showPassword}
              style={{
                borderWidth: 1,
                borderColor: adminUi.inputBorder,
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
                paddingRight: 44,
                color: adminUi.text,
                backgroundColor: adminUi.inputBg,
              }}
              placeholderTextColor={adminUi.textMuted}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(value => !value)}
              style={{ position: "absolute", right: 14, top: 14, padding: 4 }}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <Eye size={20} color={adminUi.textMuted} />
              ) : (
                <EyeOff size={20} color={adminUi.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {error ? (
            <Text style={{ color: adminUi.danger, textAlign: "center", marginBottom: 12 }}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: adminUi.accentStrong,
              padding: 14,
              borderRadius: 12,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
              {loading ? "Signing in..." : "Sign in"}
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color: adminUi.textMuted,
              fontSize: 11,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            Authorized personnel only
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
