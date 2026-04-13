import { Platform } from "react-native";

export const cardShadow =
  Platform.OS === "web"
    ? { boxShadow: "0 10px 24px rgba(0,0,0,0.08)" }
    : {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      };
