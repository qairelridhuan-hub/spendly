import {
  onSnapshot,
  DocumentReference,
  CollectionReference,
  Query,
  DocumentData,
  Unsubscribe,
} from "firebase/firestore";

type SuccessCallback<T> = (snap: T) => void;

/** onSnapshot wrapper that logs Firestore errors instead of crashing silently. */
export function safeSnapshot<T extends DocumentData>(
  ref: DocumentReference<T> | CollectionReference<T> | Query<T>,
  onNext: SuccessCallback<any>,
): Unsubscribe {
  return onSnapshot(ref as any, onNext, (err) => {
    console.error("[Firestore]", err.code, err.message);
  });
}
