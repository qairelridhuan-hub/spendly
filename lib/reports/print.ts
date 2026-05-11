import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export const printReport = async (html: string, filename = "spendly-report.pdf") => {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;

    // Write into a hidden iframe so popup blockers don't interfere
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    document.body.appendChild(iframe);

    iframe.srcdoc = html;

    // Wait for iframe to load before printing
    await new Promise<void>(resolve => {
      iframe.onload = () => resolve();
      setTimeout(resolve, 800); // fallback
    });
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Clean up after a delay (print dialog is async)
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 3000);
    return;
  }

  // Native: generate PDF file then share / open
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: filename.replace(".pdf", ""),
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
};
