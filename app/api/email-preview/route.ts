import { NextRequest, NextResponse } from "next/server";
import { buildDigestHtml, buildPulseHtml } from "../cron/email-templates";

export const dynamic = "force-dynamic";

// GET /api/email-preview?type=digest|pulse — admin-only render of the
// exact email HTML the cron jobs send, populated with sample data.
export async function GET(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }
  const pwd = req.headers.get("x-admin-pwd");
  if (pwd !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 86400000);

  let html: string;
  if (type === "digest") {
    html = buildDigestHtml("Visit McKinney", [
      { eventName: "SVF National Junior Qualifier", label: "Submit Application Packet", due: days(-2), daysAway: -2 },
      { eventName: "TX State Soccer Championship", label: "Submit Application Packet", due: days(9), daysAway: 9 },
      { eventName: "SVF National Junior Qualifier", label: "Event Support Contract Submitted", due: days(21), daysAway: 21 },
      { eventName: "Craig Ranch Golf Invitational", label: "Attendance Certification Due", due: days(33), daysAway: 33 },
      { eventName: "Craig Ranch Golf Invitational", label: "Local Share Deposit Due (2pm CST)", due: days(41), daysAway: 41 },
    ]);
  } else if (type === "pulse") {
    html = buildPulseHtml(
      "Visit McKinney",
      {
        totalEvents: 6,
        active: 4,
        daysSinceActivity: 12,
        nudge: "Heard about a new event considering your area? Even a rough analysis with estimated attendance tells you whether it's worth pursuing ETF funding — before you commit staff time.",
      },
      process.env.NEXT_PUBLIC_APP_URL || "https://etfplaybook.vercel.app",
      now.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    );
  } else {
    return NextResponse.json({ error: "type must be digest or pulse" }, { status: 400 });
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Email preview — ${type}</title></head>
<body style="margin:0;padding:32px;background:#e5e5e5">
  <div style="max-width:640px;margin:0 auto">
    <div style="font-family:sans-serif;font-size:12px;color:#666;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px">
      Preview: ${type === "digest" ? "Weekly Deadline Digest (Mondays)" : "Monthly Pipeline Check-in (1st of month)"} — sample data
    </div>
    ${html}
  </div>
</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
