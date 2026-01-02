import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export const printReport = async (html: string) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      }
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Spendly Report",
    });
  } else {
    await Print.printAsync({ html });
  }
};
