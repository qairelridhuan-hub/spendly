"use client";

import { useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";

export type MapViewport = {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
};

// Internal context so MapControls can talk to the Map
const MapCtx = createContext<{
  mapRef: React.MutableRefObject<any>;
  vp: MapViewport;
  fullscreen: boolean;
  setFullscreen: (v: boolean) => void;
} | null>(null);

// ── Leaflet loader ────────────────────────────────────────────────────────────

async function loadLeaflet(): Promise<any> {
  if ((window as any).L) return (window as any).L;
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  if (!document.getElementById("leaflet-zoom-style")) {
    const style = document.createElement("style");
    style.id = "leaflet-zoom-style";
    style.textContent = `
      .leaflet-control-zoom {
        border: none !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.12) !important;
        border-radius: 10px !important;
        overflow: hidden;
        margin-bottom: 12px !important;
        margin-right: 12px !important;
      }
      .leaflet-control-zoom-in,
      .leaflet-control-zoom-out {
        width: 32px !important; height: 32px !important;
        line-height: 32px !important; font-size: 16px !important;
        font-weight: 400 !important; color: #18181b !important;
        background: rgba(255,255,255,0.92) !important;
        border: none !important;
        border-bottom: 1px solid rgba(0,0,0,0.07) !important;
        transition: background 0.15s;
      }
      .leaflet-control-zoom-out { border-bottom: none !important; }
      .leaflet-control-zoom-in:hover,
      .leaflet-control-zoom-out:hover {
        background: #18181b !important; color: #fff !important;
      }
      .leaflet-bar a { border-radius: 0 !important; }
      .leaflet-control-attribution { display: none !important; }
    `;
    document.head.appendChild(style);
  }
  await new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
  return (window as any).L;
}

// ── MapControls ───────────────────────────────────────────────────────────────

type MapControlsProps = {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  showZoom?: boolean;
  showCompass?: boolean;
  showLocate?: boolean;
  showFullscreen?: boolean;
};

export function MapControls({
  position = "top-right",
  showZoom = true,
  showCompass,
  showLocate,
  showFullscreen = true,
}: MapControlsProps) {
  const ctx = useContext(MapCtx);
  if (!ctx) return null;
  const { mapRef, vp, fullscreen, setFullscreen } = ctx;

  const posStyle: React.CSSProperties = {
    position: "absolute", zIndex: 1000,
    display: "flex", flexDirection: "column", gap: 6,
    ...(position === "top-right"    ? { top: 10, right: 10 } : {}),
    ...(position === "top-left"     ? { top: 10, left: 10  } : {}),
    ...(position === "bottom-right" ? { bottom: 10, right: 10 } : {}),
    ...(position === "bottom-left"  ? { bottom: 10, left: 10  } : {}),
  };

  const btnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, cursor: "pointer",
    background: "rgba(255,255,255,0.92)", border: "1px solid rgba(0,0,0,0.1)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#18181b", transition: "background 0.15s",
  };

  return (
    <div style={posStyle}>
      {showFullscreen && (
        <button
          style={btnStyle}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => setFullscreen(!fullscreen)}
          onMouseEnter={e => (e.currentTarget.style.background = "#18181b")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.92)")}
        >
          {fullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
              <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 7V3h4"/><path d="M17 3h4v4"/><path d="M21 17v4h-4"/><path d="M7 21H3v-4"/>
            </svg>
          )}
        </button>
      )}
      {showLocate && (
        <button
          style={btnStyle}
          title="My location"
          onClick={() => {
            navigator.geolocation?.getCurrentPosition(pos => {
              mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 0.8 });
            });
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#18181b")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.92)")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
        </button>
      )}
      {showCompass && (
        <button style={{ ...btnStyle, fontSize: 14, fontWeight: 700 }} title="Reset bearing">
          ↑
        </button>
      )}
      {showZoom && (
        <div style={{ display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <button
            style={{ ...btnStyle, borderRadius: 0, borderBottom: "1px solid rgba(0,0,0,0.07)", boxShadow: "none" }}
            title="Zoom in"
            onClick={() => mapRef.current?.zoomIn()}
            onMouseEnter={e => { e.currentTarget.style.background = "#18181b"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.92)"; (e.currentTarget as HTMLButtonElement).style.color = "#18181b"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button
            style={{ ...btnStyle, borderRadius: 0, boxShadow: "none" }}
            title="Zoom out"
            onClick={() => mapRef.current?.zoomOut()}
            onMouseEnter={e => { e.currentTarget.style.background = "#18181b"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.92)"; (e.currentTarget as HTMLButtonElement).style.color = "#18181b"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Map ───────────────────────────────────────────────────────────────────────

type MapProps = {
  // Simple API
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  // Controlled API
  viewport?: MapViewport;
  onViewportChange?: (v: MapViewport) => void;
  // Interactions
  onClick?: (coords: { lat: number; lng: number }) => void;
  onConfirm?: (coords: { lat: number; lng: number }) => void;
  marker?: { lat: number; lng: number } | null;
  radiusMeters?: number;
  inside?: boolean;
  children?: ReactNode;
};

export function Map({
  center,
  zoom: zoomProp,
  viewport,
  onViewportChange,
  onClick,
  onConfirm,
  marker,
  radiusMeters = 15,
  inside,
  children,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const initCenter: [number, number] = center ?? viewport?.center ?? [101.6869, 3.139];
  const initZoom = zoomProp ?? viewport?.zoom ?? 12;

  const [vp, setVp] = useState<MapViewport>(
    viewport ?? { center: initCenter, zoom: initZoom, bearing: 0, pitch: 0 }
  );

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false })
        .setView([initCenter[1], initCenter[0]], initZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      map.on("move", () => {
        const c = map.getCenter();
        const next: MapViewport = { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: 0, pitch: 0 };
        setVp(next);
        onViewportChange?.(next);
      });

      map.on("click", (e: any) => {
        const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
        onClick?.(coords);
        if (onConfirm) { setPending(coords); setConfirmed(false); }
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !viewport) return;
    mapRef.current.setView([viewport.center[1], viewport.center[0]], viewport.zoom);
  }, [viewport]);

  useEffect(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 50);
  }, [fullscreen]);

  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;
    if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
    if (circleRef.current) { map.removeLayer(circleRef.current); circleRef.current = null; }
    if (!marker) return;

    const zoneColor = inside === false ? "#dc2626" : "#16a34a";
    const icon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#18181b;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8], className: "",
    });
    markerRef.current = L.marker([marker.lat, marker.lng], { icon }).addTo(map);
    circleRef.current = L.circle([marker.lat, marker.lng], {
      radius: radiusMeters, color: zoneColor, fillColor: zoneColor, fillOpacity: 0.15, weight: 2,
    }).addTo(map);
    map.flyTo([marker.lat, marker.lng], 16, { duration: 0.8 });
  }, [marker, radiusMeters, inside]);

  const display = viewport ?? vp;

  const inner = (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Viewport info bar — top left */}
      <div style={{
        position: "absolute", top: 8, left: 8, zIndex: 1000,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(6px)",
        border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8,
        padding: "5px 12px", fontFamily: "monospace", fontSize: 11,
        display: "flex", flexWrap: "wrap" as const, gap: "4px 12px",
        pointerEvents: "none",
      }}>
        <span><span style={{ color: "#888" }}>lng:</span> <b>{display.center[0].toFixed(3)}</b></span>
        <span><span style={{ color: "#888" }}>lat:</span> <b>{display.center[1].toFixed(3)}</b></span>
        <span><span style={{ color: "#888" }}>zoom:</span> <b>{display.zoom.toFixed(1)}</b></span>
        <span><span style={{ color: "#888" }}>bearing:</span> <b>{display.bearing.toFixed(1)}°</b></span>
        <span><span style={{ color: "#888" }}>pitch:</span> <b>{display.pitch.toFixed(1)}°</b></span>
      </div>

      {/* Location confirm popup */}
      {onConfirm && pending && (
        <div style={{
          position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
          zIndex: 1001, background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          border: "1px solid rgba(0,0,0,0.07)",
          padding: "14px 16px", minWidth: 260, maxWidth: 320,
        }}>
          {confirmed ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#18181b" }}>Location set</span>
            </div>
          ) : (
            <>
              {/* Coords row */}
              <div style={{ display: "flex", gap: 0, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>Lat</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b", fontFamily: "monospace" }}>{pending.lat.toFixed(5)}</div>
                </div>
                <div style={{ width: 1, background: "rgba(0,0,0,0.07)", margin: "0 12px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>Lng</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b", fontFamily: "monospace" }}>{pending.lng.toFixed(5)}</div>
                </div>
                <div style={{ width: 1, background: "rgba(0,0,0,0.07)", margin: "0 12px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>Radius</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b", fontFamily: "monospace" }}>{radiusMeters}m</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 7 }}>
                <button
                  onClick={() => setPending(null)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 9,
                    border: "1px solid rgba(0,0,0,0.1)",
                    background: "transparent", color: "#6b7280",
                    fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onConfirm(pending);
                    setConfirmed(true);
                    setTimeout(() => { setPending(null); setConfirmed(false); }, 1800);
                  }}
                  style={{
                    flex: 2, padding: "7px 0", borderRadius: 9, border: "none",
                    background: "#18181b", color: "#fff",
                    fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}
                >
                  Confirm location
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Children (MapControls renders here via context) */}
      <MapCtx.Provider value={{ mapRef, vp: display, fullscreen, setFullscreen }}>
        {children}
      </MapCtx.Provider>
    </div>
  );

  if (fullscreen) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#000" }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "inherit", overflow: "hidden" }}>
      {inner}
    </div>
  );
}
