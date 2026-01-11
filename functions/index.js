const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

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

exports.createWorkerAuth = onCall({ region: "us-central1" }, async request => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const callerSnap = await admin.firestore().doc(`users/${request.auth.uid}`).get();
  const callerRole = callerSnap.data()?.role;
  if (callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const email = String(request.data?.email || "").trim().toLowerCase();
  if (!email) {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new HttpsError("invalid-argument", "Invalid email format.");
  }

  const displayName = String(request.data?.displayName || "").trim();
  const requestedUid = String(request.data?.uid || "").trim();

  let userRecord = null;
  let created = false;

  if (requestedUid) {
    try {
      userRecord = await admin.auth().getUser(requestedUid);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") {
        throw new HttpsError("internal", "Failed to look up auth user.");
      }
    }

    if (userRecord) {
      const authEmail = String(userRecord.email || "").toLowerCase();
      if (authEmail && authEmail !== email) {
        throw new HttpsError(
          "failed-precondition",
          "Auth UID belongs to a different email."
        );
      }
    } else {
      try {
        await admin.auth().getUserByEmail(email);
        throw new HttpsError("already-exists", "Email is already in use.");
      } catch (err) {
        if (err instanceof HttpsError) {
          throw err;
        }
        if (err?.code !== "auth/user-not-found") {
          throw new HttpsError("internal", "Failed to validate email.");
        }
      }

      userRecord = await admin.auth().createUser({
        uid: requestedUid,
        email,
        displayName: displayName || undefined,
      });
      created = true;
    }
  } else {
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") {
        throw new HttpsError("internal", "Failed to look up auth user.");
      }
    }

    if (!userRecord) {
      userRecord = await admin.auth().createUser({
        email,
        displayName: displayName || undefined,
      });
      created = true;
    }
  }

  if (userRecord && displayName && userRecord.displayName !== displayName) {
    await admin.auth().updateUser(userRecord.uid, { displayName });
  }

  const resetLink = await admin.auth().generatePasswordResetLink(email);

  return {
    uid: userRecord.uid,
    email,
    created,
    resetLink,
  };
});

exports.lookupWorkerAuth = onCall({ region: "us-central1" }, async request => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const callerSnap = await admin.firestore().doc(`users/${request.auth.uid}`).get();
  const callerRole = callerSnap.data()?.role;
  if (callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const email = String(request.data?.email || "").trim().toLowerCase();
  const requestedUid = String(request.data?.uid || "").trim();

  let userRecord = null;
  if (requestedUid) {
    try {
      userRecord = await admin.auth().getUser(requestedUid);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") {
        throw new HttpsError("internal", "Failed to look up auth UID.");
      }
    }
  }

  if (!userRecord && email) {
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") {
        throw new HttpsError("internal", "Failed to look up auth email.");
      }
    }
  }

  return {
    exists: Boolean(userRecord),
    uid: userRecord?.uid || "",
    email: userRecord?.email || email,
  };
});
