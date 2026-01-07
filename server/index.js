const express = require("express");

const app = express();
app.use(express.json({ limit: "256kb" }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  return next();
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.post("/chat", async (req, res) => {
  const payload = req.body || {};
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const history = Array.isArray(payload.history) ? payload.history : [];
  const context = payload.context && typeof payload.context === "object" ? payload.context : {};

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const pat = process.env.JAMAI_PAT;
  const projectId = process.env.JAMAI_PROJECT_ID;
  const chatUrl = process.env.JAMAI_CHAT_URL;

  if (!pat || !projectId || !chatUrl) {
    return res.status(500).json({
      error: "Missing JAMAI_PAT, JAMAI_PROJECT_ID, or JAMAI_CHAT_URL.",
    });
  }

  const systemPrompt =
    typeof context.system === "string" && context.system.trim()
      ? context.system.trim()
      : "You are a helpful finance assistant for budgeting, savings, debt payoff, and income planning. " +
        "Answer clearly and ask for missing context. Do not provide financial, legal, or tax advice.";

  const safeHistory = history
    .filter(
      item =>
        item &&
        typeof item === "object" &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
    .map(item => ({ role: item.role, content: item.content }));

  try {
    const response = await fetch(chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        project_id: projectId,
        messages: [
          { role: "system", content: systemPrompt },
          ...safeHistory,
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || "JamAI request failed.",
      });
    }

    const answer =
      data?.answer ||
      data?.choices?.[0]?.message?.content ||
      data?.output_text ||
      data?.text ||
      "";

    return res.status(200).json({
      answer,
      raw: answer ? undefined : data,
    });
  } catch (error) {
    return res.status(500).json({ error: "JamAI request failed." });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Chat proxy listening on ${port}`);
});
