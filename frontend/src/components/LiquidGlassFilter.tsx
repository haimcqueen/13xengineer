/**
 * Inline SVG filter for iOS-26 style liquid glass refraction.
 *
 * Uses feTurbulence + feDisplacementMap to bend the backdrop,
 * plus feSpecularLighting for the rim highlight. Mounted once at the
 * app root; .glass surfaces reference it via filter: url(#liquid-glass-distortion).
 *
 * Note: Chrome / Chromium are the only browsers that support SVG filters
 * inside `backdrop-filter`. Safari/Firefox fall back to plain blur.
 */
export default function LiquidGlassFilter() {
  return (
    <svg
      aria-hidden
      focusable="false"
      className="pointer-events-none fixed -z-10"
      style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter
          id="liquid-glass-distortion"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          {/* Generate turbulent noise — the "lens" surface */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.008"
            numOctaves="2"
            seed="14"
            result="turbulence"
          />
          {/* Bias the noise to red+blue channels (used for x/y displacement) */}
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          {/* Soften the displacement so edges are smooth */}
          <feGaussianBlur in="turbulence" stdDeviation="2" result="softMap" />
          {/* Simulate light hitting the glass surface */}
          <feSpecularLighting
            in="softMap"
            surfaceScale="4"
            specularConstant="0.8"
            specularExponent="80"
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x="-200" y="-200" z="280" />
          </feSpecularLighting>
          <feComposite
            in="specLight"
            in2="SourceGraphic"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="litImage"
          />
          {/* Bend the source by the displacement map */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="80"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Lighter variant for the sidebar — less distortion, more frost */}
        <filter
          id="liquid-glass-distortion-soft"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.012"
            numOctaves="1"
            seed="9"
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="40"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
