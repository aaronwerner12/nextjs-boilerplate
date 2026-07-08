// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { calculateTrustFund, ATTENDEE_CATS } from "../../ETFPlaybook";

const SERIF = "'Fraunces', Georgia, serif";

const fmtMoney = (n) => (n == null || isNaN(n) ? "$0" : "$" + Math.round(n).toLocaleString());
const fmtNum = (n) => (n == null || isNaN(n) ? "0" : Math.round(n).toLocaleString());
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return isNaN(dt) ? "—" : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function SharePage() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | notfound

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/share?token=${encodeURIComponent(params.token)}`, { cache: "no-store" });
        if (!res.ok) { setState("notfound"); return; }
        setData(await res.json());
        setState("ready");
      } catch (_) {
        setState("notfound");
      }
    })();
  }, [params.token]);

  if (state === "loading") {
    return <div style={{ minHeight: "100vh", background: "#F7F5EF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, color: "#6C7065", fontStyle: "italic", fontSize: 18 }}>Loading…</div>;
  }
  if (state === "notfound") {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F5EF", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: "#1E4536", marginBottom: 8 }}>Link not found</div>
          <div style={{ fontSize: 14, color: "#6C7065" }}>This share link is invalid or has been removed.</div>
        </div>
      </div>
    );
  }

  const { event, orgName, orgCity, orgState } = data;
  const calc = calculateTrustFund(event);
  const est = calc.totalFund > 0 ? calc.totalFund : calc.quickEstimate;
  const venues = Array.isArray(event.venues) && event.venues.length ? event.venues.join("; ") : (event.venue || "—");
  const days = event.calc?.days || [];

  const stat = (label, value) => (
    <div style={{ background: "#fff", border: "1px solid #DFDDD0", borderRadius: 14, padding: "18px 22px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: "#B04E31" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6C7065", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5EF", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E4536" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".15em", color: "#B04E31", fontWeight: 600, marginBottom: 10 }}>
          {orgName || "ETF Analysis"}{orgCity ? ` · ${orgCity}, ${orgState || "TX"}` : ""} · Read-only summary
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 500, letterSpacing: "-.02em", margin: "0 0 6px" }}>
          {event.name || "Untitled Event"}
        </h1>
        <div style={{ fontSize: 15, color: "#6C7065", marginBottom: 28 }}>
          {event.firstDay ? `${fmtDate(event.firstDay)} – ${fmtDate(event.lastDay || event.firstDay)}` : "Dates TBD"}
          {event.siteSelectionOrg ? ` · Site selection: ${event.siteSelectionOrg}` : ""}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
          {stat("Projected ETF Value", fmtMoney(est))}
          {stat("Projected State Share", fmtMoney(calc.stateTaxTotal || 0))}
          {stat("Required Local Match", fmtMoney(calc.requiredLocalMatch || 0))}
          {stat("Est. Room Nights", fmtNum(calc.totalRoomNights || event.roomNights || 0))}
        </div>

        <div style={{ background: "#fff", border: "1px solid #DFDDD0", borderRadius: 14, padding: "22px 26px", marginBottom: 20 }}>
          <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Event Details</div>
          <div style={{ fontSize: 13.5, lineHeight: 2 }}>
            <div><span style={{ color: "#6C7065" }}>Venue(s):</span> {venues}</div>
            <div><span style={{ color: "#6C7065" }}>Total estimated attendance:</span> {fmtNum(calc.totalAttendance || event.attendeeEst || 0)}</div>
            {days.length > 0 && <div><span style={{ color: "#6C7065" }}>Event days modeled:</span> {days.length}</div>}
          </div>
        </div>

        {days.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #DFDDD0", borderRadius: 14, padding: "22px 26px", marginBottom: 20, overflowX: "auto" }}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Estimated Daily Attendance</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid #DFDDD0", color: "#6C7065", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em" }}>Date</th>
                  {ATTENDEE_CATS.map((c) => (
                    <th key={c.key} style={{ textAlign: "right", padding: "6px 10px", borderBottom: "2px solid #DFDDD0", color: "#6C7065", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em" }}>{c.label.split("/")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #F7F5EF" }}>{day.date ? fmtDate(day.date) : `Day ${i + 1}`}</td>
                    {ATTENDEE_CATS.map((c) => (
                      <td key={c.key} style={{ textAlign: "right", padding: "6px 10px", borderBottom: "1px solid #F7F5EF" }}>{fmtNum(Number(day[c.key]) || 0)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ fontSize: 11, color: "#979A8D", textAlign: "center", lineHeight: 1.7, marginTop: 32 }}>
          Shared from Event Fund Playbook. Figures are internal planning estimates only.<br />
          Not affiliated with the Texas Office of the Governor or EDT.
        </div>
      </div>
    </div>
  );
}
