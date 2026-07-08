// @ts-nocheck
"use client";

import { useState, useEffect } from "react";

const SERIF = "'Fraunces', 'Georgia', serif";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(d) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function AdminPage() {
  const [pwd, setPwd] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("joinedAt");
  const [view, setView] = useState("orgs"); // orgs | feedback | health

  const fetchData = async (password: string) => {
    const res = await fetch("/api/admin", {
      headers: { "x-admin-pwd": password },
    });
    if (res.status === 401) throw new Error("unauthorized");
    if (res.status === 503) throw new Error("notconfigured");
    if (!res.ok) throw new Error("server");
    return res.json();
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const json = await fetchData(pwd);
      setData(json);
      setFetchedAt(new Date());
      setAuthed(true);
    } catch (e) {
      if (e.message === "unauthorized") setError("Incorrect password.");
      else if (e.message === "notconfigured") setError("ADMIN_PASSWORD env var is not set on the server.");
      else setError("Failed to load. Check your connection.");
    }
    setLoading(false);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const json = await fetchData(pwd);
      setData(json);
      setFetchedAt(new Date());
    } catch (_) {}
    setLoading(false);
  };

  const [running, setRunning] = useState("");

  // Trigger a scheduled email job immediately (sends real emails)
  const runCron = async (job) => {
    const label = job === "reminders" ? "weekly deadline digest" : "monthly pipeline check-in";
    if (!window.confirm(`Send the ${label} to all real recipients right now?\n\nThis sends actual emails — use the Preview buttons if you just want to see the design.`)) return;
    setRunning(job);
    try {
      const res = await fetch(`/api/cron/${job}`, { headers: { "x-admin-pwd": pwd } });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const sent = (json.results || []).filter((r) => r.sent).length;
        alert(`Done — ${sent} email${sent === 1 ? "" : "s"} sent.`);
        await refresh();
      } else {
        alert(json.error || "Run failed.");
      }
    } catch (_) {
      alert("Run failed — check your connection.");
    }
    setRunning("");
  };

  // Render the exact email HTML the cron jobs send, in a new tab
  const previewEmail = async (type) => {
    try {
      const res = await fetch(`/api/email-preview?type=${type}`, {
        headers: { "x-admin-pwd": pwd },
      });
      if (!res.ok) return;
      const html = await res.text();
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } catch (_) {}
  };

  const filteredOrgs = (data?.orgs || [])
    .filter(o => !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.city?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "joinedAt") return new Date(b.joinedAt) - new Date(a.joinedAt);
      if (sortBy === "events") return b.totalEvents - a.totalEvents;
      if (sortBy === "members") return b.memberCount - a.memberCount;
      if (sortBy === "lastActive") return new Date(b.lastActive || 0) - new Date(a.lastActive || 0);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  // Sum from per-org data so headline numbers always match the table
  const totalEvents = (data?.orgs || []).reduce((sum, o) => sum + (o.totalEvents || 0), 0);
  const avgEventsPerOrg = data?.summary?.totalOrgs > 0
    ? (totalEvents / data.summary.totalOrgs).toFixed(1).replace(/\.0$/, "")
    : 0;

  const styles = {
    page: { minHeight: "100vh", background: "#132E22", color: "#F7F5EF", fontFamily: "'Inter', system-ui, sans-serif" },
    header: { background: "#1A3F2F", borderBottom: "1px solid #2E5644", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    logo: { fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: "#E0784E" },
    badge: { fontSize: 11, background: "#E0784E22", color: "#E0784E", border: "1px solid #E0784E33", borderRadius: 10, padding: "3px 8px", textTransform: "uppercase", letterSpacing: ".1em" },
    body: { maxWidth: 1100, margin: "0 auto", padding: "32px 24px" },
    statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 32 },
    statCard: { background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 12, padding: "20px 24px" },
    statValue: { fontFamily: SERIF, fontSize: 36, fontWeight: 600, color: "#E0784E", lineHeight: 1 },
    statLabel: { fontSize: 12, color: "#6C7065", textTransform: "uppercase", letterSpacing: ".1em", marginTop: 6 },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: { textAlign: "left" as const, padding: "10px 14px", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".1em", color: "#6C7065", borderBottom: "1px solid #2E5644", cursor: "pointer" },
    td: { padding: "14px", borderBottom: "1px solid #1A3F2F", fontSize: 13.5, color: "#c8c0b0", verticalAlign: "top" as const },
    pill: (color) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + "22", color }),
  };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#132E22", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: "#F7F5EF" }}>ETF Tool</div>
            <div style={{ fontSize: 12, color: "#6C7065", textTransform: "uppercase", letterSpacing: ".12em", marginTop: 4 }}>Admin Dashboard</div>
          </div>
          <div style={{ background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 14, padding: "32px 28px" }}>
            <div style={{ fontSize: 13, color: "#6C7065", marginBottom: 20 }}>Enter your admin password to view usage stats.</div>
            {error && <div style={{ padding: "10px 14px", background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 10, fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}
            <input
              autoFocus
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Admin password"
              style={{ width: "100%", padding: "12px 14px", background: "#132E22", border: "1px solid #2E5644", borderRadius: 10, color: "#F7F5EF", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 14 }}
            />
            <button
              onClick={handleLogin}
              disabled={loading || !pwd}
              style={{ width: "100%", padding: "12px", background: "#E0784E", color: "#132E22", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Loading…" : "View Dashboard →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={styles.logo}>ETF Analysis Tool</div>
          <div style={styles.badge}>Admin</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: "#6C7065" }}>
            {loading ? "Refreshing…" : fetchedAt ? `Last updated ${fmtTime(fetchedAt)}` : ""}
          </div>
          <button onClick={() => previewEmail("digest")} style={{ padding: "6px 14px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, color: "#E0784E", fontSize: 12, cursor: "pointer" }}>
            ✉ Weekly digest
          </button>
          <button onClick={() => previewEmail("pulse")} style={{ padding: "6px 14px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, color: "#E0784E", fontSize: 12, cursor: "pointer" }}>
            ✉ Monthly check-in
          </button>
          <button onClick={refresh} style={{ padding: "6px 14px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, color: "#9FB8A9", fontSize: 12, cursor: "pointer" }}>
            Refresh
          </button>
        </div>
      </header>

      <div style={styles.body}>

        {/* Summary stats */}
        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{data?.summary?.totalOrgs || 0}</div>
            <div style={styles.statLabel}>Organizations</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{totalEvents}</div>
            <div style={styles.statLabel}>Total ETF Analyses</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{data?.summary?.intake?.total || 0}</div>
            <div style={styles.statLabel}>Intake Submissions</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{data?.summary?.intake?.promoted || 0}</div>
            <div style={styles.statLabel}>Promoted to Pipeline</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{avgEventsPerOrg}</div>
            <div style={styles.statLabel}>Avg Events / Org</div>
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            ["orgs", "Organizations"],
            ["feedback", `Feedback${data?.summary?.openFeedback ? ` (${data.summary.openFeedback})` : ""}`],
            ["health", "Email Health"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #2E5644", fontSize: 13, fontWeight: 600, cursor: "pointer", background: view === key ? "#E0784E" : "transparent", color: view === key ? "#fff" : "#9FB8A9" }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Org table */}
        {view === "orgs" && (
        <div style={{ background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #2E5644", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>Organizations</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or city…"
                style={{ padding: "7px 12px", background: "#132E22", border: "1px solid #2E5644", borderRadius: 10, color: "#F7F5EF", fontSize: 13, outline: "none", width: 220, fontFamily: "inherit" }}
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "7px 12px", background: "#132E22", border: "1px solid #2E5644", borderRadius: 10, color: "#F7F5EF", fontSize: 13, outline: "none", fontFamily: "inherit" }}
              >
                <option value="joinedAt">Sort: Newest</option>
                <option value="events">Sort: Most Events</option>
                <option value="members">Sort: Most Members</option>
                <option value="lastActive">Sort: Last Active</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th} onClick={() => setSortBy("name")}>Organization</th>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th} onClick={() => setSortBy("joinedAt")}>Joined</th>
                  <th style={styles.th} onClick={() => setSortBy("members")}>Members</th>
                  <th style={styles.th} onClick={() => setSortBy("events")}>Total Events</th>
                  <th style={styles.th}>Analysis</th>
                  <th style={styles.th}>Application</th>
                  <th style={styles.th}>Complete</th>
                  <th style={styles.th} onClick={() => setSortBy("lastActive")}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ ...styles.td, textAlign: "center", color: "#7E9C8D", padding: "32px" }}>
                      {search ? "No orgs match your search." : "No organizations yet."}
                    </td>
                  </tr>
                ) : filteredOrgs.map((org) => (
                  <tr key={org.id} style={{ background: "transparent" }}>
                    <td style={{ ...styles.td, fontWeight: 600, color: "#F7F5EF" }}>{org.name}</td>
                    <td style={styles.td}>{org.city ? `${org.city}, ${org.state}` : "—"}</td>
                    <td style={styles.td}>{fmtDate(org.joinedAt)}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: org.memberCount > 0 ? "#E0784E" : "#7E9C8D" }}>
                      {org.memberCount || "—"}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 700, color: org.totalEvents > 0 ? "#E0784E" : "#7E9C8D" }}>
                      {org.totalEvents}
                    </td>
                    <td style={styles.td}>
                      {org.inAnalysis > 0 ? <span style={styles.pill("#E0784E")}>{org.inAnalysis}</span> : <span style={{ color: "#7E9C8D" }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {org.inApplication > 0 ? <span style={styles.pill("#2563eb")}>{org.inApplication}</span> : <span style={{ color: "#7E9C8D" }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {org.completed > 0 ? <span style={styles.pill("#059669")}>{org.completed}</span> : <span style={{ color: "#7E9C8D" }}>—</span>}
                    </td>
                    <td style={{ ...styles.td, color: "#6C7065" }}>{fmtRelative(org.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Feedback */}
        {view === "feedback" && (
          <div style={{ background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 12, padding: "8px 0" }}>
            {(data?.feedback || []).length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#55705F", fontSize: 13.5 }}>No feedback or crash reports yet.</div>
            ) : (
              (data?.feedback || []).map((f) => {
                const catColor = f.category === "crash" ? "#dc2626" : f.category === "idea" ? "#2563eb" : "#E0784E";
                const catLabel = f.category === "crash" ? "Crash" : f.category === "idea" ? "Idea" : "Bug";
                return (
                  <div key={f.id} style={{ padding: "14px 20px", borderBottom: "1px solid #24493827" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: catColor, border: `1px solid ${catColor}55`, borderRadius: 6, padding: "2px 7px" }}>{catLabel}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#F7F5EF" }}>{f.member_name || "Unknown"}</span>
                      <span style={{ fontSize: 12, color: "#6C7065" }}>· {f.org_name || "—"}</span>
                      <span style={{ fontSize: 12, color: "#55705F", marginLeft: "auto" }}>{fmtDate(f.created_at)} · {fmtTime(f.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: "#C9CFC2", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{f.message}</div>
                    <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                      {f.page && <span style={{ fontSize: 11.5, color: "#55705F" }}>Page: {f.page}</span>}
                      {f.github_issue_url && <a href={f.github_issue_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "#E0784E" }}>View GitHub issue →</a>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Email health */}
        {view === "health" && (
          <div style={{ background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2E5644", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>Scheduled Email History</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => runCron("reminders")} disabled={running === "reminders"} style={{ padding: "6px 12px", background: "transparent", border: "1px solid #E0784E", borderRadius: 10, color: "#E0784E", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {running === "reminders" ? "Sending…" : "▶ Run weekly now"}
                </button>
                <button onClick={() => runCron("engagement")} disabled={running === "engagement"} style={{ padding: "6px 12px", background: "transparent", border: "1px solid #E0784E", borderRadius: 10, color: "#E0784E", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {running === "engagement" ? "Sending…" : "▶ Run monthly now"}
                </button>
              </div>
            </div>
            {(data?.cronRuns || []).length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#55705F", fontSize: 13.5 }}>
                No scheduled emails have run yet. The weekly digest runs Mondays; the monthly check-in runs on the 1st.
              </div>
            ) : (
              <div style={{ padding: "8px 0" }}>
                {(data?.cronRuns || []).map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #24493827", fontSize: 13.5 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#9FB8A9", minWidth: 90 }}>
                      {r.job === "reminders" ? "Weekly" : r.job === "engagement" ? "Monthly" : r.job}
                    </span>
                    <span style={{ flex: 1, color: "#C9CFC2" }}>{r.detail || `${r.sent}/${r.recipients} sent`}</span>
                    <span style={{ color: r.sent > 0 || r.recipients === 0 ? "#059669" : "#dc2626", fontWeight: 600, fontSize: 12 }}>
                      {r.sent > 0 ? "✓ Sent" : r.recipients === 0 ? "— None due" : "✗ Failed"}
                    </span>
                    <span style={{ color: "#55705F", fontSize: 12, minWidth: 130, textAlign: "right" }}>{fmtDate(r.created_at)} · {fmtTime(r.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "orgs" && (
          <div style={{ marginTop: 16, fontSize: 11.5, color: "#55705F", textAlign: "center" }}>
            Aggregate data only — no event names, financial details, or proprietary information is displayed.
          </div>
        )}
      </div>
    </div>
  );
}
