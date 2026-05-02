import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  requestLocationPermission,
  getCurrentLocation,
} from "../utils/locationHelpers";

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
} | null;

export default function LocationTestScreen() {
  const [location, setLocation] = useState<LocationState>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const granted = await requestLocationPermission();
      setPermissionGranted(granted);

      if (!granted) {
        setError("Location permission denied.");
        return;
      }

      const coords = await getCurrentLocation();
      setLocation(coords);

      console.log("📍 Location:", coords);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location Test</Text>

      {permissionGranted === false && (
        <Text style={styles.error}>Permission denied</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {location ? (
        <View style={styles.card}>
          <Row label="Latitude"  value={location.latitude.toFixed(6)} />
          <Row label="Longitude" value={location.longitude.toFixed(6)} />
          <Row label="Accuracy"  value={location.accuracy != null ? `${location.accuracy.toFixed(1)} m` : "—"} />
        </View>
      ) : (
        !error && <Text style={styles.loading}>Fetching location…</Text>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" },
  title:     { fontSize: 20, fontWeight: "700", marginBottom: 24 },
  card:      { width: "100%", borderRadius: 14, borderWidth: 1, borderColor: "#e5e5e5", padding: 20, gap: 14 },
  row:       { flexDirection: "row", justifyContent: "space-between" },
  label:     { fontSize: 14, color: "#6b7280" },
  value:     { fontSize: 14, fontWeight: "600", color: "#000" },
  loading:   { fontSize: 14, color: "#6b7280" },
  error:     { fontSize: 14, color: "#dc2626", marginBottom: 12 },
});
