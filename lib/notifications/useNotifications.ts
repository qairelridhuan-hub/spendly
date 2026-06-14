import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "@/lib/firebase";
import { safeSnapshot } from "@/lib/firebase/safeSnapshot";

export type SortOrder = "newest" | "oldest";

export const getTimeValue = (value: any) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

export function useNotifications() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [clearedAt, setClearedAt] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsub;
  }, []);

  const loadPersisted = useCallback(async () => {
    if (!userId) return;
    const [cleared, read, dismissed] = await Promise.all([
      AsyncStorage.getItem(`spendly:notifications:clearedAt:${userId}`),
      AsyncStorage.getItem(`spendly:notifications:readIds:${userId}`),
      AsyncStorage.getItem(`spendly:notifications:dismissedIds:${userId}`),
    ]);
    setClearedAt(cleared ? Number(cleared) : 0);
    setReadIds(read ? new Set(JSON.parse(read)) : new Set());
    setDismissedIds(dismissed ? new Set(JSON.parse(dismissed)) : new Set());
  }, [userId]);

  useEffect(() => {
    loadPersisted();
  }, [loadPersisted]);

  useFocusEffect(
    useCallback(() => {
      loadPersisted();
    }, [loadPersisted])
  );

  useEffect(() => {
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("targetRole", "in", ["worker", "all"])
    );
    const unsub = safeSnapshot(notificationsQuery, (snapshot) => {
      const list = snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setItems(list);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const list = items.filter((item) => {
      if (item.targetRole === "all") return true;
      if (!userId) return false;
      if (item.workerId && item.workerId !== userId) return false;
      return true;
    });
    const visible = list.filter(
      (item) => getTimeValue(item.createdAt) > clearedAt && !dismissedIds.has(item.id)
    );
    return visible
      .map((item) => ({ ...item, read: readIds.has(item.id) }))
      .sort((a, b) => {
        const diff = getTimeValue(b.createdAt) - getTimeValue(a.createdAt);
        return sortOrder === "newest" ? diff : -diff;
      });
  }, [items, userId, clearedAt, sortOrder, readIds, dismissedIds]);

  const unreadCount = useMemo(
    () => filtered.filter((item) => !item.read).length,
    [filtered]
  );

  const persistReadIds = async (next: Set<string>) => {
    setReadIds(next);
    if (!userId) return;
    await AsyncStorage.setItem(`spendly:notifications:readIds:${userId}`, JSON.stringify(Array.from(next)));
  };

  const markRead = async (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    await persistReadIds(next);
  };

  const markAllRead = async () => {
    const next = new Set(readIds);
    filtered.forEach((item) => next.add(item.id));
    await persistReadIds(next);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"));
  };

  const dismiss = async (id: string) => {
    if (!userId) return;
    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
    await AsyncStorage.setItem(`spendly:notifications:dismissedIds:${userId}`, JSON.stringify(Array.from(next)));
  };

  const clearAll = async () => {
    if (!userId) return;
    const now = Date.now();
    setClearedAt(now);
    await AsyncStorage.setItem(`spendly:notifications:clearedAt:${userId}`, String(now));
  };

  return {
    userId,
    items: filtered,
    unreadCount,
    sortOrder,
    toggleSortOrder,
    markRead,
    markAllRead,
    clearAll,
    dismiss,
  };
}
