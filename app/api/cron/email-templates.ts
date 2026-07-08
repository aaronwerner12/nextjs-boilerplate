// Shared email HTML builders — used by the cron senders AND the admin
// preview endpoint, so previews always match what actually goes out.

export type DigestDeadline = {
  eventName: string;
  label: string;
  due: Date;
  daysAway: number;
};

export function buildDigestHtml(orgName: string, upcoming: DigestDeadline[]): string {
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const rows = upcoming.map((d) => {
    const status = d.daysAway < 0
      ? `<span style="color:#dc2626;font-weight:700">${Math.abs(d.daysAway)} days OVERDUE</span>`
      : d.daysAway <= 14
        ? `<span style="color:#B04E31;font-weight:700">in ${d.daysAway} days</span>`
        : `in ${d.daysAway} days`;
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #DFDDD0;font-size:14px">${status}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #DFDDD0;font-size:14px"><strong>${d.label}</strong><br><span style="color:#6C7065;font-size:13px">${d.eventName}</span></td>
      <td style="padding:8px 12px;border-bottom:1px solid #DFDDD0;font-size:13px;color:#6C7065;white-space:nowrap">${fmtDate(d.due)}</td>
    </tr>`;
  }).join("");

  return `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#F1EFE6;border-radius:12px">
  <h2 style="color:#1E4536;margin:0 0 4px">ETF Deadline Digest</h2>
  <p style="color:#6C7065;font-size:14px;margin:0 0 20px">${orgName} — ${upcoming.length} deadline${upcoming.length === 1 ? "" : "s"} in the next 45 days</p>
  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden">
    ${rows}
  </table>
  <p style="color:#979A8D;font-size:12px;margin-top:20px">Sent weekly by your ETF Analysis Tool. Deadlines are computed from Texas Event Trust Fund Guidelines. Not affiliated with the Office of the Governor or EDT.</p>
</div>`;
}

export type PulseStats = {
  totalEvents: number;
  active: number;
  daysSinceActivity: number | null;
  nudge: string;
};

export function buildPulseHtml(orgName: string, stats: PulseStats, appUrl: string, monthLabel: string): string {
  const statCell = (num: string | number, label: string) => `
    <td style="padding:14px 18px;background:#fff;border-radius:10px;text-align:center">
      <div style="font-size:26px;font-weight:700;color:#B04E31;font-family:Georgia,serif">${num}</div>
      <div style="font-size:11px;color:#6C7065;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">${label}</div>
    </td>`;

  return `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:28px;background:#F1EFE6;border-radius:12px">
  <h2 style="color:#1E4536;margin:0 0 4px">Your ETF pipeline check-in</h2>
  <p style="color:#6C7065;font-size:14px;margin:0 0 20px">${orgName} · ${monthLabel}</p>

  <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:20px"><tr>
    ${statCell(stats.totalEvents, "Events tracked")}
    ${statCell(stats.active, "Active")}
    ${statCell(stats.daysSinceActivity === null ? "—" : `${stats.daysSinceActivity}d`, "Since last activity")}
  </tr></table>

  <div style="background:#fff;border-radius:10px;padding:16px 20px;font-size:14px;color:#1E4536;line-height:1.6;margin-bottom:20px">
    ${stats.nudge}
  </div>

  <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#E0784E;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600">Open the ETF Tool →</a>

  <p style="color:#979A8D;font-size:12px;margin-top:24px;line-height:1.6">
    You get this check-in monthly, plus a separate weekly digest when deadlines are approaching.
    Not affiliated with the Texas Office of the Governor or EDT.
  </p>
</div>`;
}
