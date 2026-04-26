import { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

import type { MarketStat } from "@/lib/types";

type Props = {
  markets: MarketStat[];
  height?: number;
  width?: number;
};

const COUNTRIES_URL = "/countries.geojson";

type CountryFeature = {
  type: "Feature";
  properties: { ADMIN: string; ISO_A2: string };
  geometry: unknown;
};

/** Visibility → vibrant cobalt-blue gradient. Bigger jumps so the map reads
 * as a heatmap, not a wash. Untracked countries fade to porcelain. */
function visibilityFill(v: number): string {
  if (v >= 0.30) return "rgba(30, 91, 201, 0.92)"; // electric cobalt
  if (v >= 0.22) return "rgba(58, 124, 232, 0.82)"; // bright blue
  if (v >= 0.18) return "rgba(96, 154, 240, 0.70)"; // lighter blue
  if (v >= 0.14) return "rgba(140, 170, 230, 0.55)"; // soft blue
  if (v >= 0.10) return "rgba(165, 175, 210, 0.40)"; // pale blue
  return "rgba(200, 192, 210, 0.22)"; // porcelain (active but tiny)
}

function visibilityPoint(v: number): string {
  if (v >= 0.30) return "rgba(30, 91, 201, 1)";
  if (v >= 0.22) return "rgba(58, 124, 232, 1)";
  if (v >= 0.16) return "rgba(96, 154, 240, 0.95)";
  if (v >= 0.10) return "rgba(140, 170, 230, 0.85)";
  return "rgba(174, 156, 168, 0.7)";
}

/** ISO-A2 country code → flag emoji. */
function flagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return "";
  const A = 0x1f1e6;
  return iso
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(A + c.charCodeAt(0) - 65))
    .join("");
}

// City coordinates of competitor citation hubs that we animate arcs FROM
// (where competitor citations originate) INTO active markets we want to win.
const COMPETITOR_HUBS: { lat: number; lng: number; name: string }[] = [
  { lat: 40.7, lng: -74.0, name: "NYC" },
  { lat: 37.77, lng: -122.42, name: "SF" },
  { lat: 51.51, lng: -0.13, name: "London" },
];

