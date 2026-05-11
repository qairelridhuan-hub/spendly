/* eslint-disable no-console */
const admin = require("firebase-admin");
const path = require("path");

const SERVICE_ACCOUNT_PATH =
  "/Users/qairel/Downloads/spendly-68ea0-firebase-adminsdk-fbsvc-442cd67962.json";

const app = admin.initializeApp({
  credential: admin.credential.cert(
    require(path.resolve(SERVICE_ACCOUNT_PATH))
  ),
});

const db = app.firestore();

async function approveAllAttendance() {
  const snapshot = await db.collectionGroup("attendance").get();
  if (snapshot.empty) {
    console.log("No attendance logs found.");
    return;
  }

  let batch = db.batch();
  let batchCount = 0;
  let total = 0;

  for (const docSnap of snapshot.docs) {
    batch.update(docSnap.ref, {
      status: "approved",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batchCount += 1;
    total += 1;

    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Approved ${total} attendance logs.`);
}

approveAllAttendance()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
