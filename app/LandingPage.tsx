// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div style={{ background: "#0a0906", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#f5f0e8", overflowX: "hidden" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&family=Inter:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .land-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 20px 48px;
          display: flex; align-items: center; justify-content: space-between;
          transition: all .3s ease;
        }
        .land-nav.scrolled {
          background: rgba(10,9,6,.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(200,185,122,.1);
          padding: 14px 48px;
        }

        .land-hero {
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
          padding: 120px 24px 48px;
          position: relative;
        }

        .land-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(200,185,122,.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .land-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 600;
          letter-spacing: .16em;
          color: #c8b97a;
          background: rgba(200,185,122,.1);
          border: 1px solid rgba(200,185,122,.2);
          border-radius: 20px; padding: 6px 14px;
          margin-bottom: 28px;
        }

        .land-h1 {
          font-family: 'Fraunces', Georgia, serif;
          font-size: clamp(40px, 7vw, 80px);
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: -.02em;
          margin-bottom: 24px;
          max-width: 820px;
        }

        .land-h1 em {
          font-style: italic;
          color: #c8b97a;
        }

        .land-lede {
          font-size: clamp(16px, 2vw, 19px);
          color: #9e9890;
          line-height: 1.7;
          max-width: 560px;
          margin: 0 auto 44px;
        }

        .land-cta-row {
          display: flex; gap: 14px; align-items: center; justify-content: center;
          flex-wrap: wrap;
        }

        .land-btn-primary {
          padding: 14px 32px;
          background: #c8b97a;
          color: #0a0906;
          border: none; border-radius: 4px;
          font-size: 15px; font-weight: 700;
          cursor: pointer; text-decoration: none;
          display: inline-block;
          transition: opacity .15s;
          font-family: inherit;
        }
        .land-btn-primary:hover { opacity: .88; }

        .land-btn-secondary {
          padding: 14px 28px;
          background: transparent;
          color: #9e9890;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 4px;
          font-size: 15px; font-weight: 500;
          cursor: pointer; text-decoration: none;
          display: inline-block;
          transition: all .15s;
          font-family: inherit;
        }
        .land-btn-secondary:hover { border-color: rgba(200,185,122,.4); color: #c8b97a; }

        /* Stats bar */
        .land-stats {
          display: flex; gap: 0;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 8px;
          overflow: hidden;
          margin: 72px auto 0;
          max-width: 680px;
          background: rgba(255,255,255,.02);
        }
        .land-stat {
          flex: 1; padding: 24px 20px; text-align: center;
          border-right: 1px solid rgba(255,255,255,.06);
        }
        .land-stat:last-child { border-right: none; }
        .land-stat-val {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 32px; font-weight: 600;
          color: #c8b97a; line-height: 1;
          margin-bottom: 6px;
        }
        .land-stat-label {
          font-size: 12px; color: #6b6660;
          text-transform: uppercase; letter-spacing: .1em;
        }

        /* How it works */
        .land-section {
          max-width: 1080px; margin: 0 auto;
          padding: 64px 24px;
        }

        .land-section-eyebrow {
          font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .16em;
          color: #c8b97a; margin-bottom: 16px;
        }

        .land-section-title {
          font-family: 'Fraunces', Georgia, serif;
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 600; line-height: 1.2;
          margin-bottom: 16px;
        }

        .land-section-sub {
          font-size: 17px; color: #9e9890; line-height: 1.7;
          max-width: 520px; margin-bottom: 64px;
        }

        .land-steps {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 2px;
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 8px;
          overflow: hidden;
        }

        .land-step {
          padding: 36px 32px;
          background: rgba(255,255,255,.02);
          border-top: 2px solid #c8b97a;
          transition: background .2s;
        }
        .land-step:hover { background: rgba(200,185,122,.04); }

        .land-step-num {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 13px; font-weight: 400;
          color: #c8b97a; margin-bottom: 16px;
          font-style: italic;
        }

        .land-step-title {
          font-size: 17px; font-weight: 600;
          color: #f5f0e8; margin-bottom: 10px;
          line-height: 1.3;
        }

        .land-step-body {
          font-size: 14px; color: #6b6660; line-height: 1.7;
        }

        /* Features */
        .land-features {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
          margin-top: 64px;
        }

        .land-feature {
          padding: 28px 28px;
          background: rgba(255,255,255,.02);
          border: 1px solid rgba(255,255,255,.06);
          border-top: 2px solid #c8b97a;
          border-radius: 6px;
          transition: border-color .2s;
        }
        .land-feature:hover { border-color: rgba(200,185,122,.4); border-top-color: #c8b97a; }

        .land-feature-icon {
          width: 36px; height: 36px;
          background: rgba(200,185,122,.1);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; margin-bottom: 16px;
        }

        .land-feature-title {
          font-size: 15px; font-weight: 600;
          color: #f5f0e8; margin-bottom: 8px;
        }

        .land-feature-body {
          font-size: 13.5px; color: #6b6660; line-height: 1.6;
        }

        /* Divider */
        .land-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(200,185,122,.15), transparent);
          margin: 0 24px;
        }

        /* CTA section */
        .land-cta-section {
          text-align: center;
          padding: 100px 24px;
          position: relative;
        }
        .land-cta-section::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 60% 80% at 50% 50%, rgba(200,185,122,.05) 0%, transparent 70%);
          pointer-events: none;
        }

        /* Footer */
        .land-footer {
          border-top: 1px solid rgba(255,255,255,.06);
          padding: 32px 48px;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 16px;
        }

        @media (max-width: 640px) {
          .land-nav { padding: 16px 20px; }
          .land-nav.scrolled { padding: 12px 20px; }
          .land-stats { flex-direction: column; }
          .land-stat { border-right: none; border-bottom: 1px solid rgba(255,255,255,.06); }
          .land-stat:last-child { border-bottom: none; }
          .land-footer { padding: 24px 20px; flex-direction: column; text-align: center; }
        }
      `}</style>

      {/* Nav */}
      <nav className={`land-nav${scrolled ? " scrolled" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#c8b97a", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 13, color: "#0a0906" }}>ETF</div>
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 600, color: "#f5f0e8" }}>TX ETF Analysis Tool</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/?signin=1" className="land-btn-secondary" style={{ padding: "9px 20px", fontSize: 13.5 }}>Sign In</a>
          <a href="/?signin=1" className="land-btn-primary" style={{ padding: "9px 20px", fontSize: 13.5 }}>Get Started →</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="land-hero">
        <div className="land-eyebrow">
          <span>●</span> Built for Texas DMOs
        </div>
        <h1 className="land-h1">
          The ETF process, <em>simplified.</em>
        </h1>
        <p className="land-lede">
          The Texas Events Trust Fund Analysis Tool helps CVBs and DMOs evaluate events, calculate economic impact, manage deadlines, and prepare applications — all in one place.
        </p>
        <div className="land-cta-row">
          <a href="/?signin=1" className="land-btn-primary">Create Your Organization →</a>
          <a href="#how-it-works" className="land-btn-secondary">See How It Works</a>
        </div>

      </section>

      <div className="land-divider" />

      {/* How it works */}
      <section className="land-section" id="how-it-works">
        <div className="land-section-eyebrow">How It Works</div>
        <h2 className="land-section-title">Analyze, prepare, and track<br />your ETF submission.</h2>
        <p className="land-section-sub">
          The ETF process has strict eligibility requirements and multiple deadlines. This tool walks you through every step so nothing gets missed.
        </p>

        <div className="land-steps">
          {[
            { num: "01", title: "Evaluate eligibility", body: "Run any prospective event through the 5 statutory eligibility gates from Texas Government Code § 480.0051 before investing time in an analysis." },
            { num: "02", title: "Model economic impact", body: "Build a day-by-day attendance model by category. The calculator projects state and local tax generation and your required local match amount." },
            { num: "03", title: "Track every deadline", body: "Auto-generated timelines from your event dates. Application (−120 days), attendance certification (+45), local share (+90), disbursement (+180)." },
            { num: "04", title: "Apply with confidence", body: "Pre-filled email to EDT, direct links to every official form, and a pre-submission checklist so your application packet is complete the first time." },
          ].map((s) => (
            <div key={s.num} className="land-step">
              <div className="land-step-num">{s.num}</div>
              <div className="land-step-title">{s.title}</div>
              <div className="land-step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="land-divider" />

      {/* Features */}
      <section className="land-section">
        <div className="land-section-eyebrow">Features</div>
        <h2 className="land-section-title">Stop tracking ETF<br />in <em>spreadsheets.</em></h2>

        <div className="land-features">
          {[
            { icon: "⚡", title: "Shared team pipeline", body: "Your whole team sees the same events in real time. Add members, assign roles, and manage access — no more siloed spreadsheets." },
            { icon: "📋", title: "Organizer intake form", body: "Share a link or QR code with event organizers. They fill out a structured form and their submission lands directly in your pipeline." },
            { icon: "📅", title: "Auto-generated timelines", body: "Enter your event dates and every critical ETF deadline is calculated automatically with traffic-light status indicators." },
            { icon: "🧮", title: "Economic impact calculator", body: "Model attendance by category (athletes, coaches, family, spectators) to project state and local tax contributions per day." },
            { icon: "✓", title: "Document checklist", body: "A complete pre-submission checklist covering every required document — application, affidavits, attendance chart, ESC, and ACH form." },
            { icon: "📖", title: "Built-in reference library", body: "Allowable and unallowable costs, EDT contact info, official guidelines, and state statute — all accessible without leaving the tool." },
          ].map((f) => (
            <div key={f.title} className="land-feature">
              <div className="land-feature-icon">{f.icon}</div>
              <div className="land-feature-title">{f.title}</div>
              <div className="land-feature-body">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="land-divider" />

      {/* CTA */}
      <section className="land-cta-section">
        <div className="land-section-eyebrow" style={{ justifyContent: "center", display: "flex", marginBottom: 20 }}>Get Started Today</div>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 600, lineHeight: 1.15, marginBottom: 20, letterSpacing: "-.02em" }}>
          Your next ETF award<br />starts <em style={{ fontStyle: "italic", color: "#c8b97a" }}>here.</em>
        </h2>
        <p style={{ fontSize: 17, color: "#9e9890", lineHeight: 1.7, maxWidth: 480, margin: "0 auto 40px" }}>
          Create your organization, add your team, and start analyzing events in minutes. No setup fee, no contract.
        </p>
        <div className="land-cta-row">
          <a href="/?signin=1" className="land-btn-primary" style={{ fontSize: 16, padding: "16px 36px" }}>Create Your Organization →</a>
        </div>
        <p style={{ marginTop: 20, fontSize: 12.5, color: "#4a4740" }}>
          Not affiliated with the Texas Office of the Governor or its Economic Development and Tourism division. This is an independently operated tool and is not affiliated with any DMO, CVB, or municipality.
        </p>
      </section>

      {/* Footer */}
      <footer className="land-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, background: "#c8b97a", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 10, color: "#0a0906" }}>ETF</div>
          <span style={{ fontSize: 13, color: "#4a4740" }}>Texas Events Trust Fund Analysis Tool</span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <a href="/terms" style={{ fontSize: 12.5, color: "#4a4740", textDecoration: "none" }}>Terms</a>
          <a href="/privacy" style={{ fontSize: 12.5, color: "#4a4740", textDecoration: "none" }}>Privacy</a>
          <a href="/?signin=1" style={{ fontSize: 12.5, color: "#6b6660", textDecoration: "none" }}>Sign In →</a>
        </div>
      </footer>

    </div>
  );
}
