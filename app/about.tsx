import { router } from "expo-router";
import { ArrowLeft, ShieldCheck, Sparkles, Target } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AboutScreen() {
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About Spendly</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Spendly</Text>
            <Text style={styles.heroSubtitle}>
              Track your shifts, earnings, and goals in one place.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={styles.iconWrap}>
                <Sparkles size={16} color="#111827" />
              </View>
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
              <View style={styles.iconWrap}>
                <Target size={16} color="#111827" />
              </View>
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
              <View style={styles.iconWrap}>
                <ShieldCheck size={16} color="#111827" />
              </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  safe: { flex: 1 },
  container: { padding: 16, paddingBottom: 60 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  headerSpacer: { width: 36 },
  heroCard: {
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
  heroSubtitle: { marginTop: 6, color: "#6b7280", fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardText: { fontSize: 14, color: "#6b7280", lineHeight: 22 },
  featureList: { gap: 8 },
  featureItem: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  footerCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  footerText: { fontSize: 14, fontWeight: "700", color: "#111827" },
  footerSubText: { marginTop: 4, fontSize: 12, color: "#6b7280" },
});