export default function MarketGlobe({
  markets,
  height = 560,
  width = 560,
}: Props) {
  const ref = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [hoverD, setHoverD] = useState<CountryFeature | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRIES_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`countries fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data: { features?: CountryFeature[] }) => {
        if (cancelled) return;
        const features = (data.features ?? []).filter(
          (f) => f.properties?.ISO_A2 !== "AQ",
        );
        setCountries(features);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[MarketGlobe] countries fetch error", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => setReady(true), 30);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (!ready || !ref.current) return;
    const controls = ref.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45; // slow but visible
    controls.enableZoom = false;
    controls.enablePan = false;
    // Start framed on Europe — most active markets cluster there.
    // altitude 2.4 gives the atmosphere halo room to bloom around the edge.
    ref.current.pointOfView({ lat: 30, lng: 8, altitude: 2.4 }, 0);

    // Cap GPU work: clamp pixel ratio (retina ~2-3 → 1.5) and disable
    // auto-rotate when the tab is hidden.
    const renderer = ref.current.renderer?.();
    if (renderer && typeof renderer.setPixelRatio === "function") {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
    const onVis = () => {
      controls.autoRotate = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ready]);

  const marketByIso = useMemo(() => {
    const m = new Map<string, MarketStat>();
    for (const x of markets) m.set(x.country_code, x);
    return m;
  }, [markets]);

  // Pulsing rings — only on markets that visually matter. Each ring is a
  // continuous shader animation, so capping the count is a real GPU saving.
  const rings = useMemo(
    () =>
      [...markets]
        .filter((m) => m.visibility >= 0.14)
        .sort((a, b) => b.visibility - a.visibility)
        .slice(0, 8)
        .map((m) => ({
          lat: m.lat,
          lng: m.lng,
          maxR:
            m.visibility >= 0.22
              ? 5 + m.visibility * 22
              : 1.8 + m.visibility * 12,
          propagationSpeed: m.visibility >= 0.22 ? 2.2 : 1.4,
          repeatPeriod: m.visibility >= 0.22 ? 1500 : 2400,
          color:
            m.visibility >= 0.22
              ? "rgba(30,91,201,0.55)"
              : "rgba(96,154,240,0.30)",
        })),
    [markets],
  );

  // Animated arcs from competitor hubs into our top tracked markets.
  // Each arc is colored by the destination market's visibility band.
  const arcs = useMemo(() => {
    const top = [...markets]
      .filter((m) => m.visibility >= 0.18)
      .sort((a, b) => b.visibility - a.visibility)
      .slice(0, 5);
    const list: {
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
      color: string[];
    }[] = [];
    top.forEach((m, i) => {
      const hub = COMPETITOR_HUBS[i % COMPETITOR_HUBS.length];
      const tone =
        m.visibility >= 0.30
          ? ["rgba(30,91,201,0.0)", "rgba(30,91,201,0.95)"]
          : m.visibility >= 0.22
            ? ["rgba(58,124,232,0.0)", "rgba(58,124,232,0.85)"]
            : ["rgba(96,154,240,0.0)", "rgba(96,154,240,0.7)"];
      list.push({
        startLat: hub.lat,
        startLng: hub.lng,
        endLat: m.lat,
        endLng: m.lng,
        color: tone,
      });
    });
    return list;
  }, [markets]);

  // Big bright HTML labels for top-tier markets — readable mid-rotation
  const topMarkers = useMemo(
    () =>
      markets
        .filter((m) => m.visibility >= 0.20)
        .sort((a, b) => b.visibility - a.visibility)
        .slice(0, 8),
    [markets],
  );

  if (!ready) return <div style={{ width, height }} />;

  return (
    <Globe
      ref={ref}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      // Globe surface — clean porcelain so the country-fill heat map pops.
      // Slightly cool so it reads as cooler than the warm app background.
      globeImageUrl={null as unknown as string}
      globeMaterial={
        new THREE.MeshPhongMaterial({
          color: 0xf3eef3,
          transparent: true,
          opacity: 0.96,
          shininess: 18,
          specular: new THREE.Color(0xffffff),
          emissive: 0x1c2748,
          emissiveIntensity: 0.06,
        }) as unknown as THREE.Material
      }
      // Bright, larger atmosphere — the "halo" that reads as wow
      showAtmosphere
      atmosphereColor="#4D8FF0"
      atmosphereAltitude={0.34}
      // ===== Country polygons =====
      polygonsData={countries}
      polygonAltitude={(d: object) => {
        const iso = (d as CountryFeature).properties?.ISO_A2;
        const market = iso ? marketByIso.get(iso) : null;
        const base = market ? 0.018 + market.visibility * 0.12 : 0.008;
        return d === hoverD ? base + 0.06 : base;
      }}
      polygonCapColor={(d: object) => {
        const iso = (d as CountryFeature).properties?.ISO_A2;
        const market = iso ? marketByIso.get(iso) : null;
        if (d === hoverD) {
          return market
            ? "rgba(30, 91, 201, 0.96)"
            : "rgba(110, 130, 200, 0.55)";
        }
        return market
          ? visibilityFill(market.visibility)
          : "rgba(170, 158, 178, 0.10)";
      }}
      polygonSideColor={() => "rgba(31, 26, 40, 0.06)"}
      polygonStrokeColor={(d: object) =>
        d === hoverD ? "rgba(31, 26, 40, 0.45)" : "rgba(31, 26, 40, 0.10)"
      }
      polygonsTransitionDuration={300}
      onPolygonHover={(d: object | null) =>
        setHoverD((d as CountryFeature) ?? null)
      }
      polygonLabel={(d: object) => {
        const props = (d as CountryFeature).properties;
        const iso = props?.ISO_A2 ?? "";
        const market = iso ? marketByIso.get(iso) : null;
        const flag = flagEmoji(iso);

        const cardStyle = `
          font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
          color: #1F1A28;
          background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(252,248,251,0.92));
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          padding: 12px 14px 14px;
          border-radius: 14px;
          border: 1px solid rgba(31,26,40,0.06);
          box-shadow:
            0 1px 0 0 rgba(255,255,255,0.95) inset,
            0 0 0 1px rgba(31,26,40,0.04),
            0 18px 40px -16px rgba(31,26,40,0.24),
            0 8px 22px -10px rgba(31,26,40,0.14);
          min-width: 200px;
          letter-spacing: -0.005em;
        `;

        if (!market) {
          return `<div style="${cardStyle}">
            <div style="display:flex;align-items:center;gap:8px;">
              ${flag ? `<span style="font-size:15px;line-height:1;">${flag}</span>` : ""}
              <span style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.22em;opacity:0.5;text-transform:uppercase;font-weight:500;">${iso || "—"} · Untracked</span>
            </div>
            <div style="font-size:14px;font-weight:600;margin-top:4px;letter-spacing:-0.015em;">${props?.ADMIN ?? ""}</div>
            <div style="font-size:11.5px;color:rgba(31,26,40,0.55);margin-top:6px;">Outside active markets.</div>
          </div>`;
        }

        const pct = Math.round(market.visibility * 100);
        const pos = market.position.toFixed(1);
        const positionTag =
          market.position < 4
            ? `<span style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.18em;color:#1E5BC9;background:rgba(30,91,201,0.10);padding:2px 6px;border-radius:4px;text-transform:uppercase;font-weight:600;">Top 3</span>`
            : "";

        return `<div style="${cardStyle}">
          <div style="display:flex;align-items:center;gap:8px;">
            ${flag ? `<span style="font-size:15px;line-height:1;">${flag}</span>` : ""}
            <span style="font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:0.22em;opacity:0.55;text-transform:uppercase;font-weight:500;">${iso}</span>
            ${positionTag ? `<span style="margin-left:auto;">${positionTag}</span>` : ""}
          </div>
          <div style="font-size:14px;font-weight:600;margin-top:4px;letter-spacing:-0.015em;">${market.country_name}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:11px;padding-top:11px;border-top:1px solid rgba(31,26,40,0.06);">
            <div>
              <div style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.22em;opacity:0.5;text-transform:uppercase;font-weight:500;">Visibility</div>
              <div style="font-family:'Geist Mono',monospace;font-size:14px;color:#1E5BC9;font-weight:600;margin-top:3px;letter-spacing:-0.01em;">${pct}%</div>
            </div>
            <div>
              <div style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.22em;opacity:0.5;text-transform:uppercase;font-weight:500;">Position</div>
              <div style="font-family:'Geist Mono',monospace;font-size:14px;color:#1F1A28;font-weight:600;margin-top:3px;letter-spacing:-0.01em;">#${pos}</div>
            </div>
          </div>
          <div style="margin-top:11px;height:3px;border-radius:99px;background:rgba(31,26,40,0.06);overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#1E5BC9,#3A7CE8);border-radius:99px;"></div>
          </div>
        </div>`;
      }}
      // ===== Marker dots — taller spikes for top markets =====
      pointsData={markets}
      pointLat={(d: object) => (d as MarketStat).lat}
      pointLng={(d: object) => (d as MarketStat).lng}
      pointAltitude={(d: object) => 0.04 + (d as MarketStat).visibility * 0.6}
      pointColor={(d: object) =>
        visibilityPoint((d as MarketStat).visibility)
      }
      pointRadius={(d: object) =>
        0.35 + (d as MarketStat).visibility * 0.6
      }
      pointResolution={8}
      pointsMerge={false}
      // ===== Pulsing rings — every market =====
      ringsData={rings}
      ringLat={(d: object) => (d as { lat: number }).lat}
      ringLng={(d: object) => (d as { lng: number }).lng}
      ringMaxRadius={(d: object) => (d as { maxR: number }).maxR}
      ringPropagationSpeed={(d: object) =>
        (d as { propagationSpeed: number }).propagationSpeed
      }
      ringRepeatPeriod={(d: object) =>
        (d as { repeatPeriod: number }).repeatPeriod
      }
      ringColor={(d: object) => (d as { color: string }).color}
      // ===== Arcs — competitor hubs → tracked markets =====
      arcsData={arcs}
      arcStartLat={(d: object) => (d as { startLat: number }).startLat}
      arcStartLng={(d: object) => (d as { startLng: number }).startLng}
      arcEndLat={(d: object) => (d as { endLat: number }).endLat}
      arcEndLng={(d: object) => (d as { endLng: number }).endLng}
      arcColor={(d: object) => (d as { color: string[] }).color}
      arcDashLength={0.42}
      arcDashGap={0.18}
      arcDashAnimateTime={2400}
      arcStroke={0.55}
      arcAltitudeAutoScale={0.55}
      // ===== Top-market HTML labels (chips floating above the surface) =====
      htmlElementsData={topMarkers}
      htmlLat={(d: object) => (d as MarketStat).lat}
      htmlLng={(d: object) => (d as MarketStat).lng}
      htmlAltitude={(d: object) =>
        0.05 + (d as MarketStat).visibility * 0.62
      }
      htmlElement={(d: object) => {
        const m = d as MarketStat;
        const pct = Math.round(m.visibility * 100);
        const flag = flagEmoji(m.country_code);
        const el = document.createElement("div");
        el.style.cssText = `
          transform: translate(-50%, -100%);
          pointer-events: none;
          font-family: 'Geist Mono', ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          color: #1F1A28;
          background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,242,247,0.90));
          backdrop-filter: blur(14px) saturate(180%);
          -webkit-backdrop-filter: blur(14px) saturate(180%);
          padding: 4px 8px 4px 6px;
          border-radius: 999px;
          border: 1px solid rgba(31,26,40,0.08);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 8px 22px -10px rgba(30,91,201,0.32),
                      0 1px 0 0 rgba(255,255,255,0.95) inset;
          font-weight: 500;
        `;
        el.innerHTML = `<span style="font-size:11px;line-height:1;">${flag}</span><span style="color:#1E5BC9;font-weight:600;">${pct}%</span>`;
        return el;
      }}
    />
  );
}
