import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft } from "lucide-react-native";
import { AnimatedBlobs } from "@/components/AnimatedBlobs";
import { useTheme } from "@/lib/context";
import { firebaseProjectId } from "@/lib/firebase";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const FINANCE_SYSTEM_PROMPT =
  "You are a helpful finance assistant for budgeting, savings, debt payoff, and income planning. " +
  "Answer clearly and ask for missing context. Do not provide financial, legal, or tax advice.";
const CHAT_HISTORY_LIMIT = 6;

export default function AiDashboardScreen() {
  const { colors } = useTheme();
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Ask me about budgeting, savings goals, debt payoff, or salary planning.",
    },
  ]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);

  const chatMessagesToShow = useMemo(
    () => chatMessages.slice(-CHAT_HISTORY_LIMIT),
    [chatMessages]
  );

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatSending) return;
    const envChatUrl = process.env.EXPO_PUBLIC_JAMAI_CHAT_URL ?? "";
    const defaultChatUrl = firebaseProjectId
      ? `https://us-central1-${firebaseProjectId}.cloudfunctions.net/jamAiChat`
      : "";
    const jamAiChatUrl = envChatUrl || defaultChatUrl;
    if (!jamAiChatUrl) {
      setChatError("Missing EXPO_PUBLIC_JAMAI_CHAT_URL.");
      return;
    }

    const historyPayload = chatMessagesToShow.map(({ role, content }) => ({
      role,
      content,
    }));
    const outgoing: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setChatMessages(prev => [...prev, outgoing]);
    setChatInput("");
    setChatSending(true);
    setChatError(null);

    try {
      const sendChatRequest = async (url: string) => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            context: {
              system: FINANCE_SYSTEM_PROMPT,
            },
          }),
        });
        const rawText = await response.text();
        let data: any = null;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          data = null;
        }
        return { response, data };
      };

      let { response, data } = await sendChatRequest(jamAiChatUrl);
      if (
        !response.ok &&
        response.status === 404 &&
        envChatUrl &&
        defaultChatUrl &&
        envChatUrl !== defaultChatUrl
      ) {
        ({ response, data } = await sendChatRequest(defaultChatUrl));
      }
      if (!response.ok) {
        const fallback =
          typeof data?.error === "string" && data.error
            ? data.error
            : `Assistant error (${response.status}).`;
        throw new Error(fallback);
      }
      if (!data) {
        throw new Error("Assistant returned an invalid response.");
      }
      const answer =
        typeof data?.answer === "string" && data.answer.trim()
          ? data.answer
          : "Sorry, I couldn't find an answer for that.";
      setChatMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reach JamAI.";
      setChatError(message);
      setChatMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I couldn't reach the assistant. Please try again.",
        },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.backgroundStart, colors.backgroundEnd]}
      style={styles.screen}
    >
      <AnimatedBlobs blobStyle={styles.bgBlob} blobAltStyle={styles.bgBlobAlt} />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Dashboard</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.cardTitle}>Finance chat</Text>
                <Text style={styles.cardHint}>
                  Ask about budgets, savings, debt, or income.
                </Text>
              </View>
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>AI</Text>
              </View>
            </View>

            <View style={styles.chatThread}>
              {chatMessagesToShow.map(message => (
                <View
                  key={message.id}
                  style={[
                    styles.chatBubble,
                    message.role === "user"
                      ? styles.chatBubbleUser
                      : styles.chatBubbleAssistant,
                  ]}
                >
                  <Text
                    style={
                      message.role === "user"
                        ? styles.chatBubbleUserText
                        : styles.chatBubbleAssistantText
                    }
                  >
                    {message.content}
                  </Text>
                </View>
              ))}
              {chatSending ? (
                <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                  <Text style={styles.chatBubbleAssistantText}>Thinking...</Text>
                </View>
              ) : null}
            </View>

            {chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}

            <View style={styles.chatInputRow}>
              <TextInput
                placeholder="Ask a financial question"
                placeholderTextColor="#94a3b8"
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.chatSendButton,
                  chatSending ? styles.chatSendDisabled : null,
                ]}
                onPress={handleSendChat}
                disabled={chatSending}
              >
                <Text style={styles.chatSendText}>
                  {chatSending ? "..." : "Send"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.chatDisclaimer}>
              For info only. Not financial, legal, or tax advice.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  bgBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(14,165,233,0.12)",
    top: -80,
    right: -60,
  },
  bgBlobAlt: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(249,115,22,0.12)",
    bottom: -120,
    left: -80,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  headerSpacer: { width: 34 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  cardHint: { fontSize: 12, color: "#64748b", marginTop: 4 },
  chatBadge: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chatBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  chatThread: {
    marginTop: 12,
    gap: 8,
  },
  chatBubble: {
    maxWidth: "85%",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  chatBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "#0ea5e9",
  },
  chatBubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
  },
  chatBubbleUserText: { color: "#ffffff", fontSize: 12 },
  chatBubbleAssistantText: { color: "#0f172a", fontSize: 12 },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    fontSize: 12,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  chatSendButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#0f172a",
  },
  chatSendDisabled: { opacity: 0.6 },
  chatSendText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  chatError: { marginTop: 6, color: "#ef4444", fontSize: 11 },
  chatDisclaimer: { marginTop: 8, fontSize: 10, color: "#94a3b8" },
});
