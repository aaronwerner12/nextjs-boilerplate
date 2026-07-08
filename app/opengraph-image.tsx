import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Event Fund Playbook — Texas event funding, simplified";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#132E22",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              background: "#E0784E",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            EFP
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#F7F5EF", fontSize: "34px", fontWeight: 600 }}>Event Fund Playbook</div>
            <div style={{ color: "#9FB8A9", fontSize: "18px", letterSpacing: "2px", textTransform: "uppercase" }}>
              Texas Events Trust Fund
            </div>
          </div>
        </div>

        <div
          style={{
            color: "#F7F5EF",
            fontSize: "58px",
            fontWeight: 600,
            lineHeight: 1.15,
            maxWidth: "980px",
            display: "flex",
          }}
        >
          Turn events into state funding — eligibility to application in one tool.
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "48px",
          }}
        >
          {["Eligibility Checks", "Impact Projections", "Deadline Tracking", "Application Packets"].map((label) => (
            <div
              key={label}
              style={{
                padding: "12px 24px",
                background: "rgba(224,120,78,0.15)",
                border: "1px solid rgba(224,120,78,0.5)",
                borderRadius: "24px",
                color: "#E0784E",
                fontSize: "20px",
                fontWeight: 600,
                display: "flex",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div style={{ color: "#6C7065", fontSize: "18px", marginTop: "56px", display: "flex" }}>
          Built for destination marketing organizations · Not affiliated with the Office of the Governor
        </div>
      </div>
    ),
    { ...size }
  );
}
