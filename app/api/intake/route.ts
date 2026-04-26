import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';


const sql = neon(process.env.DATABASE_URL!);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_intake (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      data JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT
    )
  `;
  // Add intake columns to events table for promoted submissions
  await sql`ALTER TABLE etf_events ADD COLUMN IF NOT EXISTS intake_id TEXT`.catch(() => {});
}

async function sendNotificationEmail(submission: any, notifyEmail: string, orgName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !notifyEmail) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

  const eligSummary = Object.entries(submission.elig || {})
    .map(([k, v]) => `${k}: ${v === true ? "✓ Yes" : v === false ? "✗ No" : "—"}`)
    .join("\n");

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1613;">
      <div style="background: #1a1613; color: #f5f0e8; padding: 24px 32px; border-radius: 4px 4px 0 0;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 600;">New Event Intake Submission</h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: #9e9890;">${orgName} · Texas Events Trust Fund Analysis Tool</p>
      </div>
      <div style="padding: 32px; border: 1px solid #e8e3db; border-top: none; border-radius: 0 0 4px 4px;">
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr style="border-bottom: 1px solid #e8e3db;">
            <td style="padding: 10px 0; font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em; width: 40%;">Event Name</td>
            <td style="padding: 10px 0; font-size: 15px; font-weight: 600;">${submission.eventName || "—"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e8e3db;">
            <td style="padding: 10px 0; font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em;">Organization</td>
            <td style="padding: 10px 0; font-size: 14px;">${submission.orgName || "—"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e8e3db;">
            <td style="padding: 10px 0; font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em;">Contact</td>
            <td style="padding: 10px 0; font-size: 14px;">${submission.contactName || "—"} — <a href="mailto:${submission.contactEmail}" style="color: #1a1613;">${submission.contactEmail || "—"}</a>${submission.contactPhone ? ` · ${submission.contactPhone}` : ""}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e8e3db;">
            <td style="padding: 10px 0; font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em;">Dates</td>
            <td style="padding: 10px 0; font-size: 14px;">${submission.firstDay || "—"} → ${submission.lastDay || "—"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e8e3db;">
            <td style="padding: 10px 0; font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em;">Attendance</td>
            <td style="padding: 10px 0; font-size: 14px;">${submission.totalAttendance || "—"} total · ${submission.outOfMarketPct || "—"} out-of-market</td>
          </tr>
          <tr style="border-bottom: 1px solid #e8e3db;">
            <td style="padding: 10px 0; font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em;">Room Nights</td>
            <td style="padding: 10px 0; font-size: 14px;">${submission.roomNightsNeeded || "—"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e8e3db;">
            <td style="padding: 10px 0; font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em;">Site Selection Org</td>
            <td style="padding: 10px 0; font-size: 14px;">${submission.siteSelectionOrg || "—"}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em;">Budget</td>
            <td style="padding: 10px 0; font-size: 14px;">${submission.estimatedEventBudget || "—"}</td>
          </tr>
        </table>

        <div style="background: #faf8f4; border: 1px solid #e8e3db; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px;">Eligibility Pre-Screen</div>
          <div style="font-size: 13px; font-family: monospace; color: #1a1613; white-space: pre-line;">${eligSummary || "Not answered"}</div>
        </div>

        ${submission.notes ? `
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; color: #6b6660; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px;">Notes from organizer</div>
          <div style="font-size: 14px; color: #374151; line-height: 1.6;">${submission.notes}</div>
        </div>
        ` : ""}

        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e8e3db;">
          <p style="font-size: 13px; color: #6b6660; margin: 0 0 16px;">This submission is waiting for your review in the ETF Analysis Tool.</p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"}" 
             style="display: inline-block; padding: 12px 28px; background: #1a1613; color: #f5f0e8; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">
            Review in Tool →
          </a>
        </div>
      </div>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ETF Tool <noreply@yourdomain.com>", // update with your verified domain
      to: [notifyEmail],
      subject: `New ETF Intake: ${submission.eventName || "Untitled"} — ${submission.orgName || "Unknown org"}`,
      html,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();

    const id = "intake_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);

    await sql`
      INSERT INTO etf_intake (id, data, status)
      VALUES (${id}, ${JSON.stringify(body)}, 'pending')
    `;

    // Look up the org's notification email from the database
    // Intake form is public so we notify all orgs, or look up by a provided org context
    // For now we fetch all orgs with a notify_email and send to all — each DMO gets their own tool instance
    try {
      const orgs = await sql`SELECT id, name, notify_email FROM etf_orgs WHERE notify_email IS NOT NULL AND notify_email != ''`;
      for (const org of orgs) {
        await sendNotificationEmail(body, org.notify_email, org.name);
      }
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr);
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("POST /api/intake error:", error);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}

// GET /api/intake?org_id=xxx — fetch pending intake submissions for review
export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id");
    const status = searchParams.get("status") || "pending";

    // Intake submissions are not org-scoped (anyone can submit)
    // but we filter by status for the DMO review queue
    const rows = await sql`
      SELECT id, data, status, submitted_at, reviewed_at, reviewed_by
      FROM etf_intake
      WHERE status = ${status}
      ORDER BY submitted_at DESC
      LIMIT 50
    `;

    return NextResponse.json(rows.map((r) => ({
      id: r.id,
      ...r.data,
      status: r.status,
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
    })));
  } catch (error) {
    console.error("GET /api/intake error:", error);
    return NextResponse.json({ error: "Failed to fetch intake" }, { status: 500 });
  }
}

// PATCH /api/intake — promote to event or dismiss
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, reviewedBy, orgId } = body; // action: "promote" | "dismiss"

    if (action === "promote") {
      // Mark intake as promoted
      await sql`
        UPDATE etf_intake
        SET status = 'promoted', reviewed_at = NOW(), reviewed_by = ${reviewedBy || "Unknown"}
        WHERE id = ${id}
      `;
      // Create a draft event from the intake data
      const rows = await sql`SELECT data FROM etf_intake WHERE id = ${id}`;
      if (rows.length > 0) {
        const intakeData = rows[0].data as any;
        const eventId = "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
        const eventData = {
          name: intakeData.eventName || "Untitled Event",
          status: "analysis",
          firstDay: intakeData.firstDay || "",
          lastDay: intakeData.lastDay || "",
          siteSelectionOrg: intakeData.siteSelectionOrg || "",
          roomNights: parseInt(intakeData.roomNightsNeeded?.replace(/[^0-9]/g, "") || "0"),
          outOfMarketPct: parseInt(intakeData.outOfMarketPct?.replace(/[^0-9]/g, "") || "0"),
          notes: [
            intakeData.notes,
            `Submitted by ${intakeData.contactName} (${intakeData.contactEmail})`,
            intakeData.venueNeeds ? `Venue needs: ${intakeData.venueNeeds}` : "",
            intakeData.primaryCosts ? `Budget breakdown: ${intakeData.primaryCosts}` : "",
          ].filter(Boolean).join("\n\n"),
          intakeId: id,
          intakeContact: {
            name: intakeData.contactName,
            email: intakeData.contactEmail,
            phone: intakeData.contactPhone,
            org: intakeData.orgName,
          },
          elig: {
            competitiveBid: intakeData.elig?.competitive ?? null,
            annualOrOnce: intakeData.elig?.annual ?? null,
            soleSiteOrRegional: intakeData.elig?.solesite ?? null,
            notHeldElsewhere: intakeData.elig?.notelsewhere ?? null,
          },
        };

        await sql`
          INSERT INTO etf_events (id, org_id, data, created_by, updated_at)
          VALUES (${eventId}, ${orgId || null}, ${JSON.stringify(eventData)}, ${"Intake: " + (intakeData.contactName || "Unknown")}, NOW())
        `;
        return NextResponse.json({ ok: true, eventId });
      }
    } else if (action === "dismiss") {
      await sql`
        UPDATE etf_intake
        SET status = 'dismissed', reviewed_at = NOW(), reviewed_by = ${reviewedBy || "Unknown"}
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/intake error:", error);
    return NextResponse.json({ error: "Failed to update intake" }, { status: 500 });
  }
}