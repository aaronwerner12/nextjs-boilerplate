"use client";

import { useEffect, useState } from "react";
import ETFPlaybook from "./ETFPlaybook";
import LandingPage from "./LandingPage";

export default function Page() {
  const [state, setState] = useState<"loading" | "landing" | "app">("loading");

  useEffect(() => {
    const isAuthed = !!localStorage.getItem("etf_authed");
    const wantsSignIn = window.location.search.includes("signin=1");

    if (wantsSignIn || isAuthed) {
      setState("app");
    } else {
      setState("landing");
    }
  }, []);

  if (state === "loading") return null;
  if (state === "landing") return <LandingPage />;
  return <ETFPlaybook />;
}
