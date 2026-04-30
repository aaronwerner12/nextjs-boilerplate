"use client";

import { useEffect, useState } from "react";
import ETFPlaybook from "./ETFPlaybook";
import LandingPage from "./LandingPage";

export default function Page() {
  const [state, setState] = useState<"loading" | "landing" | "app">("loading");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const isAuthed = !!localStorage.getItem("etf_authed");
      const wantsSignIn = window.location.search.includes("signin=1");

      // Handle email verification redirect from /api/auth/verify
      // auth param contains encoded session=...&email=...&userId=...&orgId=...
      const authParam = params.get("auth");
      if (authParam) {
        try {
          const authData = new URLSearchParams(authParam);
          const email = authData.get("email");
          const userId = authData.get("userId");
          const orgId = authData.get("orgId");
          if (email) {
            localStorage.setItem("etf_authed", "1");
            if (!localStorage.getItem("etf_team_member")) {
              const displayName = email.split("@")[0]
                .replace(/[._-]+/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
              localStorage.setItem("etf_team_member", displayName);
            }
            if (userId) localStorage.setItem("etf_member_id", userId);
            if (orgId) {
              localStorage.setItem("etf_org_id", orgId);
              try {
                const r = await fetch(`/api/orgs?id=${encodeURIComponent(orgId)}`, { cache: "no-store" });
                if (r.ok) {
                  const org = await r.json();
                  localStorage.setItem("etf_org_data", JSON.stringify(org));
                }
              } catch (_) {}
            }
            window.history.replaceState({}, "", "/");
            setState("app");
            return;
          }
        } catch (_) {}
      }

      if (wantsSignIn || isAuthed) {
        setState("app");
      } else {
        setState("landing");
      }
    })();
  }, []);

  if (state === "loading") return null;
  if (state === "landing") return <LandingPage />;
  return <ETFPlaybook />;
}
