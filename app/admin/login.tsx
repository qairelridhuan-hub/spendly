import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Lock, Mail } from "lucide-react-native";
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
import { useTheme } from "@/lib/context";

export default function AdminLogin() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
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
      } else {
        setError("Login failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={{ flex: 1 }}
    >
      <View
        style={{
          position: "absolute",
          width: 360,
          height: 360,
          borderRadius: 180,
          backgroundColor: "rgba(14,165,233,0.12)",
          top: -120,
          right: -140,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          borderRadius: 210,
          backgroundColor: "rgba(34,197,94,0.12)",
          bottom: -180,
          left: -160,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 24 }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 28,
            borderWidth: 1,
            borderColor: colors.border,
            maxWidth: 420,
            alignSelf: "center",
            width: "100%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.accentStrong,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>💰</Text>
            </View>
            <View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Spendly
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
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
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Admin Only
            </Text>
          </View>

          <Text
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: colors.text,
              marginTop: 8,
            }}
          >
            Spendly Admin Portal
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 6, marginBottom: 20 }}>
            Secure access for payroll, schedules, and system controls.
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: 20 }}>
            Welcome back, administrator. Please verify your credentials to
            continue managing worker operations.
          </Text>

          <View style={{ position: "relative", marginBottom: 12 }}>
            <Mail
              size={20}
              color={colors.textMuted}
              style={{ position: "absolute", left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
                color: colors.text,
                backgroundColor: colors.surfaceAlt,
              }}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={{ position: "relative", marginBottom: 12 }}>
            <Lock
              size={20}
              color={colors.textMuted}
              style={{ position: "absolute", left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 14,
                paddingLeft: 44,
                color: colors.text,
                backgroundColor: colors.surfaceAlt,
              }}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {error ? (
            <Text style={{ color: colors.danger, textAlign: "center", marginBottom: 12 }}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: colors.accentStrong,
              padding: 14,
              borderRadius: 12,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>
              {loading ? "Signing in..." : "Sign in"}
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color: colors.textMuted,
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
