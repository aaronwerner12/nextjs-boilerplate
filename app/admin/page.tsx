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

export default function AdminPage() {
  const [pwd, setPwd] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("joinedAt");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin?pwd=${encodeURIComponent(pwd)}`);
      if (res.status === 401) { setError("Incorrect password."); setLoading(false); return; }
      if (!res.ok) throw new Error("Server error");
      const json = await res.json();
      setData(json);
      setAuthed(true);
    } catch (e) {
      setError("Failed to load. Check your connection.");
    }
    setLoading(false);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?pwd=${encodeURIComponent(pwd)}`);
      const json = await res.json();
      setData(json);
    } catch (_) {}
    setLoading(false);
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

  const styles = {
    page: { minHeight: "100vh", background: "#0f0e0c", color: "#f5f0e8", fontFamily: "'Inter', system-ui, sans-serif" },
    header: { background: "#1a1814", borderBottom: "1px solid #2a2720", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    logo: { fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: "#c8b97a" },
    badge: { fontSize: 11, background: "#c8b97a22", color: "#c8b97a", border: "1px solid #c8b97a33", borderRadius: 4, padding: "3px 8px", textTransform: "uppercase", letterSpacing: ".1em" },
    body: { maxWidth: 1100, margin: "0 auto", padding: "32px 24px" },
    statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 32 },
    statCard: { background: "#1a1814", border: "1px solid #2a2720", borderRadius: 6, padding: "20px 24px" },
    statValue: { fontFamily: SERIF, fontSize: 36, fontWeight: 600, color: "#c8b97a", lineHeight: 1 },
    statLabel: { fontSize: 12, color: "#6b6660", textTransform: "uppercase", letterSpacing: ".1em", marginTop: 6 },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: { textAlign: "left" as const, padding: "10px 14px", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".1em", color: "#6b6660", borderBottom: "1px solid #2a2720", cursor: "pointer" },
    td: { padding: "14px", borderBottom: "1px solid #1a1814", fontSize: 13.5, color: "#c8c0b0", verticalAlign: "top" as const },
    pill: (color) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + "22", color }),
  };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0e0c", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: "#f5f0e8" }}>ETF Tool</div>
            <div style={{ fontSize: 12, color: "#6b6660", textTransform: "uppercase", letterSpacing: ".12em", marginTop: 4 }}>Admin Dashboard</div>
          </div>
          <div style={{ background: "#1a1814", border: "1px solid #2a2720", borderRadius: 8, padding: "32px 28px" }}>
            <div style={{ fontSize: 13, color: "#6b6660", marginBottom: 20 }}>Enter your admin password to view usage stats.</div>
            {error && <div style={{ padding: "10px 14px", background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 4, fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}
            <input
              autoFocus
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Admin password"
              style={{ width: "100%", padding: "12px 14px", background: "#0f0e0c", border: "1px solid #2a2720", borderRadius: 4, color: "#f5f0e8", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 14 }}
            />
            <button
              onClick={handleLogin}
              disabled={loading || !pwd}
              style={{ width: "100%", padding: "12px", background: "#c8b97a", color: "#0f0e0c", border: "none", borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: "#6b6660" }}>
            {loading ? "Refreshing…" : `Last updated ${fmtRelative(new Date())}`}
          </div>
          <button onClick={refresh} style={{ padding: "6px 14px", background: "transparent", border: "1px solid #2a2720", borderRadius: 4, color: "#9e9890", fontSize: 12, cursor: "pointer" }}>
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
            <div style={styles.statValue}>{data?.summary?.totalEvents || 0}</div>
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
            <div style={styles.statValue}>
              {data?.summary?.totalOrgs > 0
                ? Math.round((data?.summary?.totalEvents || 0) / data.summary.totalOrgs)
                : 0}
            </div>
            <div style={styles.statLabel}>Avg Events / Org</div>
          </div>
        </div>

        {/* Org table */}
        <div style={{ background: "#1a1814", border: "1px solid #2a2720", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a2720", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>Organizations</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or city…"
                style={{ padding: "7px 12px", background: "#0f0e0c", border: "1px solid #2a2720", borderRadius: 4, color: "#f5f0e8", fontSize: 13, outline: "none", width: 220, fontFamily: "inherit" }}
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "7px 12px", background: "#0f0e0c", border: "1px solid #2a2720", borderRadius: 4, color: "#f5f0e8", fontSize: 13, outline: "none", fontFamily: "inherit" }}
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
                    <td colSpan={9} style={{ ...styles.td, textAlign: "center", color: "#4a4740", padding: "32px" }}>
                      {search ? "No orgs match your search." : "No organizations yet."}
                    </td>
                  </tr>
                ) : filteredOrgs.map((org) => (
                  <tr key={org.id} style={{ background: "transparent" }}>
                    <td style={{ ...styles.td, fontWeight: 600, color: "#f5f0e8" }}>{org.name}</td>
                    <td style={styles.td}>{org.city ? `${org.city}, ${org.state}` : "—"}</td>
                    <td style={styles.td}>{fmtDate(org.joinedAt)}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: org.memberCount > 0 ? "#c8b97a" : "#4a4740" }}>
                      {org.memberCount || "—"}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 700, color: org.totalEvents > 0 ? "#c8b97a" : "#4a4740" }}>
                      {org.totalEvents}
                    </td>
                    <td style={styles.td}>
                      {org.inAnalysis > 0 ? <span style={styles.pill("#d97706")}>{org.inAnalysis}</span> : <span style={{ color: "#4a4740" }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {org.inApplication > 0 ? <span style={styles.pill("#2563eb")}>{org.inApplication}</span> : <span style={{ color: "#4a4740" }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {org.completed > 0 ? <span style={styles.pill("#059669")}>{org.completed}</span> : <span style={{ color: "#4a4740" }}>—</span>}
                    </td>
                    <td style={{ ...styles.td, color: "#6b6660" }}>{fmtRelative(org.lastActive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 11.5, color: "#3a3730", textAlign: "center" }}>
          Aggregate data only — no event names, financial details, or proprietary information is displayed.
        </div>
      </div>
    </div>
  );
}
