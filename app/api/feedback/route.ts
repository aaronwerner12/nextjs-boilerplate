import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS etf_feedback (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      org_name TEXT,
      member_name TEXT,
      category TEXT,
      message TEXT NOT NULL,
      page TEXT,
      user_agent TEXT,
      github_issue_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// POST /api/feedback — store feedback and, when a GitHub token is
// configured, open a GitHub issue so it lands directly in the repo's
// queue (where Claude Code / the Claude GitHub app can pick it up).
export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const { message, category = "bug", orgId = "", orgName = "", memberName = "", page = "" } = await req.json();

    if (!message || message.trim().length < 5) {
      return NextResponse.json({ error: "Please describe the issue" }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const id = "fb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const userAgent = req.headers.get("user-agent") || "";

    let issueUrl: string | null = null;

    // File a GitHub issue if a token is configured. Trim defends against
    // stray whitespace/newlines from pasting the token into the env var.
    const token = (process.env.GITHUB_FEEDBACK_TOKEN || "").trim();
    const repo = (process.env.GITHUB_FEEDBACK_REPO || "aaronwerner12/nextjs-boilerplate").trim();
    if (!token) {
      console.warn("feedback: GITHUB_FEEDBACK_TOKEN not set — storing in DB only");
    } else {
      try {
        const labels = category === "idea" ? ["enhancement", "user-feedback"] : ["bug", "user-feedback"];
        const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "etf-tool-feedback",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: `[${category === "idea" ? "Idea" : "Bug"}] ${message.trim().slice(0, 80)}${message.length > 80 ? "…" : ""}`,
            body: [
              `**Reported from the app** by ${memberName || "unknown user"} at ${orgName || "unknown org"}`,
              page ? `**Page:** ${page}` : "",
              userAgent ? `**Browser:** ${userAgent}` : "",
              "",
              "---",
              "",
              message.trim(),
            ].filter(Boolean).join("\n"),
            labels,
          }),
        });
        if (ghRes.ok) {
          const issue = await ghRes.json();
          issueUrl = issue.html_url || null;
        } else {
          const errBody = await ghRes.text().catch(() => "");
          console.error(`feedback: GitHub issue creation failed — HTTP ${ghRes.status}: ${errBody.slice(0, 500)}`);
        }
      } catch (err) {
        // GitHub failure shouldn't lose the feedback — it's stored in DB below
        console.error("feedback: GitHub request threw:", err);
      }
    }

    await sql`
      INSERT INTO etf_feedback (id, org_id, org_name, member_name, category, message, page, user_agent, github_issue_url)
      VALUES (${id}, ${orgId}, ${orgName}, ${memberName}, ${category}, ${message.trim()}, ${page}, ${userAgent}, ${issueUrl})
    `;

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("POST /api/feedback error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
