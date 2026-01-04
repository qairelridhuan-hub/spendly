const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const jamAiPat = defineSecret("JAMAI_PAT");
const jamAiProjectId = defineSecret("JAMAI_PROJECT_ID");
const jamAiChatUrl = defineSecret("JAMAI_CHAT_URL");

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful finance assistant for budgeting, savings, debt payoff, and income planning. " +
  "Answer clearly and ask for missing context. Do not provide financial, legal, or tax advice.";

exports.jamAiChat = onRequest(
  {
    region: "us-central1",
    cors: true,
    secrets: [jamAiPat, jamAiProjectId, jamAiChatUrl],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const payload = req.body || {};
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const history = Array.isArray(payload.history) ? payload.history : [];
    const context = payload.context && typeof payload.context === "object" ? payload.context : {};

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const pat = jamAiPat.value();
    const projectId = jamAiProjectId.value();
    const chatUrl = jamAiChatUrl.value();

    if (!pat || !projectId || !chatUrl) {
      return res.status(500).json({
        error: "Missing JAMAI_PAT, JAMAI_PROJECT_ID, or JAMAI_CHAT_URL.",
      });
    }

    const systemPrompt =
      typeof context.system === "string" && context.system.trim()
        ? context.system.trim()
        : DEFAULT_SYSTEM_PROMPT;

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

      const data = await response.json();
      if (!response.ok) {
        logger.warn("JamAI error", { status: response.status, data });
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
      logger.error("JamAI request failed", error);
      return res.status(500).json({ error: "JamAI request failed." });
    }
  }
);
