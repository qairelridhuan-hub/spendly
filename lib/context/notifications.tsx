import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { safeSnapshot } from "@/lib/firebase/safeSnapshot";
import { NotificationToast, ToastData } from "@/components/NotificationToast";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationsContextValue {
  toast: ToastData | null;
  dismissToast: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  toast: null,
  dismissToast: () => {},
});

export const useInAppNotifications = () => useContext(NotificationsContext);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

  useEffect(() => {
    seenIds.current = null;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("targetRole", "in", ["worker", "all"])
    );

    const unsub = safeSnapshot(notificationsQuery, (snapshot) => {
      const list = snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const relevant = list.filter((item: any) => {
        if (item.targetRole === "all") return true;
        if (!userId) return false;
        if (item.workerId && item.workerId !== userId) return false;
        return true;
      });

      if (seenIds.current === null) {
        seenIds.current = new Set(relevant.map((item: any) => item.id));
        return;
      }

      const fresh = relevant.filter((item: any) => !seenIds.current!.has(item.id));
      fresh.forEach((item: any) => {
        seenIds.current!.add(item.id);

        setToast({
          id: item.id,
          title: item.title || "Notification",
          message: item.message || "",
        });

        Notifications.scheduleNotificationAsync({
          content: {
            title: item.title || "Spendly",
            body: item.message || "",
          },
          trigger: null,
        }).catch(() => {});
      });
    });

    return unsub;
  }, [userId]);

  const dismissToast = () => setToast(null);

  return (
    <NotificationsContext.Provider value={{ toast, dismissToast }}>
      {children}
      <NotificationToast toast={toast} onDismiss={dismissToast} />
    </NotificationsContext.Provider>
  );
}
