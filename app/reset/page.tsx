// @ts-nocheck
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const SERIF = "'Fraunces', Georgia, serif";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState(""); // "" | saving | done
  const [orgName, setOrgName] = useState("");

  const submit = async () => {
    setError("");
    if (passcode.length < 8) { setError("Access code must be at least 8 characters."); return; }
    if (passcode !== confirm) { setError("The two codes don't match."); return; }
    setStatus("saving");
    try {
      const res = await fetch("/api/orgs/recover", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPasscode: passcode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try requesting a new link.");
        setStatus("");
        return;
      }
      setOrgName(data.orgName || "");
      setStatus("done");
    } catch (_) {
      setError("Connection problem — try again.");
      setStatus("");
    }
  };

  const s = {
    input: { width: "100%", padding: "12px 14px", background: "#132E22", border: "1px solid #2E5644", borderRadius: 10, color: "#F7F5EF", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
    label: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "#6C7065", display: "block", marginBottom: 6 },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#132E22", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, background: "#E0784E", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontFamily: SERIF, fontWeight: 700, fontSize: 18, color: "#fff" }}>EFP</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: "#F7F5EF" }}>Reset Access Code</div>
        </div>

        <div style={{ background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 14, padding: "32px 28px" }}>
          {status === "done" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: "#F7F5EF", marginBottom: 8 }}>
                Access code updated{orgName ? ` for ${orgName}` : ""}
              </div>
              <p style={{ fontSize: 13, color: "#9FB8A9", lineHeight: 1.6, marginBottom: 24 }}>
                Share the new code with your team — everyone signs in with it from now on.
              </p>
              <a
                href="/?signin=1"
                style={{ display: "inline-block", padding: "12px 28px", background: "#E0784E", color: "#fff", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 700 }}
              >
                Sign in →
              </a>
            </div>
          ) : !token ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: "#F7F5EF", marginBottom: 8 }}>Missing reset link</div>
              <p style={{ fontSize: 13, color: "#9FB8A9", lineHeight: 1.6 }}>
                Open this page from the link in your reset email. If it's been more than 30 minutes, request a new one from the sign-in screen.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#9FB8A9", lineHeight: 1.6, margin: "0 0 20px" }}>
                Choose a new access code for your whole team. Minimum 8 characters.
              </p>

              {error && <div style={{ padding: "10px 14px", background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 10, fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>New Access Code</label>
                <input type="password" autoFocus value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Min. 8 characters" style={s.input} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Confirm New Code</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Type it again" style={s.input} />
              </div>

              <button
                onClick={submit}
                disabled={status === "saving" || !passcode || !confirm}
                style={{ width: "100%", padding: "13px", background: passcode && confirm ? "#E0784E" : "#2E5644", color: passcode && confirm ? "#fff" : "#6C7065", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: passcode && confirm ? "pointer" : "default", fontFamily: "inherit" }}
              >
                {status === "saving" ? "Saving…" : "Set New Code"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#132E22" }} />}>
      <ResetForm />
    </Suspense>
  );
}
