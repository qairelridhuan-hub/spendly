const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const admin = require("firebase-admin");

const args = process.argv.slice(2);
const serviceAccountPath = args[0];

const getArgValue = flag => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] || null;
};

const hasFlag = flag => args.includes(flag);

if (!serviceAccountPath) {
  console.error(
    "Usage: node scripts/sync-workers-to-auth.js /absolute/path/to/serviceAccount.json [--password <tempPassword>] [--reset-links] [--print-passwords] [--update-firestore] [--dry-run]"
  );
  process.exit(1);
}

const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Service account file not found: ${resolvedPath}`);
  process.exit(1);
}

const password = getArgValue("--password");
const resetLinks = hasFlag("--reset-links");
const printPasswords = hasFlag("--print-passwords");
const updateFirestore = hasFlag("--update-firestore");
const dryRun = hasFlag("--dry-run");
const shouldPrintPassword = printPasswords || Boolean(password);

if (password && password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

if (!password && !resetLinks && !printPasswords) {
  console.error(
    "Provide --password, --reset-links, or --print-passwords so created accounts can be accessed."
  );
  process.exit(1);
}

const serviceAccount = require(resolvedPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

const randomPassword = () => crypto.randomBytes(12).toString("hex");

const getDisplayName = data =>
  String(data.fullName || data.displayName || data.email || "Worker").trim();

const normalizeEmail = value => String(value || "").trim().toLowerCase();

const shouldUpdateDoc = updateFirestore && !dryRun;

async function sync() {
  const snapshot = await db.collection("users").where("role", "==", "worker").get();
  const seenEmails = new Set();
  const results = {
    total: snapshot.size,
    created: [],
    existing: [],
    conflicts: [],
    skipped: [],
  };

  for (const docSnap of snapshot.docs) {
    const workerId = docSnap.id;
    const data = docSnap.data() || {};
    const email = normalizeEmail(data.email);

    if (!email) {
      results.skipped.push({ workerId, reason: "missing-email" });
      continue;
    }

    if (seenEmails.has(email)) {
      results.skipped.push({ workerId, email, reason: "duplicate-email" });
      continue;
    }
    seenEmails.add(email);

    let existingUser = null;
    try {
      existingUser = await auth.getUserByEmail(email);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") {
        results.skipped.push({ workerId, email, reason: "auth-lookup-failed" });
        continue;
      }
    }

    if (existingUser) {
      if (existingUser.uid === workerId) {
        results.existing.push({ workerId, email, uid: existingUser.uid });
        continue;
      }
      results.conflicts.push({
        workerId,
        email,
        authUid: existingUser.uid,
        reason: "email-already-in-auth",
      });
      continue;
    }

    let existingByUid = null;
    try {
      existingByUid = await auth.getUser(workerId);
    } catch (err) {
      if (err?.code !== "auth/user-not-found") {
        results.skipped.push({ workerId, email, reason: "auth-uid-lookup-failed" });
        continue;
      }
    }

    if (existingByUid) {
      results.conflicts.push({
        workerId,
        email,
        authUid: existingByUid.uid,
        authEmail: existingByUid.email || "",
        reason: "uid-already-in-auth",
      });
      continue;
    }

    const generatedPassword = password || randomPassword();
    if (dryRun) {
      results.created.push({ workerId, email, password: generatedPassword, dryRun: true });
      continue;
    }

    try {
      const created = await auth.createUser({
        uid: workerId,
        email,
        displayName: getDisplayName(data),
        password: generatedPassword,
      });
      const createdEntry = { workerId, email, uid: created.uid };
      if (shouldPrintPassword) {
        createdEntry.password = generatedPassword;
      }
      if (resetLinks) {
        createdEntry.resetLink = await auth.generatePasswordResetLink(email);
      }
      results.created.push(createdEntry);

      if (shouldUpdateDoc) {
        await docSnap.ref.set(
          {
            authUid: created.uid,
            authLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      results.skipped.push({ workerId, email, reason: "auth-create-failed" });
    }
  }

  console.log(`Workers scanned: ${results.total}`);
  console.log(`Created auth users: ${results.created.length}`);
  console.log(`Already linked: ${results.existing.length}`);
  console.log(`Conflicts: ${results.conflicts.length}`);
  console.log(`Skipped: ${results.skipped.length}`);

  if (results.conflicts.length) {
    console.log("\nConflicts (cannot auto-link):");
    results.conflicts.forEach(item => {
      const authEmail = item.authEmail ? `, auth email ${item.authEmail}` : "";
      console.log(`- ${item.email} (worker doc ${item.workerId}, auth uid ${item.authUid}${authEmail})`);
    });
  }

  if (results.created.length) {
    console.log("\nCreated accounts:");
    results.created.forEach(item => {
      const parts = [`- ${item.email} (uid ${item.workerId})`];
      if (item.password) parts.push(`password: ${item.password}`);
      if (item.resetLink) parts.push(`resetLink: ${item.resetLink}`);
      if (item.dryRun) parts.push("dry-run");
      console.log(parts.join(" | "));
    });
  }

  if (results.skipped.length) {
    console.log("\nSkipped:");
    results.skipped.forEach(item => {
      console.log(`- ${item.workerId} ${item.email ? `(${item.email}) ` : ""}${item.reason}`);
    });
  }
}

sync()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
