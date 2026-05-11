export function formatFirebaseError(err: any) {
  const code = String(err?.code || "");
  if (code === "permission-denied") {
    return "Permission denied. Check Firestore rules and that your user has admin role.";
  }
  if (code === "failed-precondition") {
    return "Missing Firestore index for this query. Open the console error link to create it.";
  }
  if (code === "unavailable") {
    return "Firebase is unavailable. Check your network connection.";
  }
  if (code === "unauthenticated") {
    return "You are not authenticated. Please log in again.";
  }
  return String(err?.message || "Unknown Firebase error.");
}

export function makeSnapshotErrorHandler(
  setError: (message: string) => void,
  context: string
) {
  return (err: any) => {
    const message = formatFirebaseError(err);
    console.error(`[firebase] ${context}`, err);
    setError(message);
  };
}
