import { LinearGradient } from "expo-linear-gradient";
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
    background: ["#f8fafc", "#f1f5f9", "#e2e8f0"],
    card: "#ffffff",
    cardBorder: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#64748b",
    accent: "#0ea5e9",
    accentStrong: "#0284c7",
    inputBg: "#f8fafc",
    inputBorder: "#cbd5e1",
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
    <LinearGradient colors={adminUi.background} style={{ flex: 1 }}>
      <View
        style={{
          position: "absolute",
          width: 380,
          height: 380,
          borderRadius: 190,
          backgroundColor: "rgba(14,165,233,0.16)",
          top: -160,
          right: -160,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: 260,
          backgroundColor: "rgba(2,132,199,0.18)",
          bottom: -240,
          left: -220,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 24 }}
      >
        <View
          style={{
            backgroundColor: adminUi.card,
            borderRadius: 26,
            padding: 28,
            borderWidth: 1,
            borderColor: adminUi.cardBorder,
            maxWidth: 420,
            alignSelf: "center",
            width: "100%",
            shadowColor: "#000",
            shadowOpacity: 0.35,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: adminUi.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>🛡️</Text>
            </View>
            <View>
              <Text
                style={{
                  color: adminUi.text,
                  fontSize: 16,
                  fontWeight: "700",
                  letterSpacing: 0.4,
                }}
              >
                Spendly
              </Text>
              <Text style={{ color: adminUi.textMuted, fontSize: 12 }}>
                Admin Console
              </Text>
            </View>
          </View>

          <View
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: "rgba(14,165,233,0.14)",
              borderWidth: 1,
              borderColor: "rgba(14,165,233,0.4)",
              marginBottom: 12,
            }}
          >
            <Text style={{ color: adminUi.accent, fontSize: 12, fontWeight: "600" }}>
              ADMIN ACCESS
            </Text>
          </View>

          <Text
            style={{
              fontSize: 26,
              fontWeight: "800",
              color: adminUi.text,
              marginTop: 8,
              letterSpacing: 0.3,
            }}
          >
            Spendly Admin Portal
          </Text>
          <Text style={{ color: adminUi.textMuted, marginTop: 6, marginBottom: 20 }}>
            Secure access for payroll, schedules, and system controls.
          </Text>
          <Text style={{ color: adminUi.textMuted, marginBottom: 20 }}>
            Welcome back, administrator. Please verify your credentials to
            continue managing worker operations.
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
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
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
              lineHeight: 16,
            }}
          >
            Authorized personnel only. By signing in, you agree to Spendly's
            admin usage and data handling policies.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
