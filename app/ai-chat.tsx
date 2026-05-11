import Groq from "groq-sdk";
import Markdown from "react-native-markdown-display";
import { useTheme } from "@/lib/context";
import { auth, db } from "@/lib/firebase/firebase";
import { router } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft, Clock, Maximize2, Minimize2, Pencil, Send, Sparkles, Trash2, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";

type Message = { id: string; role: "user" | "ai"; text: string };
type ChatSession = { id: string; title: string; createdAt: any; messages: Message[] };

const WELCOME: Message = {
  id: "welcome",
  role: "ai",
  text: "Hi! I'm your Spendly AI assistant. Ask me anything about your earnings, goals, attendance, or financial progress.",
};

const ALL_SUGGESTIONS = [
  "How much have I earned this month?",
  "Am I on track with my savings goals?",
  "How many overtime hours did I work?",
  "What is my average daily earnings?",
  "How many shifts have I completed?",
  "What is my total overtime pay?",
  "Which goal has the most progress?",
  "How many late arrivals do I have?",
  "What is my projected earnings this month?",
  "How much more do I need to save for my goals?",
  "Am I working enough hours this week?",
  "What was my last payroll amount?",
];

function getRandomSuggestions() {
  const shuffled = [...ALL_SUGGESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}

async function buildContext(uid: string): Promise<string> {
  const [userSnap, attendanceSnap, goalsSnap, payrollSnap, overtimeSnap, configSnap] =
    await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDocs(query(collection(db, "users", uid, "attendance"), orderBy("date", "desc"), limit(30))),
      getDocs(collection(db, "users", uid, "goals")),
      getDocs(query(collection(db, "users", uid, "payroll"), orderBy("period", "desc"), limit(6))),
      getDocs(query(collection(db, "users", uid, "overtime"), orderBy("date", "desc"), limit(30))),
      getDoc(doc(db, "config", "system")),
    ]);

  const user = userSnap.data() || {} as any;
  const config = configSnap.data() || {} as any;
  const attendance = attendanceSnap.docs.map(d => d.data() as any);
  const goals = goalsSnap.docs.map(d => d.data() as any);
  const payroll = payrollSnap.docs.map(d => d.data() as any);
  const overtime = overtimeSnap.docs.map(d => d.data() as any);

  const hourlyRate = Number(user.hourlyRate || config.hourlyRate || 0);
  const overtimeRate = Number(config.overtimeRate || hourlyRate * (config.otMultiplier || 1.5));
  const approved = attendance.filter((a: any) => a.status === "approved");
  const totalHours = approved.reduce((s: number, a: any) => s + (a.netHours || a.hours || 0), 0);
  const totalOTHours = overtime.reduce((s: number, o: any) => s + (o.hours || 0), 0);
  const latestPayroll = payroll[0] || null;
  const goalsText = goals.length === 0
    ? "No goals set yet."
    : goals.map((g: any) =>
        `- ${g.name || g.title}: saved RM ${Number(g.savedAmount || g.saved || 0).toFixed(2)} of RM ${Number(g.targetAmount || g.target || 0).toFixed(2)}${g.deadline ? `, deadline: ${g.deadline}` : ""}`
      ).join("\n");

  return `
You are Spendly AI, a personal financial assistant for ${user.displayName || user.fullName || "the user"}.
You have access to their real financial data from the Spendly app. Answer helpfully and concisely based on this data. Format numbers as RM where applicable.

=== USER PROFILE ===
Name: ${user.displayName || user.fullName || "Unknown"}
Hourly rate: RM ${hourlyRate}/hr
Overtime rate: RM ${overtimeRate}/hr
Pay type: ${config.payType || "hourly"}

=== ATTENDANCE (last 30 records) ===
Approved shifts: ${approved.length}
Total hours worked: ${totalHours.toFixed(1)} hrs
Total earnings: RM ${(totalHours * hourlyRate).toFixed(2)}
Total overtime hours: ${totalOTHours.toFixed(1)} hrs
Total overtime pay: RM ${(totalOTHours * overtimeRate).toFixed(2)}
Late arrivals: ${attendance.filter((a: any) => a.isLate).length}
Early leaves: ${attendance.filter((a: any) => a.isEarlyLeave).length}
Pending approval: ${attendance.filter((a: any) => a.status === "pending").length}

=== LATEST PAYROLL ===
${latestPayroll
  ? `Period: ${latestPayroll.period}, Net pay: RM ${Number(latestPayroll.netPay || latestPayroll.finalPay || 0).toFixed(2)}, Hours: ${Number(latestPayroll.totalHours || 0).toFixed(1)}`
  : "No payroll records yet."}

=== SAVINGS GOALS ===
${goalsText}

=== WORK POLICY ===
Working days/week: ${config.workingDaysPerWeek || "Not set"}
Hours/day: ${config.hoursPerDay || "Not set"}
OT after: ${config.otAfterHours || 8} hrs
`.trim();
}

