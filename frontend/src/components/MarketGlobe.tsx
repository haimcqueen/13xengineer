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

/** Visibility → cool gradient: pale lavender → cobalt → bright blue. */
function visibilityFill(v: number): string {
  if (v >= 0.30) return "rgba(30, 91, 201, 0.55)";
  if (v >= 0.22) return "rgba(58, 124, 232, 0.45)";
  if (v >= 0.16) return "rgba(110, 130, 200, 0.35)";
  if (v >= 0.10) return "rgba(110, 101, 122, 0.25)";
  return "rgba(174, 156, 168, 0.18)";
}

function visibilityPoint(v: number): string {
  if (v >= 0.30) return "rgba(30, 91, 201, 0.95)";
  if (v >= 0.22) return "rgba(58, 124, 232, 0.92)";
  if (v >= 0.16) return "rgba(110, 130, 200, 0.85)";
  if (v >= 0.10) return "rgba(110, 101, 122, 0.75)";
  return "rgba(174, 156, 168, 0.6)";
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
        // eslint-disable-next-line no-console
        console.log("[MarketGlobe] loaded", features.length, "country features");
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
    controls.autoRotateSpeed = 0.32;
    controls.enableZoom = false;
    controls.enablePan = false;
    ref.current.pointOfView({ lat: 50, lng: 8, altitude: 2.4 }, 0);
  }, [ready]);

  const marketByIso = useMemo(() => {
    const m = new Map<string, MarketStat>();
    for (const x of markets) m.set(x.country_code, x);
    return m;
  }, [markets]);

  const rings = useMemo(
    () =>
      markets
        .filter((m) => m.visibility >= 0.22)
        .map((m) => ({
          lat: m.lat,
          lng: m.lng,
          maxR: 3 + m.visibility * 10,
          propagationSpeed: 1.8,
          repeatPeriod: 1800,
        })),
    [markets],
  );

  const arcs = useMemo(
    () => [
      {
        startLat: 40.7,
        startLng: -74.0, // NYC
        endLat: 48.1,
        endLng: 11.6, // Munich
        color: ["rgba(110, 101, 122, 0.0)", "rgba(30, 91, 201, 0.55)"],
      },
      {
        startLat: 37.77,
        startLng: -122.42, // SF
        endLat: 59.33,
        endLng: 18.07, // Stockholm
        color: ["rgba(110, 101, 122, 0.0)", "rgba(30, 91, 201, 0.55)"],
      },
      {
        startLat: 51.51,
        startLng: -0.13, // London
        endLat: 52.52,
        endLng: 13.4, // Berlin
        color: ["rgba(110, 101, 122, 0.0)", "rgba(58, 124, 232, 0.45)"],
      },
    ],
    [],
  );

  if (!ready) return <div style={{ width, height }} />;

  return (
    <Globe
      ref={ref}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      // Solid color globe surface — soft warm rose so polygons stand out
      globeImageUrl={null as unknown as string}
      globeMaterial={
        new THREE.MeshPhongMaterial({
          color: 0xede2e7, // soft warm rose-tinted off-white
          transparent: true,
          opacity: 0.95,
          shininess: 6,
          emissive: 0x1f1a28,
          emissiveIntensity: 0.04,
        }) as unknown as THREE.Material
      }
      showAtmosphere
      atmosphereColor="#3A7CE8"
      atmosphereAltitude={0.16}
      // ===== Country polygons (solid fills, with hover lift) =====
      polygonsData={countries}
      polygonAltitude={(d: object) => {
        const iso = (d as CountryFeature).properties?.ISO_A2;
        const market = iso ? marketByIso.get(iso) : null;
        const base = market ? 0.012 + market.visibility * 0.05 : 0.008;
        return d === hoverD ? base + 0.045 : base;
      }}
      polygonCapColor={(d: object) => {
        const iso = (d as CountryFeature).properties?.ISO_A2;
        const market = iso ? marketByIso.get(iso) : null;
        if (d === hoverD) {
          return market
            ? "rgba(30, 91, 201, 0.78)"
            : "rgba(110, 130, 200, 0.42)";
        }
        return market
          ? visibilityFill(market.visibility)
          : "rgba(110, 101, 122, 0.10)";
      }}
      polygonSideColor={() => "rgba(31, 26, 40, 0.05)"}
      polygonStrokeColor={(d: object) =>
        d === hoverD ? "rgba(31, 26, 40, 0.4)" : "rgba(31, 26, 40, 0.10)"
      }
      polygonsTransitionDuration={250}
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
      // ===== Marker dots on top of countries =====
      pointsData={markets}
      pointLat={(d: object) => (d as MarketStat).lat}
      pointLng={(d: object) => (d as MarketStat).lng}
      pointAltitude={(d: object) =>
        0.06 + (d as MarketStat).visibility * 0.45
      }
      pointColor={(d: object) =>
        visibilityPoint((d as MarketStat).visibility)
      }
      pointRadius={0.45}
      pointResolution={6}
      pointsMerge={false}
      // ===== Rings + arcs =====
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
      ringColor={() => "rgba(30,91,201,0.45)"}
      arcsData={arcs}
      arcStartLat={(d: object) => (d as { startLat: number }).startLat}
      arcStartLng={(d: object) => (d as { startLng: number }).startLng}
      arcEndLat={(d: object) => (d as { endLat: number }).endLat}
      arcEndLng={(d: object) => (d as { endLng: number }).endLng}
      arcColor={(d: object) => (d as { color: string[] }).color}
      arcDashLength={0.35}
      arcDashGap={0.1}
      arcDashAnimateTime={2400}
      arcStroke={0.45}
      arcAltitudeAutoScale={0.45}
      labelsData={markets.filter((m) => m.visibility >= 0.20)}
      labelLat={(d: object) => (d as MarketStat).lat}
      labelLng={(d: object) => (d as MarketStat).lng}
      labelText={(d: object) => (d as MarketStat).country_code}
      labelSize={0.38}
      labelDotRadius={0.16}
      labelColor={() => "rgba(31, 26, 40, 0.78)"}
      labelResolution={2}
      labelAltitude={(d: object) =>
        0.06 + (d as MarketStat).visibility * 0.45
      }
    />
  );
}
