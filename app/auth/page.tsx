// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const SERIF = "'Fraunces', 'Georgia', serif";

function AuthForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const errorMessages = {
    expired: "That sign-in link has expired or already been used. Request a new one below.",
    invalid: "Invalid sign-in link. Please request a new one.",
    server: "Something went wrong. Please try again.",
  };

  const handleSend = async () => {
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Failed to send magic link. Please try again.");
    }
    setSending(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f0e0c",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 48, height: 48,
            background: "#c8b97a",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            fontFamily: SERIF, fontWeight: 700, fontSize: 18, color: "#0f0e0c",
          }}>ETF</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: "#f5f0e8" }}>
            Texas Events Trust Fund
          </div>
          <div style={{ fontSize: 12, color: "#6b6660", textTransform: "uppercase", letterSpacing: ".12em", marginTop: 4 }}>
            Analysis Tool
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "#1a1814",
          border: "1px solid #2a2720",
          borderRadius: 8,
          padding: "36px 32px",
        }}>
          {sent ? (
            /* Success state */
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: "#f5f0e8", marginBottom: 12 }}>
                Check your inbox
              </div>
              <p style={{ fontSize: 14, color: "#9e9890", lineHeight: 1.7, margin: "0 0 20px" }}>
                We sent a sign-in link to <strong style={{ color: "#f5f0e8" }}>{email}</strong>.
                Click the link in the email to continue — it expires in 15 minutes.
              </p>
              <p style={{ fontSize: 12.5, color: "#6b6660", lineHeight: 1.6, margin: 0 }}>
                Don't see it? Check your spam folder or{" "}
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  style={{ background: "none", border: "none", color: "#c8b97a", cursor: "pointer", fontSize: 12.5, padding: 0, textDecoration: "underline" }}
                >
                  try a different email
                </button>
              </p>
            </div>
          ) : (
            /* Email entry state */
            <>
              <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: "#f5f0e8", marginBottom: 8 }}>
                Sign in
              </div>
              <p style={{ fontSize: 13.5, color: "#9e9890", lineHeight: 1.6, margin: "0 0 24px" }}>
                Enter your work email and we'll send you a sign-in link. No password needed.
              </p>

              {(errorParam || error) && (
                <div style={{
                  padding: "10px 14px",
                  background: "#7f1d1d22",
                  border: "1px solid #7f1d1d",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#fca5a5",
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}>
                  {errorMessages[errorParam] || error}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  color: "#6b6660",
                  display: "block",
                  marginBottom: 6,
                }}>
                  Work Email
                </label>
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="you@yourorg.com"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "#0f0e0c",
                    border: "1px solid #2a2720",
                    borderRadius: 4,
                    color: "#f5f0e8",
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !email}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: email ? "#c8b97a" : "#2a2720",
                  color: email ? "#0f0e0c" : "#6b6660",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: email ? "pointer" : "default",
                  transition: "all .15s",
                  fontFamily: "inherit",
                }}
              >
                {sending ? "Sending…" : "Send Sign-In Link →"}
              </button>

              <p style={{ margin: "20px 0 0", fontSize: 12, color: "#4a4740", lineHeight: 1.6, textAlign: "center" }}>
                First time? You'll be guided through org setup after signing in.
              </p>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 11.5, color: "#4a4740", marginTop: 20, lineHeight: 1.6 }}>
          This tool is not affiliated with the Texas Office of the Governor or EDT.
          For planning purposes only.
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0f0e0c" }} />}>
      <AuthForm />
    </Suspense>
  );
}