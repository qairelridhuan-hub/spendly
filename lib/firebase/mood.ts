import { collection, doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export function subscribeMoods(
  userId: string,
  onChange: (history: Record<string, string>) => void
) {
  const ref = collection(db, "users", userId, "moods");
  return onSnapshot(ref, (snapshot) => {
    const history: Record<string, string> = {};
    snapshot.docs.forEach((d) => { history[d.id] = d.data().mood; });
    onChange(history);
  });
}

export async function saveMood(userId: string, date: string, moodKey: string, note?: string) {
  await setDoc(doc(db, "users", userId, "moods", date), {
    mood: moodKey,
    note: note ?? "",
    timestamp: Timestamp.now(),
  });
}
