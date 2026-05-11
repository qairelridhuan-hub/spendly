const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

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

exports.askAI = onCall({ region: "us-central1" }, async request => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const question = String(request.data?.question || "").trim();
  if (!question) {
    throw new HttpsError("invalid-argument", "Question is required.");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  // Fetch user's financial data in parallel
  const [
    userSnap,
    attendanceSnap,
    goalsSnap,
    payrollSnap,
    overtimeSnap,
    configSnap,
  ] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/attendance`).orderBy("date", "desc").limit(30).get(),
    db.collection(`users/${uid}/goals`).get(),
    db.collection(`users/${uid}/payroll`).orderBy("period", "desc").limit(6).get(),
    db.collection(`users/${uid}/overtime`).orderBy("date", "desc").limit(30).get(),
    db.doc("config/system").get(),
  ]);

  const user = userSnap.data() || {};
  const config = configSnap.data() || {};

  const attendance = attendanceSnap.docs.map(d => d.data());
  const goals = goalsSnap.docs.map(d => d.data());
  const payroll = payrollSnap.docs.map(d => d.data());
  const overtime = overtimeSnap.docs.map(d => d.data());

  // Build earnings summary
  const totalApproved = attendance.filter(a => a.status === "approved");
  const totalHours = totalApproved.reduce((s, a) => s + (a.netHours || a.hours || 0), 0);
  const hourlyRate = Number(user.hourlyRate || config.hourlyRate || 0);
  const totalEarnings = totalHours * hourlyRate;
  const totalOvertimeHours = overtime.reduce((s, o) => s + (o.hours || 0), 0);
  const overtimeRate = Number(config.overtimeRate || hourlyRate * (config.otMultiplier || 1.5));
  const totalOvertimePay = totalOvertimeHours * overtimeRate;

  const goalsData = goals.map(g => ({
    name: g.name || g.title,
    target: g.targetAmount || g.target,
    saved: g.savedAmount || g.saved || 0,
    deadline: g.deadline || g.targetDate,
  }));

  const latestPayroll = payroll[0] || null;

  const context = `
You are Spendly AI, a personal financial assistant for ${user.displayName || user.fullName || "the user"}.
You have access to their real financial data from the Spendly app. Answer questions helpfully, concisely, and based on this data.

=== USER PROFILE ===
Name: ${user.displayName || user.fullName || "Unknown"}
Role: ${user.role || "worker"}
Hourly rate: RM ${hourlyRate}/hr
Overtime rate: RM ${overtimeRate}/hr
Pay type: ${config.payType || "hourly"}

=== RECENT ATTENDANCE (last 30 records) ===
Total approved shifts: ${totalApproved.length}
Total hours worked: ${totalHours.toFixed(1)} hrs
Total earnings from hours: RM ${totalEarnings.toFixed(2)}
Total overtime hours: ${totalOvertimeHours.toFixed(1)} hrs
Total overtime pay: RM ${totalOvertimePay.toFixed(2)}
Late arrivals: ${attendance.filter(a => a.isLate).length}
Early leaves: ${attendance.filter(a => a.isEarlyLeave).length}
Pending approvals: ${attendance.filter(a => a.status === "pending").length}

=== LATEST PAYROLL ===
${latestPayroll ? `Period: ${latestPayroll.period}, Net pay: RM ${(latestPayroll.netPay || latestPayroll.finalPay || 0).toFixed(2)}, Hours: ${(latestPayroll.totalHours || 0).toFixed(1)}` : "No payroll records yet."}

=== SAVINGS GOALS ===
${goalsData.length === 0 ? "No goals set yet." : goalsData.map(g => `- ${g.name}: saved RM ${Number(g.saved).toFixed(2)} of RM ${Number(g.target).toFixed(2)}${g.deadline ? `, deadline: ${g.deadline}` : ""}`).join("\n")}

=== WORK POLICY ===
Working days/week: ${config.workingDaysPerWeek || "Not set"}
Hours/day: ${config.hoursPerDay || "Not set"}
OT after: ${config.otAfterHours || 8} hrs
Break policy: ${config.breakPaid ? "Paid breaks" : "Unpaid breaks"}
`.trim();

  const apiKey = process.env.GEMINI_API_KEY || "AIzaSyAJtlZbm2dUcvQXAf_KR8wEfF6m_zMxUnw";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent([
    { text: context },
    { text: `User question: ${question}` },
  ]);

  const answer = result.response.text();
  return { answer };
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
