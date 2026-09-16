import { ImageResponse } from "next/og";
import { SITE_CONFIG } from "@/lib/constants";

export const runtime = "nodejs";
export const alt = `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px 80px",
          position: "relative",
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "300px",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(59, 130, 246, 0) 70%)",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* Brand Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "30px",
          }}
        >
          {/* Logo Badge */}
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.5)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                transform: "rotate(45deg)",
                background: "white",
                borderRadius: "4px",
                display: "flex",
              }}
            />
          </div>

          <span
            style={{
              fontSize: "64px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#ffffff",
            }}
          >
            File<span style={{ color: "#3B82F6" }}>Forge</span>
          </span>
        </div>

        {/* Tagline */}
        <h1
          style={{
            fontSize: "44px",
            fontWeight: 800,
            color: "#F8FAFC",
            textAlign: "center",
            margin: "0 0 20px 0",
            letterSpacing: "-0.02em",
            maxWidth: "960px",
            lineHeight: 1.2,
          }}
        >
          Fast, Private & In-Browser File Tools
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: "24px",
            color: "#94A3B8",
            textAlign: "center",
            margin: "0 0 40px 0",
            maxWidth: "850px",
            lineHeight: 1.4,
          }}
        >
          26 free developer, PDF, and image conversion tools running entirely on your device with zero server uploads.
        </p>

        {/* Badges row */}
        <div
          style={{
            display: "flex",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "9999px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#34D399",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            <span>100% In-Browser Privacy</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "9999px",
              background: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#60A5FA",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            <span>Instant Local Processing</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "9999px",
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#FBBF24",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            <span>Free & Open Access</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
