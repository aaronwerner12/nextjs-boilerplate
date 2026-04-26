"use client";

import { useEffect, useState } from "react";
import ETFPlaybook from "./ETFPlaybook";
import LandingPage from "./LandingPage";

export default function Page() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const isAuthed = !!localStorage.getItem("etf_authed");
    setAuthed(isAuthed);
  }, []);

  // Show nothing while checking auth to avoid flash
  if (authed === null) return null;

  // Show landing page to logged-out visitors
  if (!authed) return <LandingPage />;

  // Show the tool to authenticated users
  return <ETFPlaybook />;
}
