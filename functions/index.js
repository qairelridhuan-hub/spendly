const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

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
