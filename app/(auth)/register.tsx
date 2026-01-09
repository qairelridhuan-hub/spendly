import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Mail, Lock, User } from "lucide-react-native";
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
import { AuthWaveBackground } from "@/components/AuthWaveBackground";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleRegister = async () => {
    setError("");

    if (!fullName.trim() || !email.trim() || !password) {
      setError("All fields are required");
      return;
    }

    if (!validateEmail(email.trim())) {
      setError("Invalid email address");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(credential.user, {
        displayName: fullName.trim(),
      });

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
          {/* BACK */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 16 }}
          >
            <Text style={{ color: "#B7F34D" }}>← Back to Login</Text>
          </TouchableOpacity>

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
              fontSize: 24,
              fontWeight: "700",
              textAlign: "center",
              marginBottom: 4,
              color: "#e2e8f0",
            }}
          >
            Create Account
          </Text>

          <Text
            style={{
              textAlign: "center",
              color: "#94a3b8",
              marginBottom: 24,
            }}
          >
            Register as a part-time worker
          </Text>

          {/* FULL NAME */}
          <View style={{ position: "relative", marginBottom: 12 }}>
            <User
              size={20}
              color="#94a3b8"
              style={{ position: "absolute", left: 14, top: 16 }}
            />
            <TextInput
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
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
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
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

          {/* ERROR */}
          {error ? (
            <Text
              style={{
                color: "red",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              {error}
            </Text>
          ) : null}

          {/* BUTTON */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            style={{
              backgroundColor: "#B7F34D",
              padding: 16,
              borderRadius: 14,
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
              {loading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
