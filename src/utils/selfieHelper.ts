import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export type SelfieResult =
  | { captured: true; url: string }
  | { captured: false; reason: "cancelled" | "permission-denied" | "upload-failed" };

// Request camera permission and capture a front-facing selfie.
// Returns a hosted download URL on success, or a typed failure reason.
export async function captureSelfie(
  userId: string,
  action: "clock-in" | "clock-out"
): Promise<SelfieResult> {
  // 1. Request camera permission
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== ImagePicker.PermissionStatus.GRANTED) {
    return { captured: false, reason: "permission-denied" };
  }

  // 2. Launch front camera
  const result = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.front,
    allowsEditing: false,
    quality: 0.6,
    base64: false,
  });

  if (result.canceled || !result.assets?.length) {
    return { captured: false, reason: "cancelled" };
  }

  const asset = result.assets[0];

  // 3. Upload to Firebase Storage
  try {
    const timestamp = Date.now();
    const path = `selfies/${userId}/${action}-${timestamp}.jpg`;
    const storageRef = ref(storage, path);

    const response = await fetch(asset.uri);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

    const url = await getDownloadURL(storageRef);
    return { captured: true, url };
  } catch {
    return { captured: false, reason: "upload-failed" };
  }
}