function formatDate(ts: any): string {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export default function AIChatScreen() {
  const { colors } = useTheme();
  const c = colors;
  const [suggestions] = useState<string[]>(getRandomSuggestions);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySortOrder, setHistorySortOrder] = useState<"latest" | "oldest">("latest");
  const [historyFullScreen, setHistoryFullScreen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const deleteSession = async (sessionId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "aiChats", sessionId));
    setHistory(prev => prev.filter(s => s.id !== sessionId));
    if (chatId === sessionId) {
      setMessages([WELCOME]);
      setChatId(null);
    }
  };

  const loadHistory = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setHistoryLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "users", uid, "aiChats"), orderBy("createdAt", "desc"), limit(20))
      );
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession)));
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setShowHistory(true);
    loadHistory();
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setChatId(session.id);
    setShowHistory(false);
  };

  const newChat = () => {
    setMessages([WELCOME]);
    setChatId(null);
    setShowHistory(false);
  };

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: question };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not authenticated");

      const context = await buildContext(uid);
      const groq = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true } as any);
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: context },
          { role: "user", content: question },
        ],
      });

      const answer = completion.choices[0]?.message?.content || "No response.";
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "ai", text: answer };
      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      // Save to Firebase
      const chatsRef = collection(db, "users", uid, "aiChats");
      const title = question.length > 50 ? question.slice(0, 50) + "…" : question;

      if (chatId) {
        await updateDoc(doc(db, "users", uid, "aiChats", chatId), {
          messages: finalMessages,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newDoc = await addDoc(chatsRef, {
          title,
          messages: finalMessages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setChatId(newDoc.id);
      }
    } catch (err: any) {
      console.error("AI error:", err?.message || err);
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "ai", text: `Error: ${err?.message || "Unknown error"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.backgroundStart }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
          <ArrowLeft size={18} color={c.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.text, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
          <Sparkles size={18} color={c.backgroundStart} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>Spendly AI</Text>
          <Text style={{ fontSize: 11, color: c.textMuted }}>Financial assistant</Text>
        </View>
        <TouchableOpacity onPress={newChat} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
          <Pencil size={16} color={c.text} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={openHistory} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
          <Clock size={16} color={c.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>

          {/* Welcome hero — only shown as first message */}
          {messages[0]?.id === "welcome" && (
            <View style={{ alignItems: "center", paddingVertical: 24, marginBottom: 8 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.text, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Sparkles size={30} color={c.backgroundStart} strokeWidth={1.8} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: c.text, marginBottom: 6, letterSpacing: -0.5 }}>Spendly AI</Text>
              <Text style={{ fontSize: 13, color: c.textMuted, textAlign: "center", lineHeight: 20, maxWidth: 260 }}>
                Your personal financial assistant. Ask me anything about your earnings, goals, or attendance.
              </Text>
            </View>
          )}

          {/* Messages — skip welcome, shown in hero */}
          <View style={{ gap: 12 }}>
            {messages.filter(m => m.id !== "welcome").map(msg => (
              <View key={msg.id} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                {msg.role === "ai" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: c.text, alignItems: "center", justifyContent: "center" }}>
                      <Sparkles size={10} color={c.backgroundStart} strokeWidth={2} />
                    </View>
                    <Text style={{ fontSize: 10, color: c.textMuted, fontWeight: "600" }}>Spendly AI</Text>
                  </View>
                )}
                <View style={{
                  backgroundColor: msg.role === "user" ? c.text : c.surface,
                  borderRadius: 18,
                  borderTopRightRadius: msg.role === "user" ? 4 : 18,
                  borderTopLeftRadius: msg.role === "ai" ? 4 : 18,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: msg.role === "ai" ? 1 : 0,
                  borderColor: c.border,
                }}>
                  {msg.role === "user" ? (
                    <Text style={{ fontSize: 13, color: c.backgroundStart, lineHeight: 20 }}>{msg.text}</Text>
                  ) : (
                    <Markdown style={{
                      body: { color: c.text, fontSize: 13, lineHeight: 20 },
                      strong: { fontWeight: "700", color: c.text },
                      bullet_list: { marginVertical: 4 },
                      ordered_list: { marginVertical: 4 },
                      list_item: { marginBottom: 4 },
                      paragraph: { marginVertical: 2 },
                    }}>
                      {msg.text}
                    </Markdown>
                  )}
                </View>
              </View>
            ))}
          </View>

          {loading && (
            <View style={{ alignSelf: "flex-start", maxWidth: "82%", marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: c.text, alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={10} color={c.backgroundStart} strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 10, color: c.textMuted, fontWeight: "600" }}>Spendly AI</Text>
              </View>
              <View style={{ backgroundColor: c.surface, borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: c.border, flexDirection: "row", gap: 6, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.textMuted, opacity: 0.5 + i * 0.2 }} />
                ))}
              </View>
            </View>
          )}

          {/* Suggestions — 2x2 grid */}
          {messages.length === 1 && !loading && (
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: "700", letterSpacing: 0.8, marginBottom: 10 }}>TRY ASKING</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {suggestions.map((s: string) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => send(s)}
                    style={{
                      width: "47%",
                      backgroundColor: c.surface,
                      borderRadius: 14,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: c.border,
                      gap: 8,
                    }}
                  >
                    <Sparkles size={14} color={c.textMuted} strokeWidth={2} />
                    <Text style={{ fontSize: 12, color: c.text, lineHeight: 17, fontWeight: "500" }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.backgroundStart }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your finances..."
            placeholderTextColor={c.textMuted}
            multiline
            selectionColor={c.text}
            style={{
              flex: 1,
              backgroundColor: c.surface,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 13,
              color: c.text,
              maxHeight: 100,
            } as any}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || loading}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: input.trim() && !loading ? c.text : c.surfaceAlt,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Send size={16} color={input.trim() && !loading ? c.backgroundStart : c.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide" presentationStyle={historyFullScreen ? "fullScreen" : "pageSheet"} onRequestClose={() => setShowHistory(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.backgroundStart }} edges={["top"]}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: c.text }}>Chat History</Text>
            <TouchableOpacity
              onPress={() => setHistorySortOrder(o => o === "latest" ? "oldest" : "latest")}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, marginRight: 8 }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: c.text }}>{historySortOrder === "latest" ? "Latest ↓" : "Oldest ↑"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setHistoryFullScreen(f => !f)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              {historyFullScreen ? <Minimize2 size={15} color={c.text} strokeWidth={2} /> : <Maximize2 size={15} color={c.text} strokeWidth={2} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowHistory(false); setHistoryFullScreen(false); }} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
              <X size={16} color={c.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {historyLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={c.textMuted} />
            </View>
          ) : history.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Clock size={32} color={c.textMuted} strokeWidth={1.5} />
              <Text style={{ color: c.textMuted, fontSize: 13 }}>No chat history yet</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {[...history].sort((a, b) => {
                const aTs = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
                const bTs = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
                return historySortOrder === "latest" ? bTs - aTs : aTs - bTs;
              }).map(session => (
                <View key={session.id} style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity onPress={() => loadSession(session)} style={{ flex: 1, padding: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 4 }} numberOfLines={1}>
                      {session.title}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Clock size={11} color={c.textMuted} strokeWidth={2} />
                      <Text style={{ fontSize: 11, color: c.textMuted }}>{formatDate(session.createdAt)}</Text>
                      <Text style={{ fontSize: 11, color: c.textMuted }}>· {session.messages.filter(m => m.role === "user").length} messages</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteSession(session.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 14, borderLeftWidth: 1, borderLeftColor: c.border }}
                  >
                    <Trash2 size={15} color="#dc2626" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
