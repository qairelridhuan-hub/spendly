import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, ShieldCheck, Sparkles, Target } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";

export default function AboutScreen() {
  return (
    <LinearGradient colors={["#0b1220", "#111827"]} style={styles.screen}>
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={22} color="#e5e7eb" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About Spendly</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Spendly</Text>
            <Text style={styles.heroSubtitle}>
              Track your shifts, earnings, and goals in one place.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Sparkles size={18} color="#b7f34d" />
              <Text style={styles.cardTitle}>What it does</Text>
            </View>
            <Text style={styles.cardText}>
              Spendly helps workers stay on top of schedules, attendance, and
              salary insights. You can review upcoming shifts, see earnings
              summaries, and monitor spending goals with quick dashboards.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Target size={18} color="#b7f34d" />
              <Text style={styles.cardTitle}>Key features</Text>
            </View>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• Shift and attendance tracking</Text>
              <Text style={styles.featureItem}>• Earnings breakdowns by period</Text>
              <Text style={styles.featureItem}>• Goals and savings progress</Text>
              <Text style={styles.featureItem}>• Smart tips and insights</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <ShieldCheck size={18} color="#b7f34d" />
              <Text style={styles.cardTitle}>Your data</Text>
            </View>
            <Text style={styles.cardText}>
              Your data stays tied to your account and is used to personalize
              dashboards, reports, and goal progress. You control what you add,
              edit, or remove at any time.
            </Text>
          </View>

          <View style={styles.footerCard}>
            <Text style={styles.footerText}>Version 1.0</Text>
            <Text style={styles.footerSubText}>Built for Spendly users.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  container: { padding: 16, paddingBottom: 140 },
  bgBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(183,243,77,0.14)",
    top: -80,
    right: -60,
  },
  bgBlobAlt: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.6)",
    bottom: -120,
    left: -80,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#e5e7eb" },
  headerSpacer: { width: 36 },
  heroCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 16,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#e5e7eb" },
  heroSubtitle: { marginTop: 6, color: "#9ca3af", fontSize: 14 },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#e5e7eb" },
  cardText: { fontSize: 14, color: "#cbd5f5", lineHeight: 20 },
  featureList: { gap: 6 },
  featureItem: { fontSize: 14, color: "#cbd5f5" },
  footerCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(183,243,77,0.1)",
    borderWidth: 1,
    borderColor: "rgba(183,243,77,0.3)",
    alignItems: "center",
  },
  footerText: { fontSize: 14, fontWeight: "700", color: "#b7f34d" },
  footerSubText: { marginTop: 4, fontSize: 12, color: "#9ca3af" },
});
