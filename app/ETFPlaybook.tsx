// @ts-nocheck
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronRight, ChevronDown, CheckCircle2, XCircle, AlertCircle,
  Calendar, FileText, Calculator, ClipboardList, BookOpen,
  TrendingUp, Users, Building2, DollarSign, Clock,
  Plus, Trash2, Save, Download, ArrowRight, Circle,
  Info, ChevronLeft, Folder, Target, Scale
} from "lucide-react";

// ————————————————————————————————————————————————————————————————
// Texas ETF Pursuit Tool — Multi-Org Team Edition
// Each DMO has their own scoped events and venue list.
// NOT an official state form. NOT affiliated with EDT.
// ————————————————————————————————————————————————————————————————

// ————————————————————————————————————————————————————————————————
// API helpers
// ————————————————————————————————————————————————————————————————
const api = {
  async getOrg(orgId) {
    const res = await fetch(`/api/orgs?id=${orgId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Org not found");
    return res.json();
  },
  async saveOrg(org) {
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(org),
    });
    if (!res.ok) throw new Error("Failed to save org");
    return res.json();
  },
  async getEvents(orgId) {
    const res = await fetch(`/api/events?org_id=${orgId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load events");
    return res.json();
  },
  async saveEvent(event, orgId) {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, orgId }),
    });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      const err = new Error("conflict");
      err.isConflict = true;
      err.latest = data.latest;
      throw err;
    }
    if (!res.ok) throw new Error("Failed to save event");
    return res.json().catch(() => ({}));
  },
  async deleteEvent(id, orgId) {
    const by = typeof window !== "undefined" ? localStorage.getItem("etf_team_member") || "" : "";
    const qs = orgId ? `?org_id=${encodeURIComponent(orgId)}&by=${encodeURIComponent(by)}` : "";
    const res = await fetch(`/api/events/${id}${qs}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete event");
  },
  async getDeletedEvents(orgId) {
    const res = await fetch(`/api/events?org_id=${orgId}&deleted=1`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  },
  async restoreEvent(id, orgId) {
    const by = typeof window !== "undefined" ? localStorage.getItem("etf_team_member") || "" : "";
    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", orgId, by }),
    });
    if (!res.ok) throw new Error("Failed to restore event");
  },
  async getActivity(eventId, orgId) {
    const res = await fetch(`/api/events/${eventId}/activity?org_id=${encodeURIComponent(orgId)}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  },
  async getTeam(orgId) {
    const res = await fetch(`/api/team?org_id=${orgId}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  },
  async upsertMember(member) {
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(member),
    });
    if (!res.ok) return null;
    return res.json();
  },
  async teamAction(payload) {
    const res = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Action failed");
    return res.json();
  },
};

const ELIG_KEYS = ["competitive", "annual", "solesite", "notelsewhere"];

const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString();
};
const fmtNum = (n) => (n == null || isNaN(n) ? "0" : Math.round(n).toLocaleString());
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const addDays = (dateStr, days) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d;
};

// ————————————————————————————————————————————————————————————————
// Default event template
// ————————————————————————————————————————————————————————————————
const blankEvent = () => ({
  id: "evt_" + Date.now(),
  created: new Date().toISOString(),
  name: "",
  siteSelectionOrg: "",
  firstDay: "",
  lastDay: "",
  venue: "", // legacy single-venue field (kept for backward compat)
  venues: [], // array of venue names (multi-select)
  status: "analysis", // analysis | application | approved | post-event | complete
  // Eligibility
  elig: {
    competitiveBid: null,    // bool
    siteSelectionLetter: null,
    annualOrOnce: null,
    soleSiteOrRegional: null,
    notHeldElsewhere: null,
  },
  // Financial quick-est
  attendeeEst: 0,
  qualityPerAttendee: 9, // $6-12
  // Full model
  roomNights: 0,
  outOfMarketPct: 50,
  hotelBlockConfirmed: false,
  // Detailed calc inputs (mirrors the Adidas EIS)
  calc: {
    days: [], // {date, schedule, players, coaches, staff, scouts, media, spectators}
    mix: {
      outOfState: 70, // %
      texasOutOfMarket: 20,
      dayVisitor: 10,
    },
    rates: {
      hotelRate: 180,
      personsPerRoom: 3,
      pctStayingHotel: 90,
      foodBev: 56,
      entertainment: 64,
      alcohol: 14,
      pctAlcohol: 22,
      rentalCar: 88,
      pctRenting: 25,
      personsPerCar: 3,
    },
  },
  // Docs
  docs: {
    application: { done: false, date: "" },
    endorsement: { done: false, date: "" },
    selectionLetter: { done: false, date: "" },
    economicImpact: { done: false, date: "" },
    affidavitEIS: { done: false, date: "" },
    affidavitEndorsing: { done: false, date: "" },
    attendanceChart: { done: false, date: "" },
    supportContract: { done: false, date: "" },
    attendanceCert: { done: false, date: "" },
    localShare: { done: false, date: "" },
    disbursement: { done: false, date: "" },
  },
  notes: "",
  // Post-award outcome tracking
  outcome: {
    awardedAmount: "",     // from EDT award letter
    awardDate: "",
    actualAttendance: "",  // for the 45-day certification
    disbursedAmount: "",   // final amount received
    disbursedDate: "",
  },
});

// ————————————————————————————————————————————————————————————————
// Demo mode — a fully-loaded sample org so visitors can explore
// without creating an account. Nothing in demo mode is saved.
// ————————————————————————————————————————————————————————————————
const DEMO_ORG = {
  id: "demo_org",
  demo: true,
  name: "Visit Maplewood (Demo)",
  city: "Maplewood",
  state: "TX",
  notifyEmail: "events@visitmaplewood.demo",
  fiscalYearStart: 10,
  thresholdMin: 75000,
  thresholdStrong: 150000,
  thresholdStrategic: 300000,
  contactName: "Jamie Rodriguez",
  contactTitle: "Director of Sports Tourism",
  contactPhone: "(972) 555-0142",
  contactEmail: "jamie@visitmaplewood.demo",
  address: "100 Main Street, Maplewood, TX 75000",
  venues: [
    { name: "Maplewood Sports Complex", address: "4200 Championship Dr" },
    { name: "Riverside Soccer Fields", address: "801 River Rd" },
    { name: "Maplewood Convention Center", address: "55 Center Plaza" },
  ],
};

function buildDemoEvents() {
  const iso = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return d.toISOString().split("T")[0];
  };
  const demoDays = (startOffset, counts) => counts.map((c, i) => ({
    date: iso(startOffset + i),
    schedule: "",
    players: c[0], coaches: c[1], staff: c[2], scouts: c[3], media: c[4], spectators: c[5],
  }));
  const base = blankEvent();

  return [
    {
      ...JSON.parse(JSON.stringify(base)),
      id: "demo_evt_1",
      name: "National Youth Volleyball Qualifier",
      siteSelectionOrg: "US Youth Volleyball Federation",
      firstDay: iso(160),
      lastDay: iso(163),
      venues: ["Maplewood Sports Complex"],
      status: "analysis",
      elig: { competitiveBid: true, siteSelectionLetter: true, annualOrOnce: true, soleSiteOrRegional: true, notHeldElsewhere: true },
      attendeeEst: 6800,
      qualityPerAttendee: 10,
      roomNights: 2400,
      calc: {
        ...base.calc,
        days: demoDays(160, [
          [900, 140, 60, 10, 6, 1100],
          [900, 140, 60, 18, 8, 1400],
          [820, 130, 60, 25, 10, 1500],
          [520, 90, 50, 30, 12, 1600],
        ]),
      },
      createdBy: "Jamie Rodriguez",
      notes: "Strong candidate — federation confirmed out-of-state alternatives were Tulsa and Baton Rouge. Selection letter promised by end of month.",
    },
    {
      ...JSON.parse(JSON.stringify(base)),
      id: "demo_evt_2",
      name: "State Soccer Championship",
      siteSelectionOrg: "TX Youth Soccer Association",
      firstDay: iso(135),
      lastDay: iso(137),
      venues: ["Riverside Soccer Fields"],
      status: "application",
      elig: { competitiveBid: true, siteSelectionLetter: true, annualOrOnce: true, soleSiteOrRegional: true, notHeldElsewhere: true },
      attendeeEst: 4200,
      qualityPerAttendee: 9,
      roomNights: 1600,
      calc: {
        ...base.calc,
        days: demoDays(135, [
          [1200, 180, 70, 8, 4, 2000],
          [1200, 180, 70, 12, 6, 2400],
          [700, 110, 60, 15, 8, 2600],
        ]),
      },
      docs: {
        ...base.docs,
        application: { done: true, date: iso(-10) },
        endorsement: { done: true, date: iso(-8) },
        selectionLetter: { done: true, date: iso(-15) },
        attendanceChart: { done: true, date: iso(-10) },
      },
      createdBy: "Jamie Rodriguez",
      notes: "Application submitted. Waiting on EDT award letter — affidavits at the notary now.",
    },
    {
      ...JSON.parse(JSON.stringify(base)),
      id: "demo_evt_3",
      name: "Regional BBQ Festival",
      siteSelectionOrg: "",
      firstDay: iso(90),
      lastDay: iso(91),
      venues: ["Maplewood Convention Center"],
      status: "analysis",
      elig: { competitiveBid: false, siteSelectionLetter: null, annualOrOnce: true, soleSiteOrRegional: true, notHeldElsewhere: true },
      attendeeEst: 9000,
      qualityPerAttendee: 6,
      createdBy: "Sam Patel",
      notes: "Fails the competitive site selection test — the festival has always been here with no out-of-state bid process. Not ETF-eligible; keeping for reference.",
    },
    {
      ...JSON.parse(JSON.stringify(base)),
      id: "demo_evt_4",
      name: "Junior Golf Invitational",
      siteSelectionOrg: "American Junior Golf Circuit",
      firstDay: iso(-140),
      lastDay: iso(-137),
      venues: ["Maplewood Sports Complex"],
      status: "complete",
      elig: { competitiveBid: true, siteSelectionLetter: true, annualOrOnce: true, soleSiteOrRegional: true, notHeldElsewhere: true },
      attendeeEst: 2800,
      qualityPerAttendee: 11,
      roomNights: 1900,
      calc: {
        ...base.calc,
        days: demoDays(-140, [
          [400, 90, 40, 20, 10, 700],
          [400, 90, 40, 22, 10, 800],
          [380, 85, 40, 24, 12, 900],
          [300, 70, 35, 26, 14, 950],
        ]),
      },
      outcome: {
        awardedAmount: "128500",
        awardDate: iso(-200),
        actualAttendance: "5100",
        disbursedAmount: "117200",
        disbursedDate: iso(-60),
      },
      createdBy: "Jamie Rodriguez",
      notes: "Wrapped and disbursed. Actual attendance came in ~8% under estimate — spectator counts were optimistic. Adjust next year's model.",
    },
  ];
}

// Categories for attendee mix
export const ATTENDEE_CATS = [
  { key: "players", label: "Players/Competitors", perRoom: 4 },
  { key: "coaches", label: "Coaches", perRoom: 2 },
  { key: "staff", label: "Staff", perRoom: 2 },
  { key: "scouts", label: "Scouts/College Coaches", perRoom: 2 },
  { key: "media", label: "Media / TV", perRoom: 2 },
  { key: "spectators", label: "Friends/Family/Spectators", perRoom: 4 },
];

// McKinney sports venues
const DEFAULT_MCKINNEY_VENUES = [
  "Al Ruschhaupt Soccer Complex — 2701 Northbrook Drive",
  "Alex Clark Memorial Disc Golf Course — 1986 Park View Ave",
  "Arete Athletics Center — 1720 Bray Central Dr.",
  "Baseball Nation Aviator Ballpark — 6151 CR 124",
  "Children's Health StarCenter at Craig Ranch — 6993 Stars Av",
  "Erwin Park — 4300 CR 1006",
  "Frozen Ropes of McKinney — 6161 CR 124",
  "Gabe Nesbitt Baseball Complex — 7001 Eldorado Parkway",
  "Gabe Nesbitt Softball Complex — 3205 Alma Road",
  "Grady Littlejohn Softball & Baseball Complex — 1401 Wilson Creek Pkwy",
  "McKinney ISD Stadium — 4201 S. Hardin Blvd.",
  "McKinney Soccer Complex at Craig Ranch — 6375 Collin McKinney Pkwy",
  "Mouzon Ball Fields — 1307 East Greenville Ave.",
  "Oak Hollow Golf Course — 3005 N McDonald St",
  "PSA McKinney — 7205 Eldorado Pkwy",
  "Ron Poe Stadium - McKinney ISD — 1 Duval Street",
  "Stonebridge Ranch Hills Course — 5901 Glen Oaks Drive",
  "The Beach at Craig Ranch — 6145 Alma Road",
  "Towne Lake Disc Golf Course — 1405 Wilson Creek Parkway",
  "TPC Craig Ranch — 8000 Collin McKinney Pkwy.",
  "Velocity Badminton — 4220 Ridge Rd.",
  "Westridge Golf Course — 9055 N. Cotton Ridge Rd.",
];

// Timeline deadlines (days relative to first day of event)
// Per Event Trust Fund Guidelines Sept 2025
export const TIMELINE = [
  { key: "application", label: "Submit Application Packet", offset: -120, phase: "pre", critical: true, ref: "Guidelines p.4" },
  { key: "award", label: "Award Letter from EDT", offset: -90, phase: "pre", critical: false, ref: "Guidelines p.4 (~30 days after app)" },
  { key: "supportContract", label: "Event Support Contract Submitted", offset: -1, phase: "pre", critical: true, ref: "Guidelines p.6" },
  { key: "eventStart", label: "EVENT BEGINS", offset: 0, phase: "event", critical: false, ref: "" },
  { key: "attendanceCert", label: "Attendance Certification Due", offset: 45, phase: "post", critical: true, ref: "Guidelines p.7" },
  { key: "certDecision", label: "EDT Accept/Reject (within 14 days of cert)", offset: 59, phase: "post", critical: false, ref: "Guidelines p.7" },
  { key: "localShare", label: "Local Share Deposit Due (2pm CST)", offset: 90, phase: "post", critical: true, ref: "Guidelines p.7" },
  { key: "disbursement", label: "Disbursement Request Due", offset: 180, phase: "post", critical: true, ref: "Guidelines p.8" },
];

// ————————————————————————————————————————————————————————————————
// Calculation engine — mirrors the Texas ETF tax methodology
// ————————————————————————————————————————————————————————————————
export function calculateTrustFund(event) {
  if (!event) return { quickEstimate: 0, totalFund: 0, totalRoomNights: 0, requiredLocalMatch: 0, days: [] };
  const { calc = { days: [] }, roomNights, outOfMarketPct, attendeeEst, qualityPerAttendee } = event;
  const safeDays = calc?.days || [];

  // Quick estimate if no detailed calc
  const quickEstimate = (attendeeEst || 0) * (qualityPerAttendee || 0);

  // Detailed calc (following the Adidas EIS pattern)
  const totalDays = safeDays.length;
  let totalAttendance = 0;
  let totalHotelSpend = 0;
  let totalFoodBev = 0;
  let totalEntertainment = 0;
  let totalAlcohol = 0;
  let totalCarRental = 0;
  let totalRoomNights = 0;

  // Mix fractions
  const mixOOS = ((calc.mix?.outOfState) || 0) / 100;
  const mixTX = ((calc.mix?.texasOutOfMarket) || 0) / 100;
  // Day visitors don't contribute to hotel/incremental tax in same way
  // but still generate food/entertainment sales tax
  const r = calc?.rates || {};

  // Sum attendee-days across all categories and days
  safeDays.forEach((day) => {
    ATTENDEE_CATS.forEach((cat) => {
      const n = Number(day[cat.key]) || 0;
      totalAttendance += n;

      // Revenue-generating visitors (OOS + TX out-of-market)
      const revGenPeople = n * (mixOOS + mixTX);

      // Hotel: only for overnight visitors
      const hotelPeople = revGenPeople * (r.pctStayingHotel / 100);
      const roomsToday = hotelPeople / (r.personsPerRoom || 1);
      totalRoomNights += roomsToday;
      totalHotelSpend += roomsToday * (r.hotelRate || 0);

      // Food/bev
      totalFoodBev += revGenPeople * (r.foodBev || 0);
      // Entertainment
      totalEntertainment += revGenPeople * (r.entertainment || 0);
      // Alcohol
      totalAlcohol += revGenPeople * (r.alcohol || 0) * ((r.pctAlcohol || 0) / 100);
      // Rental car
      const carPeople = revGenPeople * ((r.pctRenting || 0) / 100);
      const cars = carPeople / (r.personsPerCar || 1);
      totalCarRental += cars * (r.rentalCar || 0);
    });
  });

  // Tax rates (TX state + typical local)
  // State sales/use: 6.25%, State hotel occupancy: 6%
  // Local sales: ~2% (city+county combined local cap), Local HOT: ~7% (typical TX city)
  // ⚙ Update these if your city's actual local rates differ
  const stateTaxRates = {
    sales: 0.0625,
    hotel: 0.06,
    mixedBev: 0.067,
    rentalVeh: 0.1,
  };
  const localTaxRates = {
    sales: 0.02,
    hotel: 0.07,
  };

  // State tax generated
  const stateHotelTax = totalHotelSpend * stateTaxRates.hotel;
  const stateSalesTax = (totalFoodBev + totalEntertainment) * stateTaxRates.sales;
  const stateMixedBev = totalAlcohol * stateTaxRates.mixedBev;
  const stateRentalTax = totalCarRental * stateTaxRates.rentalVeh;
  const stateTaxTotal = stateHotelTax + stateSalesTax + stateMixedBev + stateRentalTax;

  // Local tax generated
  const localHotelTax = totalHotelSpend * localTaxRates.hotel;
  const localSalesTax = (totalFoodBev + totalEntertainment) * localTaxRates.sales;
  const localTaxTotal = localHotelTax + localSalesTax;

  // ETF math: state share capped at 6.25x local contribution
  // Local match needed to unlock full state share = stateTaxTotal / 6.25
  const requiredLocalMatch = stateTaxTotal / 6.25;
  const totalFund = stateTaxTotal + requiredLocalMatch;

  return {
    quickEstimate,
    totalAttendance,
    totalRoomNights,
    totalSpend: totalHotelSpend + totalFoodBev + totalEntertainment + totalAlcohol + totalCarRental,
    spendBreakdown: {
      hotel: totalHotelSpend,
      foodBev: totalFoodBev,
      entertainment: totalEntertainment,
      alcohol: totalAlcohol,
      rental: totalCarRental,
    },
    stateTaxTotal,
    localTaxTotal,
    requiredLocalMatch,
    totalFund,
    days: safeDays,
  };
}

// ————————————————————————————————————————————————————————————————
// Decision framework — pursuit evaluation logic
// ————————————————————————————————————————————————————————————————
function evaluateDecision(event, calcResult, thresholds = {}) {
  const t = {
    min: thresholds.min ?? 75000,
    strong: thresholds.strong ?? 150000,
    strategic: thresholds.strategic ?? 300000,
  };
  const checks = [];
  const elig = event.elig;

  // Hard gates
  const eligibilityPassed =
    elig.competitiveBid && elig.siteSelectionLetter &&
    elig.annualOrOnce && elig.soleSiteOrRegional && elig.notHeldElsewhere;

  checks.push({
    label: "Statutory eligibility (all 5 criteria met)",
    pass: eligibilityPassed,
    critical: true,
  });

  // Financial threshold
  const estimate = calcResult.totalFund > 0 ? calcResult.totalFund : calcResult.quickEstimate;
  checks.push({
    label: `ETF value exceeds ${fmtMoney(t.min)} viability floor`,
    pass: estimate >= t.min,
    critical: true,
    detail: `Projected: ${fmtMoney(estimate)}`,
  });

  // Hotel performance
  checks.push({
    label: "Room nights ≥ 1,500 (recommended floor for ETF viability)",
    pass: (event.roomNights || calcResult.totalRoomNights || 0) >= 1500,
    critical: false,
    detail: `Projected: ${fmtNum(event.roomNights || calcResult.totalRoomNights)} room nights`,
  });

  // Out-of-market
  checks.push({
    label: "Out-of-market attendance ≥ 50%",
    pass: (event.outOfMarketPct || 0) >= 50,
    critical: false,
    detail: `${event.outOfMarketPct || 0}% projected`,
  });

  // Final recommendation
  let recommendation;
  let rationale;
  if (!eligibilityPassed) {
    recommendation = "DO NOT PURSUE";
    rationale = "Statutory eligibility not met. Without a competitive bid and site selection letter, the event cannot qualify for ETF.";
  } else if (estimate < t.min) {
    recommendation = "DO NOT PURSUE";
    rationale = `Projected ETF value below ${fmtMoney(t.min)} — administrative burden likely exceeds the fund value.`;
  } else if (estimate >= t.strategic) {
    recommendation = "STRATEGIC PRIORITY";
    rationale = "High-value event meeting all criteria. Move to application immediately.";
  } else if (estimate >= t.strong) {
    recommendation = "STRONG PURSUE";
    rationale = "Solid ETF value with eligibility intact. Proceed with application.";
  } else {
    recommendation = "PURSUE WITH CONDITIONS";
    rationale = "Moderate ETF value. Validate room block and out-of-market assumptions before committing.";
  }

  return { checks, recommendation, rationale, estimate, thresholds: t };
}


// ————————————————————————————————————————————————————————————————
// Crash reporter — auto-files crashes through the feedback pipeline
// (GitHub issue when the token is configured, DB always). Throttled
// per error signature so a crash loop can't spam the repo.
// ————————————————————————————————————————————————————————————————
function reportCrash(kind, error, componentStack) {
  try {
    const message = String(error?.message || error || "Unknown error").slice(0, 300);
    const stack = String(error?.stack || "").slice(0, 1500);

    // One report per unique error per 6 hours, per browser
    const signature = "etf_crash_" + kind + "_" + message.slice(0, 80).replace(/[^a-z0-9]/gi, "_");
    const last = Number(localStorage.getItem(signature) || 0);
    if (Date.now() - last < 6 * 60 * 60 * 1000) return;
    localStorage.setItem(signature, String(Date.now()));

    let orgName = "";
    try { orgName = JSON.parse(localStorage.getItem("etf_org_data") || "{}").name || ""; } catch (_) {}

    // First line becomes the GitHub issue title
    const body = [
      `${kind}: ${message}`,
      "",
      stack ? "```\n" + stack + "\n```" : "",
      componentStack ? "**Component stack:**\n```" + String(componentStack).slice(0, 800) + "\n```" : "",
    ].filter(Boolean).join("\n");

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: body,
        category: "crash",
        orgName,
        memberName: localStorage.getItem("etf_team_member") || "",
        page: window.location.pathname,
      }),
    }).catch(() => {});
  } catch (_) {
    // The crash reporter must never crash
  }
}

// ————————————————————————————————————————————————————————————————
// Error Boundary — catches crashes and shows a recovery screen
// ————————————————————————————————————————————————————————————————
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    reportCrash("render crash", error, errorInfo?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#F1EFE6", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', sans-serif" }}>
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Something went wrong</div>
            <p style={{ color: "#6C7065", fontSize: 14, marginBottom: 24 }}>The app ran into an error. Try clearing your browser data for this site and signing in again.</p>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ padding: "12px 24px", background: "#1E4536", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Clear data & reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ————————————————————————————————————————————————————————————————
// Component — Main App (Neon Postgres team edition)
// ————————————————————————————————————————————————————————————————

// ————————————————————————————————————————————————————————————————
// Component — Main App (Multi-org edition)
// ————————————————————————————————————————————————————————————————
function ETFPlaybookInner() {
  const [events, setEvents] = useState([]);
  const [currentEventId, setCurrentEventId] = useState(null);
  const [lastDeleted, setLastDeleted] = useState(null);
  const undoTimerRef = React.useRef(null);
  const [showTrash, setShowTrash] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [saveStatus, setSaveStatus] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [teamMemberTitle, setTeamMemberTitle] = useState("");
  const [memberRecord, setMemberRecord] = useState(null);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [showOrgSettings, setShowOrgSettings] = useState(false);
  const [showAdminWelcome, setShowAdminWelcome] = useState(false);

  // Org + member identity — loaded from localStorage (SSR-safe)
  const [orgId, setOrgId] = useState("");
  const [orgData, setOrgData] = useState(null);
  const [teamMember, setTeamMember] = useState("");
  const [setupStep, setSetupStep] = useState(null); // null | "login" | "org" | "name"
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Demo sessions never touch the shared localStorage cache
  const cacheEvents = (list) => {
    if (demoMode) return;
    try { localStorage.setItem("etf_events_cache", JSON.stringify(list)); } catch (_) {}
  };

  // ── Bootstrap: check auth ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Demo mode: sample org + events, nothing persists, no auth needed
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setDemoMode(true);
      setOrgId(DEMO_ORG.id);
      setOrgData(DEMO_ORG);
      setTeamMember("Demo Explorer");
      setEvents(buildDemoEvents());
      return;
    }

    const storedAuth = localStorage.getItem("etf_authed");
    const storedMember = localStorage.getItem("etf_team_member");
    const storedOrg = localStorage.getItem("etf_org_id");
    const storedOrgData = localStorage.getItem("etf_org_data");

    if (!storedAuth || !storedMember) {
      setSetupStep("login");
      return;
    }

    if (storedOrg && storedOrgData) {
      setOrgId(storedOrg);
      setLoading(true);
      try { setOrgData(JSON.parse(storedOrgData)); } catch (_) {}
    } else if (storedAuth && storedMember) {
      // Authed but no org data — go straight to login to re-authenticate
      setSetupStep("login");
      return;
    }
    setTeamMember(storedMember);
    setTeamMemberTitle(localStorage.getItem("etf_team_title") || "");

    // Load member record to check admin status
    const storedMemberId = localStorage.getItem("etf_member_id");
    if (storedMemberId && storedOrg) {
      api.getTeam(storedOrg).then((members) => {
        const me = members.find((m) => m.id === storedMemberId);
        if (me) {
          setMemberRecord(me);
          if (me.is_admin && !localStorage.getItem("etf_seen_admin_welcome")) {
            setShowAdminWelcome(true);
            localStorage.setItem("etf_seen_admin_welcome", "1");
          }
        }
      }).catch(() => {});
    }
  }, []);

  // ── Load org data + events once org is known ──────────────────
  useEffect(() => {
    if (!orgId || setupStep || demoMode) return;
    (async () => {
      // Load org data and events independently — don't let one block the other
      const storedOrgData = localStorage.getItem("etf_org_data");
      if (storedOrgData) {
        try { setOrgData(JSON.parse(storedOrgData)); } catch (_) {}
      }

      // Try to get fresh org from DB
      api.getOrg(orgId).then((org) => {
        setOrgData(org);
        localStorage.setItem("etf_org_data", JSON.stringify(org));
      }).catch(() => {}); // fallback to localStorage already set above

      // Show cached events immediately while API loads
      const cachedEvents = localStorage.getItem("etf_events_cache");
      if (cachedEvents) {
        try { setEvents(JSON.parse(cachedEvents)); } catch (_) {}
      }

      // Load events from DB
      try {
        const evts = await api.getEvents(orgId);
        setEvents(evts);
        cacheEvents(evts);
      } catch (e) {
        console.error("Failed to load events:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, setupStep]);

  // ── Refresh events every 30s to pick up teammates' changes ───
  useEffect(() => {
    if (!orgId || setupStep || demoMode) return;
    const interval = setInterval(async () => {
      try {
        const evts = await api.getEvents(orgId);
        setEvents(evts);
      } catch (_) {}
    }, 30000);
    return () => clearInterval(interval);
  }, [orgId, setupStep]);

  const currentEvent = events.find((e) => e.id === currentEventId);

  const saveTimerRef = React.useRef(null);

  const updateEvent = (updater) => {
    const current = events.find((e) => e.id === currentEventId);
    if (!current) return;
    const updated = updater(current);
    setEvents((prev) => prev.map((e) => (e.id === currentEventId ? updated : e)));
    setSaveStatus("saving");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (demoMode) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2000);
        return;
      }
      try {
        const result = await api.saveEvent({
          ...updated,
          createdBy: updated.createdBy || teamMember,
          editedBy: teamMember,
          baseUpdatedAt: updated.updatedAt,
        }, orgId);
        // Track the server's timestamp so our own next save isn't
        // mistaken for someone else's conflicting edit
        setEvents((prev) => {
          const updated2 = prev.map((e) =>
            e.id === updated.id ? { ...updated, updatedAt: result?.updatedAt || e.updatedAt } : e
          );
          cacheEvents(updated2);
          return updated2;
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2000);
      } catch (err) {
        if (err?.isConflict) {
          setConflict({ eventId: updated.id, latest: err.latest, mine: updated });
          setSaveStatus("");
        } else {
          setSaveStatus("error");
        }
      }
    }, 800);
  };

  // Conflict resolution: someone else saved this event while we were editing
  const resolveConflictTheirs = () => {
    if (!conflict) return;
    setEvents((prev) => {
      const updated = prev.map((e) => e.id === conflict.eventId ? { ...conflict.latest, orgId } : e);
      cacheEvents(updated);
      return updated;
    });
    setConflict(null);
  };

  const resolveConflictMine = async () => {
    if (!conflict) return;
    const mine = conflict.mine;
    setConflict(null);
    try {
      // Save without baseUpdatedAt = deliberate overwrite
      const result = await api.saveEvent({ ...mine, createdBy: mine.createdBy || teamMember, editedBy: teamMember, baseUpdatedAt: undefined }, orgId);
      setEvents((prev) => {
        const updated = prev.map((e) => e.id === mine.id ? { ...mine, updatedAt: result?.updatedAt || e.updatedAt } : e);
        cacheEvents(updated);
        return updated;
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (_) { setSaveStatus("error"); }
  };

  const createEvent = async () => {
    const e = { ...blankEvent(), createdBy: teamMember, orgId };
    setEvents((prev) => [e, ...prev]);
    setCurrentEventId(e.id);
    setTab("overview");
    // Show walkthrough on first event ever
    const hasSeenWalkthrough = localStorage.getItem("etf_seen_walkthrough");
    if (!hasSeenWalkthrough) {
      setShowWalkthrough(true);
      localStorage.setItem("etf_seen_walkthrough", "1");
    }
    if (!demoMode) try { await api.saveEvent(e, orgId); } catch (_) {}
  };

  const deleteEvent = async (id) => {
    const deleted = events.find((e) => e.id === id);
    setEvents((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      cacheEvents(updated);
      return updated;
    });
    if (currentEventId === id) setCurrentEventId(null);
    if (!demoMode) try { await api.deleteEvent(id, orgId); } catch (_) {}
    // Offer undo for 8 seconds; the event stays in the trash for 30 days either way
    if (deleted) {
      clearTimeout(undoTimerRef.current);
      setLastDeleted(deleted);
      undoTimerRef.current = setTimeout(() => setLastDeleted(null), 8000);
    }
  };

  const undoDelete = async () => {
    if (!lastDeleted) return;
    const restored = lastDeleted;
    clearTimeout(undoTimerRef.current);
    setLastDeleted(null);
    setEvents((prev) => {
      const updated = [restored, ...prev];
      cacheEvents(updated);
      return updated;
    });
    if (!demoMode) try { await api.restoreEvent(restored.id, orgId); } catch (_) {}
  };

  // Duplicate an event for the next year — shifts all dates forward one year
  // and resets application progress (docs, status, outcome) while keeping
  // the attendance model and eligibility answers.
  const cloneEvent = async (id) => {
    const source = events.find((e) => e.id === id);
    if (!source) return;
    const shiftYear = (dateStr) => {
      if (!dateStr) return "";
      const [y, m, d] = dateStr.split("-").map(Number);
      if (!y || !m || !d) return "";
      return `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    };
    const nextYear = source.firstDay ? parseInt(source.firstDay.split("-")[0]) + 1 : new Date().getFullYear() + 1;
    const baseName = (source.name || "Untitled Event").replace(/\s*\(?\b(19|20)\d{2}\)?\s*$/, "").trim();
    const clone = {
      ...JSON.parse(JSON.stringify(source)),
      id: "evt_" + Date.now(),
      created: new Date().toISOString(),
      name: `${baseName} ${nextYear}`,
      firstDay: shiftYear(source.firstDay),
      lastDay: shiftYear(source.lastDay),
      status: "analysis",
      docs: blankEvent().docs,
      outcome: {},
      shareToken: undefined,
      notes: source.notes || "",
      createdBy: teamMember,
      orgId,
    };
    if (Array.isArray(clone.calc?.days)) {
      clone.calc.days = clone.calc.days.map((day) => ({ ...day, date: shiftYear(day.date) }));
    }
    setEvents((prev) => {
      const updated = [clone, ...prev];
      cacheEvents(updated);
      return updated;
    });
    setCurrentEventId(clone.id);
    setTab("overview");
    if (!demoMode) try { await api.saveEvent(clone, orgId); } catch (_) {}
  };

  const handleLoginComplete = async (name, title, newOrg, email) => {
    localStorage.setItem("etf_authed", "1");
    localStorage.setItem("etf_team_member", name);
    localStorage.setItem("etf_team_title", title || "");
    if (email) localStorage.setItem("etf_member_email", email);
    setTeamMember(name);
    setTeamMemberTitle(title || "");

    let resolvedOrgId = orgId;
    if (newOrg) {
      setOrgId(newOrg.id);
      setOrgData(newOrg);
      resolvedOrgId = newOrg.id;
    } else {
      const storedOrg = localStorage.getItem("etf_org_id");
      const storedOrgData = localStorage.getItem("etf_org_data");
      if (storedOrg) { setOrgId(storedOrg); resolvedOrgId = storedOrg; }
      if (storedOrgData) try { setOrgData(JSON.parse(storedOrgData)); } catch (_) {}
    }

    // Register/update member in database
    const memberId = "mbr_" + (name.toLowerCase().replace(/[^a-z0-9]/g, "_")) + "_" + (resolvedOrgId || "").substring(0, 8);
    localStorage.setItem("etf_member_id", memberId);
    if (resolvedOrgId) {
      try {
        const record = await api.upsertMember({ id: memberId, orgId: resolvedOrgId, name, title: title || "", email: email || "" });
        if (record) {
          setMemberRecord(record);
          if (record.is_admin && !localStorage.getItem("etf_seen_admin_welcome")) {
            setShowAdminWelcome(true);
            localStorage.setItem("etf_seen_admin_welcome", "1");
          }
        }
      } catch (_) {}
    }

    setSetupStep(null);
    setLoading(true);

    // Load fresh org data first
    if (resolvedOrgId) {
      try {
        const freshOrg = await api.getOrg(resolvedOrgId);
        setOrgData(freshOrg);
        localStorage.setItem("etf_org_data", JSON.stringify(freshOrg));
      } catch (_) {
        // keep whatever orgData is already set
      }
    }

    // Then load events
    try {
      const evts = await api.getEvents(resolvedOrgId);
      setEvents(Array.isArray(evts) ? evts : []);
      cacheEvents(evts);
    } catch (e) {
      console.error("Failed to load events after login:", e);
      const cached = localStorage.getItem("etf_events_cache");
      if (cached) try { setEvents(JSON.parse(cached) || []); } catch (_) { setEvents([]); }
    } finally {
      setLoading(false);
    }
  };

  // ── Setup flows ───────────────────────────────────────────────
  if (setupStep === "login") return <LoginScreen onComplete={handleLoginComplete} />;

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingText}>Loading your pipeline…</div>
      </div>
    );
  }

  // Venues from org database, falling back to McKinney defaults
  const venues = Array.isArray(orgData?.venues) ? orgData.venues.map((v) => v.address ? `${v.name} — ${v.address}` : v.name) : [];

  return (
    <div style={styles.app} className="etf-app">
      <GlobalStyles />

      {/* Mobile overlay */}
      <div
        className={`etf-sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Mobile top bar */}
      <div className="etf-mobile-header">
        <button className="etf-hamburger" onClick={() => setSidebarOpen(true)}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round"/>
          </svg>
        </button>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600, fontSize: 15 }}>
          {orgData?.name || "Event Fund Playbook"}
        </div>
        <button
          onClick={createEvent}
          style={{ background: "#1E4536", color: "#fff", border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          + New
        </button>
      </div>

      {showAdminWelcome && (
        <AdminWelcomeModal onClose={() => setShowAdminWelcome(false)} onOpenTeam={() => { setShowAdminWelcome(false); setShowTeamPanel(true); }} />
      )}

      {showOrgSettings && (
        <OrgSettingsModal orgData={orgData} orgId={orgId} onClose={() => setShowOrgSettings(false)} onSave={(updated) => {
          setOrgData(updated);
          localStorage.setItem("etf_org_data", JSON.stringify(updated));
          setShowOrgSettings(false);
        }} />
      )}

      {showWalkthrough && (
        <WalkthroughOverlay onClose={() => setShowWalkthrough(false)} setTab={setTab} />
      )}

      {showTeamPanel && memberRecord?.is_admin && (
        <TeamPanel orgId={orgId} memberRecord={memberRecord} onClose={() => setShowTeamPanel(false)} />
      )}

      {showTrash && (
        <TrashPanel
          orgId={orgId}
          onClose={() => setShowTrash(false)}
          onRestored={(restored) => {
            setEvents((prev) => {
              const updated = [restored, ...prev.filter((e) => e.id !== restored.id)];
              cacheEvents(updated);
              return updated;
            });
          }}
        />
      )}

      {/* Demo mode banner */}
      {demoMode && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 500, background: "#E0784E", color: "#fff", padding: "9px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 13, fontWeight: 600, flexWrap: "wrap" }}>
          <span>🧭 You're exploring the demo — click around freely, nothing is saved.</span>
          <a
            href="/?signin=1"
            style={{ background: "#fff", color: "#B04E31", padding: "5px 14px", borderRadius: 8, textDecoration: "none", fontSize: 12.5, fontWeight: 700 }}
          >
            Create your organization →
          </a>
          <a href="/" style={{ color: "#fff", fontSize: 12, textDecoration: "underline" }}>Exit demo</a>
        </div>
      )}

      {/* Edit conflict — someone else saved while we were editing */}
      {conflict && (
        <div style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, maxWidth: 440, width: "100%", color: "#1E4536" }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 600, marginBottom: 8 }}>
              ⚠ Someone else saved this event
            </div>
            <p style={{ fontSize: 13.5, color: "#6C7065", lineHeight: 1.6, marginBottom: 20 }}>
              {conflict.latest?.lastEditedBy || "A teammate"} saved changes to
              {" "}<strong>{conflict.mine?.name || "this event"}</strong>{" "}
              while you were editing. Pick which version to keep — the other one's changes will be lost.
            </p>
            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <button
                onClick={resolveConflictTheirs}
                style={{ padding: "11px", background: "#1E4536", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
              >
                Use {conflict.latest?.lastEditedBy ? `${conflict.latest.lastEditedBy}'s` : "their"} version (discard my edits)
              </button>
              <button
                onClick={resolveConflictMine}
                style={{ padding: "11px", background: "transparent", color: "#B04E31", border: "1px solid #E0784E", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
              >
                Keep my version (overwrite theirs)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo delete toast */}
      {lastDeleted && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 400, background: "#1E4536", color: "#F7F5EF", borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", fontSize: 13.5, maxWidth: "90vw" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Moved “{lastDeleted.name || "Untitled event"}” to trash
          </span>
          <button
            onClick={undoDelete}
            style={{ background: "#E0784E", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
          >
            Undo
          </button>
        </div>
      )}

      <Sidebar
        events={events}
        currentEventId={currentEventId}
        onSelect={(id) => { setCurrentEventId(id); setTab("overview"); setSidebarOpen(false); }}
        onCreate={() => { createEvent(); setSidebarOpen(false); }}
        onDelete={deleteEvent}
        onClone={cloneEvent}
        onHome={() => { setCurrentEventId(null); setTab("dashboard"); setSidebarOpen(false); }}
        saveStatus={saveStatus}
        teamMember={teamMember}
        orgData={orgData}
        onChangeName={() => setSetupStep("name")}
        onManageVenues={() => setShowOrgSettings(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        memberRecord={memberRecord}
        onOpenTeam={() => setShowTeamPanel(true)}
        onOpenTrash={() => setShowTrash(true)}
      />
      <main style={styles.main} className="etf-main">
        {!currentEvent ? (
          <Dashboard
            events={events}
            onOpen={(id) => { setCurrentEventId(id); setTab("overview"); }}
            onCreate={createEvent}
            teamMember={teamMember}
            orgData={orgData}
            onEventCreated={(eventOrId) => {
              if (typeof eventOrId === "object") {
                // Full event object from intake promote — add directly to pipeline
                setEvents((prev) => [eventOrId, ...prev]);
                setCurrentEventId(eventOrId.id);
                api.saveEvent(eventOrId, orgId).catch(() => {});
              } else {
                // Just an ID — refresh from API
                setCurrentEventId(eventOrId);
                api.getEvents(orgId).then(setEvents).catch(() => {});
              }
              setTab("overview");
            }}
          />
        ) : (
          <EventView
            event={currentEvent}
            update={updateEvent}
            tab={tab}
            setTab={setTab}
            orgVenues={venues}
            orgData={orgData}
          />
        )}
      </main>
    </div>
  );
}

export default function ETFPlaybook() {
  // Catch what the ErrorBoundary can't: unhandled promise rejections
  // (like the original iPhone login crash) and uncaught window errors.
  useEffect(() => {
    const onRejection = (e) => reportCrash("unhandled promise rejection", e.reason);
    const onError = (e) => reportCrash("uncaught error", e.error || e.message);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ETFPlaybookInner />
    </ErrorBoundary>
  );
}

// ————————————————————————————————————————————————————————————————
// Login Screen — name + passcode entry
// ————————————————————————————————————————————————————————————————
// ————————————————————————————————————————————————————————————————
// Single sign-in screen — name, org (if new), access code
// ————————————————————————————————————————————————————————————————
function LoginScreen({ onComplete }) {
  const storedName = typeof window !== "undefined" ? localStorage.getItem("etf_team_member") || "" : "";
  const storedEmail = typeof window !== "undefined" ? localStorage.getItem("etf_member_email") || "" : "";
  const isReturning = !!storedName;

  const [mode, setMode] = useState(isReturning ? "returning" : "join");
  const [name, setName] = useState(storedName);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState(storedEmail);
  const [orgName, setOrgName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(isReturning); // returning users already agreed
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState(""); // "" | sending | sent

  const handleForgot = async () => {
    if (!forgotEmail.trim().includes("@")) { setError("Enter your organization's notification email."); return; }
    setError("");
    setForgotStatus("sending");
    try {
      const res = await fetch("/api/orgs/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Too many requests. Try again later.");
        setForgotStatus("");
        return;
      }
      setForgotStatus("sent");
    } catch (_) {
      setError("Connection problem — try again.");
      setForgotStatus("");
    }
  };

  const handlePasscodeLogin = async (nameToUse) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orgs/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        const org = await res.json();
        localStorage.setItem("etf_org_id", org.id);
        localStorage.setItem("etf_org_data", JSON.stringify(org));
        localStorage.setItem(`etf_passcode_${org.id}`, passcode);
        localStorage.setItem("etf_team_member", nameToUse);
        setLoading(false);
        onComplete(nameToUse, title.trim(), org, email.trim());
        return;
      }
      if (res.status === 401) {
        setError("Incorrect access code.");
        setLoading(false);
        return;
      }
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Too many attempts. Try again in 15 minutes.");
        setLoading(false);
        return;
      }
    } catch (_) {}
    // Fallback localStorage check
    const storedOrgId = localStorage.getItem("etf_org_id");
    const stored = storedOrgId ? localStorage.getItem(`etf_passcode_${storedOrgId}`) : null;
    if (stored && passcode === stored) {
      localStorage.setItem("etf_team_member", nameToUse);
      setLoading(false);
      onComplete(nameToUse, "", null, email.trim());
      return;
    }
    setError("Incorrect access code. Check with your team admin.");
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!passcode.trim()) { setError("Please enter your access code."); return; }
    if (!agreed) { setError("Please agree to the Terms of Service and Privacy Policy."); return; }
    await handlePasscodeLogin(name.trim());
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!orgName.trim()) { setError("Please enter your organization name."); return; }
    if (!newPasscode.trim() || newPasscode.length < 8) { setError("Access code must be at least 8 characters."); return; }
    if (!agreed) { setError("Please agree to the Terms of Service and Privacy Policy."); return; }
    setLoading(true);
    const id = orgName.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 40) + "_" + Date.now().toString(36);
    const newOrg = { id, name: orgName, city: "", state: "TX", passcode: newPasscode, venues: [] };
    localStorage.setItem(`etf_passcode_${id}`, newPasscode);
    localStorage.setItem("etf_org_id", id);
    localStorage.setItem("etf_org_data", JSON.stringify(newOrg));
    localStorage.setItem("etf_team_member", name.trim());
    if (title.trim()) localStorage.setItem("etf_team_title", title.trim());
    fetch("/api/orgs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newOrg) }).catch(() => {});
    setLoading(false);
    onComplete(name.trim(), title.trim(), newOrg, email.trim());
  };

  const s = {
    input: { width: "100%", padding: "12px 14px", background: "#132E22", border: "1px solid #2E5644", borderRadius: 10, color: "#F7F5EF", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
    label: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "#6C7065", display: "block", marginBottom: 6 },
    field: { marginBottom: 16 },
  };

  const logo = (
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      <div style={{ width: 52, height: 52, background: "#E0784E", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 18, color: "#132E22" }}>EFP</div>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#F7F5EF" }}>Texas Events Trust Fund</div>
      <div style={{ fontSize: 12, color: "#6C7065", textTransform: "uppercase", letterSpacing: ".12em", marginTop: 4 }}>Analysis Tool</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#132E22", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {logo}

        {/* Returning user — streamlined */}
        {mode === "returning" && (
          <div style={{ background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 14, padding: "32px 28px" }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 600, color: "#F7F5EF", marginBottom: 4 }}>
              Welcome back, {storedName.split(" ")[0]}.
            </div>
            <p style={{ fontSize: 13, color: "#6C7065", margin: "0 0 24px" }}>Enter your access code to continue.</p>

            {error && <div style={{ padding: "10px 14px", background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 10, fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}

            <div style={s.field}>
              <input
                autoFocus
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasscodeLogin(storedName)}
                placeholder="Access code"
                style={{ ...s.input, fontSize: 18, letterSpacing: ".1em" }}
              />
            </div>

            {!storedEmail && (
              <div style={s.field}>
                <label style={s.label}>Your Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasscodeLogin(storedName)}
                  placeholder="you@yourorg.com"
                  style={s.input}
                />
                <div style={{ fontSize: 11.5, color: "#7E9C8D", marginTop: 5 }}>For deadline reminders and monthly pipeline updates.</div>
              </div>
            )}

            <button
              onClick={() => handlePasscodeLogin(storedName)}
              disabled={loading || !passcode}
              style={{ width: "100%", padding: "13px", background: passcode ? "#E0784E" : "#2E5644", color: passcode ? "#fff" : "#6C7065", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: passcode ? "pointer" : "default", fontFamily: "inherit", marginBottom: 14 }}
            >
              {loading ? "Signing in…" : "Enter →"}
            </button>

            <div style={{ textAlign: "center", display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
              <button
                onClick={() => { localStorage.removeItem("etf_team_member"); setMode("join"); setName(""); setAgreed(false); }}
                style={{ background: "none", border: "none", color: "#7E9C8D", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}
              >
                Not {storedName.split(" ")[0]}? Switch account
              </button>
              <button
                onClick={() => { setMode("forgot"); setError(""); }}
                style={{ background: "none", border: "none", color: "#7E9C8D", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}
              >
                Forgot access code?
              </button>
            </div>
          </div>
        )}

        {/* Forgot access code */}
        {mode === "forgot" && (
          <div style={{ background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 14, padding: "32px 28px" }}>
            {forgotStatus === "sent" ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 600, color: "#F7F5EF", marginBottom: 8 }}>Check that inbox</div>
                <p style={{ fontSize: 13, color: "#9FB8A9", lineHeight: 1.6, marginBottom: 20 }}>
                  If that email is registered to an organization, a reset link is on its way. It works for 30 minutes.
                </p>
                <button
                  onClick={() => { setMode(isReturning ? "returning" : "join"); setForgotStatus(""); setForgotEmail(""); }}
                  style={{ background: "none", border: "none", color: "#7E9C8D", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}
                >
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 600, color: "#F7F5EF", marginBottom: 6 }}>Forgot your access code?</div>
                <p style={{ fontSize: 13, color: "#9FB8A9", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Enter your organization's <strong>notification email</strong> (set in Org Settings) and we'll send a link to create a new code for your whole team.
                </p>

                {error && <div style={{ padding: "10px 14px", background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 10, fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}

                <div style={s.field}>
                  <input
                    autoFocus
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleForgot()}
                    placeholder="events@yourorg.com"
                    style={s.input}
                  />
                </div>

                <button
                  onClick={handleForgot}
                  disabled={forgotStatus === "sending" || !forgotEmail}
                  style={{ width: "100%", padding: "13px", background: forgotEmail ? "#E0784E" : "#2E5644", color: forgotEmail ? "#fff" : "#6C7065", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: forgotEmail ? "pointer" : "default", fontFamily: "inherit", marginBottom: 14 }}
                >
                  {forgotStatus === "sending" ? "Sending…" : "Email Reset Link"}
                </button>

                <div style={{ textAlign: "center" }}>
                  <button
                    onClick={() => { setMode(isReturning ? "returning" : "join"); setError(""); }}
                    style={{ background: "none", border: "none", color: "#7E9C8D", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}
                  >
                    ← Back to sign in
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* New user — full form with tabs */}
        {mode !== "returning" && mode !== "forgot" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button onClick={() => { setMode("join"); setError(""); }} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", background: mode === "join" ? "#E0784E" : "#1A3F2F", color: mode === "join" ? "#fff" : "#6C7065", transition: "all .15s" }}>
                Sign In
              </button>
              <button onClick={() => { setMode("create"); setError(""); }} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #2E5644", fontSize: 14, fontWeight: 600, cursor: "pointer", background: mode === "create" ? "#E0784E" : "transparent", color: mode === "create" ? "#fff" : "#9FB8A9", transition: "all .15s" }}>
                New Organization
              </button>
            </div>

            <div style={{ background: "#1A3F2F", border: "1px solid #2E5644", borderRadius: 14, padding: "28px 24px" }}>
              {error && <div style={{ padding: "10px 14px", background: "#7f1d1d22", border: "1px solid #7f1d1d", borderRadius: 10, fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}

              {mode === "join" ? (
                <>
                  <div style={s.field}>
                    <label style={s.label}>Your Name</label>
                    <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} placeholder="e.g. Jamie Rodriguez" style={s.input} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Your Title <span style={{ color: "#7E9C8D", fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Director of Sports Tourism" style={s.input} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Your Work Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourorg.com" style={s.input} />
                    <div style={{ fontSize: 11.5, color: "#7E9C8D", marginTop: 5 }}>For deadline reminders and monthly pipeline updates.</div>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Access Code</label>
                    <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} placeholder="Your team's access code" style={s.input} />
                    <div style={{ fontSize: 11.5, color: "#7E9C8D", marginTop: 5 }}>
                      Get this from your team admin.{" "}
                      <button onClick={() => { setMode("forgot"); setError(""); }} style={{ background: "none", border: "none", color: "#7E9C8D", fontSize: 11.5, cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>
                        Forgot it?
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "#6C7065", lineHeight: 1.6, marginBottom: 20, marginTop: 0 }}>Create a new organization. You'll be the admin and can invite teammates after setup.</p>
                  <div style={s.field}>
                    <label style={s.label}>Your Name</label>
                    <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jamie Rodriguez" style={s.input} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Your Title <span style={{ color: "#7E9C8D", fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Executive Director" style={s.input} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Your Work Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourorg.com" style={s.input} />
                    <div style={{ fontSize: 11.5, color: "#7E9C8D", marginTop: 5 }}>For deadline reminders and monthly pipeline updates.</div>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Organization Name</label>
                    <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Visit Maplewood" style={s.input} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Create Access Code</label>
                    <input type="password" value={newPasscode} onChange={(e) => setNewPasscode(e.target.value)} placeholder="Min. 8 characters" style={s.input} />
                    <div style={{ fontSize: 11.5, color: "#7E9C8D", marginTop: 5 }}>Share this with teammates so they can sign in.</div>
                  </div>
                </>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#6C7065", lineHeight: 1.6 }}>
                    I agree to the{" "}
                    <a href="/terms" target="_blank" style={{ color: "#E0784E" }}>Terms of Service</a>{" "}and{" "}
                    <a href="/privacy" target="_blank" style={{ color: "#E0784E" }}>Privacy Policy</a>.
                    This tool is not affiliated with the State of Texas or EDT.
                  </span>
                </label>
              </div>

              <button
                onClick={mode === "join" ? handleJoin : handleCreate}
                disabled={loading || !agreed}
                style={{ width: "100%", padding: "13px", background: agreed ? "#E0784E" : "#2E5644", color: agreed ? "#fff" : "#6C7065", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading || !agreed ? "default" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}
              >
                {loading ? "Please wait…" : mode === "join" ? "Sign In →" : "Create Organization →"}
              </button>
            </div>
          </>
        )}

        <p style={{ textAlign: "center", fontSize: 12, marginTop: 16 }}>
          <a href="/?demo=1" style={{ color: "#9FB8A9", textDecoration: "underline" }}>Just looking? Explore the demo →</a>
        </p>
        <p style={{ textAlign: "center", fontSize: 11, color: "#55705F", marginTop: 10, lineHeight: 1.6 }}>Not affiliated with the Texas Office of the Governor or EDT.</p>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// AdminWelcomeModal — shown once to the first admin of an org
// ————————————————————————————————————————————————————————————————
function AdminWelcomeModal({ onClose, onOpenTeam }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 32, maxWidth: 460, width: "100%", color: "#1E4536" }}>
        <div style={{ width: 48, height: 48, background: "#E0784E", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>EFP</div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>You're the admin 🎉</div>
        <p style={{ fontSize: 14, color: "#6C7065", lineHeight: 1.6, marginBottom: 16 }}>
          You created this organization, so you manage its team and access. As admin you can:
        </p>
        <ul style={{ fontSize: 13.5, color: "#1E4536", lineHeight: 1.9, margin: "0 0 22px", paddingLeft: 20 }}>
          <li>Invite teammates and share your access code</li>
          <li>Promote others to admin or deactivate members</li>
          <li>Change the team access code anytime</li>
          <li>Set up your organization profile and venues</li>
        </ul>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 18px", background: "transparent", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, cursor: "pointer", color: "#6C7065" }}>
            Explore first
          </button>
          <button onClick={onOpenTeam} style={{ padding: "10px 20px", background: "#E0784E", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Manage Team & Access
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgSettingsModal({ orgData, orgId, onClose, onSave }) {
  const [name, setName] = useState(orgData?.name || "");
  const [city, setCity] = useState(orgData?.city || "");
  const [state, setState] = useState(orgData?.state || "TX");
  const [notifyEmail, setNotifyEmail] = useState(orgData?.notifyEmail || "");
  const [logoUrl, setLogoUrl] = useState(orgData?.logoUrl || "");
  const [fiscalYearStart, setFiscalYearStart] = useState(orgData?.fiscalYearStart ?? 10);
  const [thresholdMin, setThresholdMin] = useState(orgData?.thresholdMin ?? 75000);
  const [thresholdStrong, setThresholdStrong] = useState(orgData?.thresholdStrong ?? 150000);
  const [thresholdStrategic, setThresholdStrategic] = useState(orgData?.thresholdStrategic ?? 300000);
  const [venues, setVenues] = useState(orgData?.venues || []);
  const [newVenue, setNewVenue] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [address, setAddress] = useState(orgData?.address || "");
  const [contactName, setContactName] = useState(orgData?.contactName || "");
  const [contactTitle, setContactTitle] = useState(orgData?.contactTitle || "");
  const [contactPhone, setContactPhone] = useState(orgData?.contactPhone || "");
  const [contactEmail, setContactEmail] = useState(orgData?.contactEmail || "");
  const [taxId, setTaxId] = useState(orgData?.taxId || "");
  const [signatoryName, setSignatoryName] = useState(orgData?.signatoryName || "");
  const [signatoryTitle, setSignatoryTitle] = useState(orgData?.signatoryTitle || "");

  const addVenue = () => {
    if (!newVenue.trim()) return;
    setVenues((v) => [...v, { name: newVenue.trim(), address: "" }]);
    setNewVenue("");
  };

  const removeVenue = (i) => setVenues((v) => v.filter((_, idx) => idx !== i));

  const parseBulk = () => {
    const parsed = bulkText.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const d = line.indexOf(" — ");
      return d > -1 ? { name: line.substring(0, d), address: line.substring(d + 3) } : { name: line, address: "" };
    });
    setVenues(parsed);
    setBulkMode(false);
    setBulkText("");
  };

  const handleSave = async () => {
    setSaving(true);
    const updated = {
      ...orgData, name, city, state, notifyEmail, logoUrl,
      fiscalYearStart: Number(fiscalYearStart),
      thresholdMin: Number(thresholdMin),
      thresholdStrong: Number(thresholdStrong),
      thresholdStrategic: Number(thresholdStrategic),
      venues, address, contactName, contactTitle, contactPhone, contactEmail,
      taxId, signatoryName, signatoryTitle,
    };
    try {
      await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (_) {}
    setSaving(false);
    onSave(updated);
  };

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#6C7065", display: "block", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", border: "1px solid #DFDDD0", borderRadius: 12, padding: 36, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 600 }}>Organization Settings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#979A8D" }}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Organization Logo URL <span style={{ color: "#979A8D", fontWeight: 400, textTransform: "none", fontSize: 11 }}>(optional)</span></label>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://yourorg.com/logo.png" style={inputStyle} />
          <div style={{ fontSize: 11.5, color: "#979A8D", marginTop: 5 }}>
            Paste a direct link to your logo image. It will appear in the sidebar.
            {logoUrl && <span> — <a href={logoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#6C7065" }}>Preview ↗</a></span>}
          </div>
          {logoUrl && (
            <div style={{ marginTop: 10, padding: 10, background: "#1E4536", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <img src={logoUrl} alt="Logo preview" style={{ height: 32, width: 32, objectFit: "contain", background: "#fff", borderRadius: 3, padding: 2 }} onError={(e) => e.target.style.display = 'none'} />
              <span style={{ fontSize: 12, color: "#6C7065" }}>Preview</span>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Organization Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. McKinney" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notification Email</label>
          <input type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} placeholder="events@yourorg.com" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Fiscal Year Start Month</label>
          <select value={fiscalYearStart} onChange={(e) => setFiscalYearStart(Number(e.target.value))} style={inputStyle}>
            {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: "#979A8D", marginTop: 4 }}>Used to calculate which fiscal year your ETF local match falls in.</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>ETF Pursuit Thresholds</label>
          <div style={{ fontSize: 12, color: "#979A8D", marginBottom: 10 }}>
            Set the dollar values that drive your organization's pursuit recommendations. Adjust based on your team's capacity and overhead costs.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#991b1b", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Minimum to Pursue ($)</div>
              <input type="number" value={thresholdMin} onChange={(e) => setThresholdMin(Number(e.target.value))} style={{ ...inputStyle, borderColor: "#fecaca" }} />
              <div style={{ fontSize: 11, color: "#979A8D", marginTop: 3 }}>Below this = Do Not Pursue</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#065f46", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Strong Target ($)</div>
              <input type="number" value={thresholdStrong} onChange={(e) => setThresholdStrong(Number(e.target.value))} style={{ ...inputStyle, borderColor: "#bbf7d0" }} />
              <div style={{ fontSize: 11, color: "#979A8D", marginTop: 3 }}>Above this = Strong Pursue</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#064e3b", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Strategic Priority ($)</div>
              <input type="number" value={thresholdStrategic} onChange={(e) => setThresholdStrategic(Number(e.target.value))} style={{ ...inputStyle, borderColor: "#a7f3d0" }} />
              <div style={{ fontSize: 11, color: "#979A8D", marginTop: 3 }}>Above this = Strategic Priority</div>
            </div>
          </div>
        </div>

        {/* Venues */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={labelStyle}>Venues</label>
            <button onClick={() => setBulkMode(!bulkMode)} style={{ fontSize: 12, color: "#6C7065", background: "transparent", border: "1px solid #DFDDD0", borderRadius: 3, padding: "3px 10px", cursor: "pointer" }}>
              {bulkMode ? "Switch to list" : "Paste a list"}
            </button>
          </div>

          {bulkMode ? (
            <div>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"One venue per line:\nAl Ruschhaupt Soccer Complex — 2701 Northbrook Drive"} rows={6} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12.5, resize: "vertical" }} />
              <button onClick={parseBulk} style={{ marginTop: 8, fontSize: 12.5, padding: "5px 12px", background: "#1E4536", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>Preview →</button>
            </div>
          ) : (
            <div>
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 8 }}>
                {venues.map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#F1EFE6", border: "1px solid #DFDDD0", borderRadius: 3, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{v.name}{v.address ? ` — ${v.address}` : ""}</span>
                    <button onClick={() => removeVenue(i)} style={{ background: "none", border: "none", color: "#979A8D", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newVenue} onChange={(e) => setNewVenue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVenue()} placeholder="Add venue name" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={addVenue} style={{ padding: "10px 16px", background: "#1E4536", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13 }}>Add</button>
              </div>
            </div>
          )}
        </div>

        {/* ETF Application Profile */}
        <div style={{ borderTop: "1px solid #DFDDD0", paddingTop: 20, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>ETF Application Profile</div>
          <div style={{ fontSize: 12, color: "#979A8D", marginBottom: 16 }}>Used to pre-fill the Generate Application Packet on the Apply tab. Fill out once — reused on every event.</div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Mailing Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, McKinney, TX 75069" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Primary Contact Name</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact Title</label>
              <input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="Director of Sports" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Contact Phone</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(972) 555-0100" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact Email</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@yourorg.com" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Federal Tax ID (EIN) <span style={{ color: "#979A8D", fontWeight: 400, textTransform: "none" }}>— for ACH form</span></label>
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="XX-XXXXXXX" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Authorized Signatory Name</label>
              <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="John Doe" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Signatory Title</label>
              <input value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} placeholder="City Manager" style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 18px", background: "transparent", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "10px 20px", background: "#1E4536", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Walkthrough Overlay — guided first event creation
// ————————————————————————————————————————————————————————————————
const WALKTHROUGH_STEPS = [
  {
    step: "01",
    tab: "overview",
    title: "Start with the basics",
    body: "Enter the event name, dates, site selection organization, and your venue. This is the foundation of your analysis.",
    tip: "The site selection org is whoever chose your city — could be a national sports governing body, a trade association, or the event organizer themselves.",
    color: "#E0784E",
  },
  {
    step: "02",
    tab: "decision",
    title: "Run the eligibility check",
    body: "Answer 5 yes/no questions from Texas Government Code § 480.0051. If any answer is No, the event is ineligible — don't spend time on the analysis.",
    tip: "The most common disqualifier: the site selection process wasn't competitive against out-of-state alternatives. Confirm this before going further.",
    color: "#4ade80",
  },
  {
    step: "03",
    tab: "calculator",
    title: "Model the economic impact",
    body: "Enter day-by-day attendance by category (athletes, coaches, family, spectators). The calculator estimates state and local tax generation and your required local match.",
    tip: "Use the Quick Estimate first if you're still evaluating — it gives you a ballpark in seconds. Build the full model when you're ready to apply.",
    color: "#60a5fa",
  },
  {
    step: "04",
    tab: "timeline",
    title: "Check your deadlines",
    body: "The Timeline tab auto-calculates every critical deadline from your event dates — application (120 days before), attendance cert (45 days after), local share (90 days after), disbursement (180 days after).",
    tip: "Missing the Local Share deadline makes the event ineligible for disbursement. Set calendar reminders immediately after your application is approved.",
    color: "#f87171",
  },
  {
    step: "05",
    tab: "apply",
    title: "Apply when you're ready",
    body: "The Apply to ETF tab has links to every official EDT document and generates a pre-filled email to eventsfund@gov.texas.gov. Review the pre-submission checklist before sending.",
    tip: "Never send an application without a signed Selection Letter in hand. EDT will reject incomplete packets.",
    color: "#a78bfa",
  },
];

function WalkthroughOverlay({ onClose, setTab }) {
  const [step, setStep] = useState(0);
  const current = WALKTHROUGH_STEPS[step];
  const isLast = step === WALKTHROUGH_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setTab(current.tab);
      onClose();
    } else {
      setTab(current.tab);
      setStep(step + 1);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(10,9,8,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "#1A3F2F",
        border: `1px solid ${current.color}44`,
        borderTop: `3px solid ${current.color}`,
        borderRadius: 14,
        padding: "40px 36px",
        maxWidth: 520,
        width: "100%",
        position: "relative",
      }}>
        {/* Step indicator */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {WALKTHROUGH_STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= step ? current.color : "#2E5644",
              transition: "background .3s",
            }} />
          ))}
        </div>

        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: current.color, marginBottom: 8, letterSpacing: ".1em" }}>
          STEP {current.step} OF 05
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 600, color: "#F7F5EF", marginBottom: 14, lineHeight: 1.3 }}>
          {current.title}
        </div>
        <p style={{ fontSize: 14.5, color: "#9FB8A9", lineHeight: 1.7, margin: "0 0 20px" }}>
          {current.body}
        </p>
        <div style={{
          background: "#132E22",
          border: "1px solid #2E5644",
          borderLeft: `3px solid ${current.color}`,
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          color: "#6C7065",
          lineHeight: 1.6,
          marginBottom: 28,
        }}>
          <span style={{ color: current.color, fontWeight: 600 }}>Tip: </span>{current.tip}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={onClose}
            style={{ fontSize: 12.5, color: "#7E9C8D", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            Skip walkthrough
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{ padding: "10px 18px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, color: "#9FB8A9", fontSize: 13.5, cursor: "pointer" }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              style={{ padding: "10px 24px", background: current.color, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
            >
              {isLast ? "Start analyzing →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Team Panel — admin team management in sidebar
// ————————————————————————————————————————————————————————————————
function TeamPanel({ orgId, memberRecord, onClose }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPasscode, setNewPasscode] = useState("");
  const [changingPasscode, setChangingPasscode] = useState(false);
  const [passcodeMsg, setPasscodeMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  const orgData = (() => { 
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("etf_org_data") || "{}"); } catch (_) { return {}; } 
  })();
  const storedPasscode = typeof window !== "undefined" ? (localStorage.getItem(`etf_passcode_${orgId}`) || "your-access-code") : "your-access-code";
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://etfplaybook.vercel.app";

  const inviteEmail = `Subject: Join our team on Event Fund Playbook — ${orgData.name || "Our Team"}

Hi,

I'd like to invite you to join our team on the Texas Events Trust Fund Analysis Tool. We're using it to evaluate and track our ETF event pipeline.

Sign in here: ${appUrl}

When prompted, enter:
• Your name and title
• Access code: ${storedPasscode}

The tool is browser-based — no install needed. Once you're in you'll see our shared event pipeline.

Let me know if you have any questions.

${memberRecord?.name || ""}${orgData.name ? "\n" + orgData.name : ""}`;

  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteEmail).then(() => {
      setCopyMsg("✓ Copied to clipboard — paste into any email");
      setTimeout(() => setCopyMsg(""), 3000);
    }).catch(() => {
      setCopyMsg("Copy failed — select text manually");
    });
  };

  const emailInvite = () => {
    const subject = encodeURIComponent(`Join our team on Event Fund Playbook — ${orgData.name || "Our Team"}`);
    const body = encodeURIComponent(inviteEmail.replace(/^Subject:.*\n\n/, ""));
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  useEffect(() => {
    api.getTeam(orgId).then(setMembers).catch(() => {}).finally(() => setLoading(false));
  }, [orgId]);

  const doAction = async (action, memberId) => {
    try {
      await api.teamAction({ action, memberId, requesterId: memberRecord?.id, orgId });
      const updated = await api.getTeam(orgId);
      setMembers(updated);
      setActionMsg(action === "promote" ? "Promoted to admin." : action === "demote" ? "Removed admin." : action === "deactivate" ? "Member deactivated." : "Member reactivated.");
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg("Action failed — " + e.message);
    }
  };

  const handlePasscodeChange = async () => {
    if (newPasscode.length < 8) { setPasscodeMsg("Must be at least 8 characters."); return; }
    try {
      await api.teamAction({ action: "change_passcode", requesterId: memberRecord?.id, orgId, newPasscode });
      localStorage.setItem(`etf_passcode_${orgId}`, newPasscode);
      setPasscodeMsg("✓ Passcode updated. Share the new code with your team.");
      setNewPasscode("");
      setChangingPasscode(false);
    } catch (_) {
      setPasscodeMsg("Failed to update passcode.");
    }
    setTimeout(() => setPasscodeMsg(""), 4000);
  };

  const panelStyle = {
    position: "fixed" as const, inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "flex-start", justifyContent: "flex-start",
  };
  const cardStyle = {
    background: "#1A3F2F", width: 320, height: "100vh",
    borderRight: "1px solid #2E5644", overflowY: "auto" as const,
    padding: "24px 20px",
  };

  return (
    <div style={panelStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, color: "#F7F5EF" }}>Team Management</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6C7065", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        {actionMsg && (
          <div style={{ padding: "8px 12px", background: "#059669", color: "#fff", borderRadius: 10, fontSize: 12.5, marginBottom: 16 }}>{actionMsg}</div>
        )}

        {/* Team members list */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "#6C7065", marginBottom: 12 }}>Team Members</div>
          {loading ? (
            <div style={{ fontSize: 13, color: "#6C7065" }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6C7065" }}>No members yet.</div>
          ) : members.map((m) => (
            <div key={m.id} style={{ padding: "12px 14px", background: "#132E22", border: "1px solid #2E5644", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: m.is_active ? "#F7F5EF" : "#7E9C8D" }}>
                    {m.name}
                    {m.is_admin && <span style={{ marginLeft: 6, fontSize: 10, background: "#E0784E22", color: "#E0784E", border: "1px solid #E0784E33", borderRadius: 3, padding: "1px 6px" }}>Admin</span>}
                    {!m.is_active && <span style={{ marginLeft: 6, fontSize: 10, background: "#dc262622", color: "#f87171", border: "1px solid #dc262633", borderRadius: 3, padding: "1px 6px" }}>Inactive</span>}
                  </div>
                  {m.title && <div style={{ fontSize: 11.5, color: "#6C7065", marginTop: 2 }}>{m.title}</div>}
                  <div style={{ fontSize: 11, color: "#7E9C8D", marginTop: 3 }}>
                    Last seen {m.last_seen ? new Date(m.last_seen).toLocaleDateString() : "never"}
                  </div>
                </div>
                {m.id !== memberRecord?.id && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {m.is_active ? (
                      <button onClick={() => doAction("deactivate", m.id)} style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #dc2626", borderRadius: 3, color: "#f87171", cursor: "pointer" }}>
                        Remove
                      </button>
                    ) : (
                      <button onClick={() => doAction("reactivate", m.id)} style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #059669", borderRadius: 3, color: "#4ade80", cursor: "pointer" }}>
                        Restore
                      </button>
                    )}
                    {!m.is_admin ? (
                      <button onClick={() => doAction("promote", m.id)} style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #E0784E", borderRadius: 3, color: "#E0784E", cursor: "pointer" }}>
                        Make Admin
                      </button>
                    ) : (
                      <button onClick={() => doAction("demote", m.id)} style={{ fontSize: 11, padding: "3px 8px", background: "transparent", border: "1px solid #6C7065", borderRadius: 3, color: "#979A8D", cursor: "pointer" }}>
                        Remove Admin
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invite section */}
        <div style={{ borderTop: "1px solid #2E5644", paddingTop: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "#6C7065", marginBottom: 12 }}>Invite Team Members</div>
          <p style={{ fontSize: 12.5, color: "#6C7065", lineHeight: 1.6, marginBottom: 12 }}>
            Share this pre-written email with anyone you want to add. It includes the tool link and access code.
          </p>
          {copyMsg && <div style={{ fontSize: 12.5, color: "#4ade80", marginBottom: 8 }}>{copyMsg}</div>}
          <div style={{ background: "#132E22", border: "1px solid #2E5644", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#6C7065", fontFamily: "monospace", lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto" }}>
            {inviteEmail}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyInvite} style={{ flex: 1, padding: "9px", background: "#E0784E", color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Copy Email
            </button>
            <button onClick={emailInvite} style={{ flex: 1, padding: "9px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, color: "#9FB8A9", fontSize: 12.5, cursor: "pointer" }}>
              Open in Mail
            </button>
          </div>
        </div>

        {/* Change passcode */}
        <div style={{ borderTop: "1px solid #2E5644", paddingTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "#6C7065", marginBottom: 12 }}>Access Code</div>
          <p style={{ fontSize: 12.5, color: "#6C7065", lineHeight: 1.6, marginBottom: 12 }}>
            Changing the access code locks out anyone with the old code. Share the new code with current team members.
          </p>
          {passcodeMsg && <div style={{ fontSize: 12.5, color: "#4ade80", marginBottom: 10 }}>{passcodeMsg}</div>}
          {changingPasscode ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="New access code"
                type="password"
                style={{ flex: 1, padding: "8px 10px", background: "#132E22", border: "1px solid #2E5644", borderRadius: 10, color: "#F7F5EF", fontSize: 13, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={handlePasscodeChange} style={{ padding: "8px 12px", background: "#E0784E", color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Save</button>
              <button onClick={() => setChangingPasscode(false)} style={{ padding: "8px 10px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, color: "#6C7065", fontSize: 12.5, cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setChangingPasscode(true)} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, color: "#9FB8A9", fontSize: 13, cursor: "pointer" }}>
              Change Access Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Sidebar({ events, currentEventId, onSelect, onCreate, onDelete, onClone, onHome, saveStatus, teamMember, orgData, onChangeName, onManageVenues, isOpen, onClose, memberRecord, onOpenTeam, onOpenTrash }) {
  const [confirmDeleteId, setConfirmDeleteId] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const visibleEvents = search.trim()
    ? events.filter((e) => (e.name || "").toLowerCase().includes(search.trim().toLowerCase()))
    : events;
  return (
    <aside style={styles.sidebar} className={`etf-sidebar${isOpen ? " open" : ""}`}>
      <div style={styles.brand} onClick={onHome}>
        {orgData?.logoUrl ? (
          <img src={orgData.logoUrl} alt={orgData.name} style={{ height: 36, width: 36, objectFit: "contain", borderRadius: 10, background: "#fff", padding: 2 }} onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <div style={styles.brandMark}>EFP</div>
        )}
        <div>
          <div style={styles.brandTitle}>{orgData?.name || "Event Fund Playbook"}</div>
          <div style={styles.brandSub}>{orgData?.city ? `${orgData.city}, ${orgData.state || "TX"}` : "Texas Events Trust Fund"}</div>
        </div>
      </div>

      <button style={styles.newBtn} onClick={onCreate}>
        <Plus size={14} /> New Event
      </button>

      <div style={styles.sidebarLabel}>
        <span>Team Pipeline</span>
        <span style={styles.count}>{events.length}</span>
      </div>

      {events.length > 7 && (
        <div style={{ padding: "0 20px 8px" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            style={{ width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#F7F5EF", fontSize: 12.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>
      )}

      <div style={{ ...styles.eventList, overflowY: "auto", flex: 1 }}>
        {events.length === 0 && (
          <div style={styles.emptyList}>
            No events yet. Click <em>New Event</em> to begin an analysis.
          </div>
        )}
        {events.length > 0 && visibleEvents.length === 0 && (
          <div style={styles.emptyList}>No events match “{search}”.</div>
        )}
        {visibleEvents.map((e) => (
          <div
            key={e.id}
            style={{
              ...styles.eventItem,
              ...(e.id === currentEventId ? styles.eventItemActive : {}),
            }}
            onClick={() => onSelect(e.id)}
          >
            <div style={styles.eventItemName}>{e.name || "Untitled event"}</div>
            <div style={styles.eventItemMeta}>
              {e.firstDay ? fmtDate(e.firstDay) : "No date"} · <StatusPill status={e.status} />
            </div>
            {e.createdBy && (
              <div style={{ fontSize: 10.5, color: "#979A8D", marginTop: 2 }}>
                Added by {e.createdBy}
              </div>
            )}
            {confirmDeleteId === e.id ? (
              <div style={{ display: "flex", gap: 4, marginTop: 6 }} onClick={(ev) => ev.stopPropagation()}>
                <button
                  onClick={() => { onDelete(e.id); setConfirmDeleteId(null); }}
                  style={{ flex: 1, padding: "4px 0", background: "#dc2626", color: "#fff", border: "none", borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  style={{ flex: 1, padding: "4px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 3, fontSize: 11, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  style={{ ...styles.deleteBtn, right: 26 }}
                  onClick={(ev) => { ev.stopPropagation(); onClone(e.id); }}
                  aria-label="Duplicate for next year"
                  title="Duplicate for next year"
                >
                  <Plus size={12} />
                </button>
                <button
                  style={styles.deleteBtn}
                  onClick={(ev) => { ev.stopPropagation(); setConfirmDeleteId(e.id); }}
                  aria-label="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={styles.sidebarFooter}>
        <div style={{ marginBottom: 6, fontSize: 12, color: "#6C7065" }}>
          {saveStatus === "saving" && <span style={{ color: "#E0784E" }}>⟳ Saving…</span>}
          {saveStatus === "saved"  && <span style={{ color: "#059669" }}>✓ Saved</span>}
          {saveStatus === "error"  && <span style={{ color: "#dc2626" }}>✗ Save failed — check your connection</span>}
          {!saveStatus && <span style={{ color: "#059669" }}>● Shared team database</span>}
        </div>

        {/* Name + admin badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          {teamMember && <span style={{ color: "#F7F5EF", fontWeight: 600, fontSize: 13 }}>{teamMember}</span>}
          {memberRecord?.is_admin && (
            <span style={{ fontSize: 10, fontWeight: 700, background: "#E0784E", color: "#fff", borderRadius: 3, padding: "1px 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Admin
            </span>
          )}
        </div>
        {typeof window !== "undefined" && localStorage.getItem("etf_team_title") && (
          <div style={{ color: "#979A8D", fontSize: 11, marginBottom: 8 }}>
            {localStorage.getItem("etf_team_title")}
          </div>
        )}

        {/* Admin team management button — prominent */}
        {memberRecord?.is_admin && (
          <button
            onClick={onOpenTeam}
            style={{ width: "100%", padding: "8px 12px", background: "#1E4536", color: "#E0784E", border: "1px solid #E0784E33", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginBottom: 8, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>⚙</span> Manage Team & Access
          </button>
        )}

        {/* Links row */}
        <div style={{ display: "flex", gap: 10, fontSize: 11, flexWrap: "wrap" }}>
          <button onClick={onManageVenues} style={{ fontSize: 11, color: "#979A8D", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            Org settings
          </button>
          <span style={{ color: "#2E5644" }}>·</span>
          <button onClick={onOpenTrash} style={{ fontSize: 11, color: "#979A8D", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            Trash
          </button>
          <span style={{ color: "#2E5644" }}>·</span>
          <button
            onClick={() => {
              localStorage.removeItem("etf_authed");
              // Keep etf_team_member so returning user sees "Welcome back"
              localStorage.removeItem("etf_member_id");
              window.location.reload();
            }}
            style={{ fontSize: 11, color: "#979A8D", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
          >
            Sign out
          </button>
          <span style={{ color: "#2E5644" }}>·</span>
          <FeedbackButton orgData={orgData} teamMember={teamMember} />
        </div>
      </div>
    </aside>
  );
}

// ————————————————————————————————————————————————————————————————
// ActivityHistoryModal — who changed what on an event, and when
// ————————————————————————————————————————————————————————————————
function ActivityHistoryModal({ event, orgData, onClose }) {
  const [rows, setRows] = useState(null); // null = loading

  useEffect(() => {
    api.getActivity(event.id, orgData?.id || "").then(setRows).catch(() => setRows([]));
  }, [event.id, orgData?.id]);

  const relative = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, maxWidth: 480, width: "100%", maxHeight: "75vh", overflowY: "auto", color: "#1E4536" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 600 }}>History</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#979A8D" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#6C7065", marginBottom: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {event.name || "Untitled event"}
        </div>

        {rows === null ? (
          <div style={{ padding: 24, textAlign: "center", color: "#979A8D", fontSize: 13, fontStyle: "italic" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#979A8D", fontSize: 13 }}>
            No history recorded yet — changes made from now on will show up here.
          </div>
        ) : (
          rows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < rows.length - 1 ? "1px solid #F1EFE6" : "none", fontSize: 13 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: "#FBE4D8", color: "#B04E31", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {(row.member_name || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{row.member_name}</span>{" "}
                <span style={{ color: "#6C7065" }}>{row.summary}</span>
                <div style={{ fontSize: 11.5, color: "#979A8D", marginTop: 1 }}>{relative(row.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// TrashPanel — deleted events, restorable for 30 days
// ————————————————————————————————————————————————————————————————
function TrashPanel({ orgId, onClose, onRestored }) {
  const [items, setItems] = useState(null); // null = loading
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    api.getDeletedEvents(orgId).then(setItems).catch(() => setItems([]));
  }, [orgId]);

  const restore = async (item) => {
    setRestoring(item.id);
    try {
      await api.restoreEvent(item.id, orgId);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onRestored(item);
    } catch (_) {}
    setRestoring(null);
  };

  const daysLeft = (deletedAt) => {
    if (!deletedAt) return 30;
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86400000;
    return Math.max(0, Math.ceil(30 - elapsed));
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto", color: "#1E4536" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 600 }}>Trash</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#979A8D" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#6C7065", marginBottom: 18 }}>
          Deleted events stay here for 30 days, then they're gone for good.
        </div>

        {items === null ? (
          <div style={{ padding: 24, textAlign: "center", color: "#979A8D", fontSize: 13, fontStyle: "italic" }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#979A8D", fontSize: 13 }}>Trash is empty.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#F1EFE6", border: "1px solid #DFDDD0", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name || "Untitled event"}
                </div>
                <div style={{ fontSize: 11.5, color: "#979A8D" }}>
                  {item.firstDay ? fmtDate(item.firstDay) + " · " : ""}{daysLeft(item.deletedAt)} days until permanent deletion
                </div>
              </div>
              <button
                onClick={() => restore(item)}
                disabled={restoring === item.id}
                style={{ padding: "7px 14px", background: "#1E4536", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              >
                {restoring === item.id ? "Restoring…" : "Restore"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Feedback button + modal — files issues straight into the repo's
// GitHub queue when configured, otherwise just stores them.
// ————————————————————————————————————————————————————————————————
function FeedbackButton({ orgData, teamMember }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(""); // "" | sending | sent | error

  const submit = async () => {
    if (message.trim().length < 5) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          category,
          orgId: orgData?.id || "",
          orgName: orgData?.name || "",
          memberName: teamMember || "",
          page: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setMessage("");
      setTimeout(() => { setOpen(false); setStatus(""); }, 2000);
    } catch (_) {
      setStatus("error");
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ fontSize: 11, color: "#979A8D", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
      >
        Report an issue
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, maxWidth: 440, width: "100%", color: "#1E4536" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 600 }}>Report an issue</div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#979A8D" }}>✕</button>
            </div>
            <div style={{ fontSize: 12.5, color: "#6C7065", marginBottom: 16 }}>
              Something broken, confusing, or missing? It goes straight to the development queue.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[["bug", "🐛 Something's broken"], ["idea", "💡 Idea / request"]].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${category === key ? "#E0784E" : "#DFDDD0"}`, background: category === key ? "#FBE4D8" : "#fff", color: category === key ? "#B04E31" : "#6C7065" }}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={category === "bug" ? "What happened? What did you expect to happen?" : "What would make this tool more useful?"}
              rows={5}
              autoFocus
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", marginBottom: 14 }}
            />
            {status === "error" && (
              <div style={{ fontSize: 12.5, color: "#dc2626", marginBottom: 10 }}>Couldn't send — check your connection and try again.</div>
            )}
            <button
              onClick={submit}
              disabled={status === "sending" || status === "sent" || message.trim().length < 5}
              style={{ width: "100%", padding: "11px", background: status === "sent" ? "#059669" : "#E0784E", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: status === "sending" ? 0.7 : 1 }}
            >
              {status === "sent" ? "✓ Sent — thank you!" : status === "sending" ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function StatusPill({ status }) {
  const colors = {
    analysis: { bg: "#FBE4D8", fg: "#B04E31", label: "Analysis" },
    application: { bg: "#dbeafe", fg: "#1e40af", label: "Application" },
    approved: { bg: "#d1fae5", fg: "#065f46", label: "Approved" },
    "post-event": { bg: "#ede9fe", fg: "#5b21b6", label: "Post-Event" },
    complete: { bg: "#e5e7eb", fg: "#374151", label: "Complete" },
  };
  const c = colors[status] || colors.analysis;
  return <span style={{ ...styles.pill, background: c.bg, color: c.fg }}>{c.label}</span>;
}

// ————————————————————————————————————————————————————————————————
// EmailCaptureBanner — one-time prompt for signed-in members who
// don't have an email on file yet (they may not see the login screen
// again for months, so we ask here too).
// ————————————————————————————————————————————————————————————————
function EmailCaptureBanner({ orgData, teamMember }) {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined" && (
      !!localStorage.getItem("etf_member_email") ||
      !!localStorage.getItem("etf_email_prompt_dismissed")
    )
  );
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(""); // "" | saving | saved | error

  if (dismissed || orgData?.demo) return null;

  const save = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) { setStatus("error"); return; }
    setStatus("saving");
    try {
      const memberId = localStorage.getItem("etf_member_id");
      if (memberId && orgData?.id) {
        const res = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: memberId, orgId: orgData.id, name: teamMember || "Unknown", email: clean }),
        });
        if (!res.ok) throw new Error();
      }
      localStorage.setItem("etf_member_email", clean);
      setStatus("saved");
      setTimeout(() => setDismissed(true), 1500);
    } catch (_) {
      setStatus("error");
    }
  };

  return (
    <section style={{ background: "#FBE4D8", border: "1px solid #E0784E55", borderRadius: 14, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#B04E31", marginBottom: 2 }}>Get deadline reminders by email</div>
        <div style={{ fontSize: 12.5, color: "#6C7065" }}>Add your work email to receive weekly deadline alerts and monthly pipeline updates.</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 300px" }}>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus(""); }}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="you@yourorg.com"
          style={{ flex: 1, padding: "9px 12px", border: `1px solid ${status === "error" ? "#dc2626" : "#DFDDD0"}`, borderRadius: 10, fontSize: 13.5, outline: "none", fontFamily: "inherit", background: "#fff" }}
        />
        <button
          onClick={save}
          disabled={status === "saving" || status === "saved"}
          style={{ padding: "9px 16px", background: status === "saved" ? "#059669" : "#E0784E", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {status === "saved" ? "✓ Saved" : status === "saving" ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => { localStorage.setItem("etf_email_prompt_dismissed", "1"); setDismissed(true); }}
          title="Don't ask again"
          style={{ background: "none", border: "none", color: "#979A8D", fontSize: 16, cursor: "pointer", padding: 4 }}
        >
          ✕
        </button>
      </div>
    </section>
  );
}

// ————————————————————————————————————————————————————————————————
// Dashboard (no event selected)
// ————————————————————————————————————————————————————————————————
function Dashboard({ events, onOpen, onCreate, teamMember, orgData, onEventCreated }) {
  const [intakeItems, setIntakeItems] = useState([]);
  const [intakeLoading, setIntakeLoading] = useState(true);
  const [promoting, setPromoting] = useState(null);
  const [confirmDismissId, setConfirmDismissId] = useState(null);

  const stats = useMemo(() => {
    let projected = 0;
    let active = 0;
    let awarded = 0;
    let disbursed = 0;
    events.forEach((e) => {
      const calc = calculateTrustFund(e);
      const est = calc.totalFund > 0 ? calc.totalFund : calc.quickEstimate;
      projected += est;
      if (e.status !== "complete") active++;
      awarded += Number(e.outcome?.awardedAmount) || 0;
      disbursed += Number(e.outcome?.disbursedAmount) || 0;
    });
    return { projected, active, total: events.length, awarded, disbursed };
  }, [events]);

  // Every upcoming deadline across all events, computed from the TIMELINE
  // offsets. Includes recently-missed ones (last 7 days) so they don't
  // silently disappear.
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 7 * 86400000);
    const windowEnd = new Date(now.getTime() + 180 * 86400000);
    const list = [];
    events.forEach((e) => {
      if (!e.firstDay || e.status === "complete") return;
      TIMELINE.forEach((t) => {
        if (t.key === "eventStart") return;
        const due = addDays(t.offset < 0 ? e.firstDay : (e.lastDay || e.firstDay), t.offset);
        if (!due || due < windowStart || due > windowEnd) return;
        const daysAway = Math.ceil((due - now) / 86400000);
        list.push({ eventId: e.id, eventName: e.name || "Untitled event", label: t.label, critical: t.critical, due, daysAway });
      });
    });
    return list.sort((a, b) => a.due - b.due).slice(0, 10);
  }, [events]);

  // Fiscal-year rollup based on the org's fiscal year start month
  const fyStats = useMemo(() => {
    const fyStart = Number(orgData?.fiscalYearStart) || 10;
    const now = new Date();
    const fyStartYear = now.getMonth() + 1 >= fyStart ? now.getFullYear() : now.getFullYear() - 1;
    const fyBegin = new Date(fyStartYear, fyStart - 1, 1);
    const fyEnd = new Date(fyStartYear + 1, fyStart - 1, 1);
    let count = 0, value = 0, match = 0;
    events.forEach((e) => {
      if (!e.firstDay) return;
      const d = new Date(e.firstDay + "T12:00:00");
      if (d < fyBegin || d >= fyEnd) return;
      const calc = calculateTrustFund(e);
      count++;
      value += calc.totalFund > 0 ? calc.totalFund : calc.quickEstimate;
      match += calc.requiredLocalMatch || 0;
    });
    const fyLabel = `FY${String(fyStartYear + 1).slice(2)}`;
    return { count, value, match, fyLabel };
  }, [events, orgData]);

  // Onboarding steps for fresh orgs
  const onboarding = useMemo(() => {
    const steps = [
      { label: "Add your venues in Organization Settings", done: (orgData?.venues || []).length > 0 },
      { label: "Fill out the ETF Application Profile (contact info, address, EIN)", done: !!(orgData?.contactName && orgData?.address) },
      { label: "Create your first event analysis", done: events.length > 0 },
    ];
    return { steps, complete: steps.every((s) => s.done) };
  }, [events, orgData]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/intake?status=pending&org_id=${orgData?.id || ""}`);
        const data = await res.json();
        setIntakeItems(Array.isArray(data) ? data : []);
      } catch (_) { setIntakeItems([]); }
      setIntakeLoading(false);
    })();
  }, []);

  const handlePromote = async (item) => {
    setPromoting(item.id);
    try {
      const res = await fetch("/api/intake", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "promote", reviewedBy: teamMember, orgId: orgData?.id }),
      });
      const data = await res.json();
      setIntakeItems((prev) => prev.filter((i) => i.id !== item.id));
      if (onEventCreated) {
        // Create event locally with blankEvent base so all fields exist
        const newEvent = {
          ...blankEvent(),
          name: item.eventName || "Untitled Event",
          status: "analysis",
          firstDay: item.firstDay || "",
          lastDay: item.lastDay || "",
          siteSelectionOrg: item.siteSelectionOrg || "",
          roomNights: parseInt((item.roomNightsNeeded || "0").replace(/[^0-9]/g, "")) || 0,
          outOfMarketPct: parseInt((item.outOfMarketPct || "50").replace(/[^0-9]/g, "")) || 50,
          attendeeEst: parseInt((item.totalAttendance || "0").replace(/[^0-9]/g, "")) || 0,
          notes: [item.notes, `Submitted by ${item.contactName} (${item.contactEmail})`].filter(Boolean).join("\n\n"),
          intakeId: item.id,
          elig: {
            competitiveBid: item.elig?.competitive ?? null,
            siteSelectionLetter: null,
            annualOrOnce: item.elig?.annual ?? null,
            soleSiteOrRegional: item.elig?.solesite ?? null,
            notHeldElsewhere: item.elig?.notelsewhere ?? null,
          },
          createdBy: `Intake: ${item.contactName || "Unknown"}`,
        };
        onEventCreated(newEvent);
      }
    } catch (e) {
      console.error("Promote error:", e);
    }
    setPromoting(null);
  };

  const handleDismiss = async (item) => {
    try {
      await fetch("/api/intake", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "dismiss", reviewedBy: teamMember }),
      });
      setIntakeItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (_) {}
    setConfirmDismissId(null);
  };

  const intakeUrl = typeof window !== "undefined" ? `${window.location.origin}/intake?org=${orgData?.id || ""}` : "/intake";

  return (
    <div style={styles.dashboard}>
      <header style={styles.dashHeader}>
        <div>
          <div style={styles.eyebrow}>Texas Events Trust Fund · Independent Planning Tool</div>
          <h1 style={styles.h1}>
            Built for the teams pursuing the <em>Texas Events Trust Fund.</em>
          </h1>
          <p style={styles.lede}>
            Analyze prospective events against ETF eligibility requirements,
            project state and local tax contributions, generate your complete deadline
            timeline, and track every required document from application through disbursement.
          </p>
          <div style={{
            marginTop: 14,
            padding: "10px 16px",
            background: "#FBE4D8",
            border: "1px solid #fcd34d",
            borderLeft: "3px solid #E0784E",
            borderRadius: 3,
            fontSize: 12.5,
            color: "#78350f",
            lineHeight: 1.6,
          }}>
            <strong>⚠ Planning tool only.</strong> This tool is NOT affiliated with the Texas Office of the Governor or the Economic Development and Tourism division (EDT). It does not submit applications or constitute official program participation. All official submissions must be made directly to EDT at <strong>eventsfund@gov.texas.gov</strong> using the official state templates.
          </div>
          <div style={{ marginTop: 10, padding: "10px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderLeft: "3px solid #059669", borderRadius: 3, fontSize: 12.5, color: "#065f46" }}>
            <strong>● Shared team database</strong> — all events are visible to your whole team. Viewing as <strong>{teamMember}</strong>.
          </div>
        </div>
      </header>

      <EmailCaptureBanner orgData={orgData} teamMember={teamMember} />

      {!onboarding.complete && (
        <section style={{ background: "#fff", border: "1px solid #DFDDD0", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Get set up</div>
          <div style={{ fontSize: 12.5, color: "#6C7065", marginBottom: 14 }}>Three quick steps so every analysis and application packet is pre-filled and ready.</div>
          {onboarding.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 13.5 }}>
              <span style={{ width: 20, height: 20, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: s.done ? "#059669" : "#F7F5EF", color: s.done ? "#fff" : "#979A8D", border: s.done ? "none" : "1px solid #DFDDD0" }}>
                {s.done ? "✓" : i + 1}
              </span>
              <span style={{ color: s.done ? "#979A8D" : "#1E4536", textDecoration: s.done ? "line-through" : "none" }}>{s.label}</span>
            </div>
          ))}
        </section>
      )}

      {events.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            onClick={() => {
              const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
              const rows = [[
                "Event", "Status", "First Day", "Last Day", "Venues", "Site Selection Org",
                "Est. Attendance", "Est. Room Nights", "Projected State Share",
                "Required Local Match", "Projected Fund Value",
                "Awarded", "Disbursed", "Actual Attendance", "Created By",
              ]];
              events.forEach((e) => {
                const c = calculateTrustFund(e);
                rows.push([
                  e.name || "Untitled", e.status || "", e.firstDay || "", e.lastDay || "",
                  Array.isArray(e.venues) ? e.venues.join("; ") : (e.venue || ""),
                  e.siteSelectionOrg || "",
                  Math.round(c.totalAttendance || e.attendeeEst || 0),
                  Math.round(c.totalRoomNights || e.roomNights || 0),
                  Math.round(c.stateTaxTotal || 0),
                  Math.round(c.requiredLocalMatch || 0),
                  Math.round(c.totalFund > 0 ? c.totalFund : c.quickEstimate),
                  e.outcome?.awardedAmount || "", e.outcome?.disbursedAmount || "",
                  e.outcome?.actualAttendance || "", e.createdBy || "",
                ]);
              });
              const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
              const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = `${(orgData?.name || "ETF").replace(/[^a-z0-9]/gi, "-")}-Pipeline-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "transparent", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: "#6C7065", cursor: "pointer" }}
          >
            <Download size={13} /> Export Pipeline CSV
          </button>
        </div>
      )}

      <div style={styles.statGrid} className="etf-stats-row">
        <StatCard label="Active Events" value={stats.active} icon={<Target size={16} />} />
        <StatCard label="Total in Pipeline" value={stats.total} icon={<Folder size={16} />} />
        <StatCard label="Projected Fund Value" value={fmtMoney(stats.projected)} icon={<DollarSign size={16} />} />
        {stats.awarded > 0 && (
          <StatCard label="Awarded to Date" value={fmtMoney(stats.awarded)} icon={<CheckCircle2 size={16} />} />
        )}
      </div>

      {/* Fiscal year summary */}
      {fyStats.count > 0 && (
        <section style={{ background: "#1E4536", borderRadius: 14, padding: "18px 24px", marginBottom: 24, display: "flex", gap: 36, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 600, color: "#E0784E" }}>{fyStats.fyLabel} Outlook</div>
          <div><span style={{ fontSize: 20, fontWeight: 700, color: "#F7F5EF", fontFamily: "'Fraunces', Georgia, serif" }}>{fyStats.count}</span> <span style={{ fontSize: 12, color: "#9FB8A9" }}>event{fyStats.count === 1 ? "" : "s"}</span></div>
          <div><span style={{ fontSize: 20, fontWeight: 700, color: "#F7F5EF", fontFamily: "'Fraunces', Georgia, serif" }}>{fmtMoney(fyStats.value)}</span> <span style={{ fontSize: 12, color: "#9FB8A9" }}>projected ETF value</span></div>
          <div><span style={{ fontSize: 20, fontWeight: 700, color: "#F7F5EF", fontFamily: "'Fraunces', Georgia, serif" }}>{fmtMoney(fyStats.match)}</span> <span style={{ fontSize: 12, color: "#9FB8A9" }}>local match required</span></div>
        </section>
      )}

      {/* Upcoming deadlines across all events */}
      {upcomingDeadlines.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid #DFDDD0", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Upcoming Deadlines</div>
          <div style={{ fontSize: 12.5, color: "#6C7065", marginBottom: 14 }}>Every statutory deadline across your pipeline, soonest first.</div>
          {upcomingDeadlines.map((d, i) => {
            const overdue = d.daysAway < 0;
            const urgent = d.daysAway >= 0 && d.daysAway <= 14;
            return (
              <div key={i} onClick={() => onOpen(d.eventId)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", marginBottom: 4, background: overdue ? "#fef2f2" : urgent ? "#FBE4D8" : "#F1EFE6", border: `1px solid ${overdue ? "#fecaca" : urgent ? "#f5cbaa" : "#DFDDD0"}`, borderRadius: 10, cursor: "pointer", fontSize: 13 }}>
                <span style={{ fontWeight: 700, minWidth: 86, color: overdue ? "#dc2626" : urgent ? "#B04E31" : "#6C7065", fontSize: 12 }}>
                  {overdue ? `${Math.abs(d.daysAway)}d overdue` : d.daysAway === 0 ? "Due today" : `in ${d.daysAway}d`}
                </span>
                <span style={{ flex: 1 }}>
                  <strong>{d.label}</strong>
                  <span style={{ color: "#6C7065" }}> — {d.eventName}</span>
                </span>
                <span style={{ color: "#979A8D", fontSize: 12 }}>{fmtDate(d.due)}</span>
                {d.critical && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: ".05em" }}>Statutory</span>}
              </div>
            );
          })}
        </section>
      )}

      {/* Intake — moved to top, most important action */}
      <section style={{ marginBottom: 40 }}>
        {/* Share card */}
        <div style={{ background: "#1E4536", borderRadius: 14, padding: "24px 28px", marginBottom: 20, display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
          {/* QR Code */}
          <div style={{ flexShrink: 0 }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(intakeUrl)}&bgcolor=1E4536&color=F7F5EF&margin=8`}
              alt="QR code for intake form"
              width={120}
              height={120}
              style={{ borderRadius: 12, display: "block" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", color: "#E0784E", marginBottom: 6 }}>
              Event Organizer Intake Form
            </div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 600, color: "#F7F5EF", marginBottom: 8 }}>
              Share with event organizers
            </div>
            <div style={{ fontSize: 13.5, color: "#9FB8A9", lineHeight: 1.6, marginBottom: 16 }}>
              Organizers scan the QR code or visit the link to submit their event details. Submissions land directly in your pipeline for review — no manual data entry needed.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => { navigator.clipboard?.writeText(intakeUrl); }}
                style={{ padding: "9px 18px", background: "#E0784E", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
              >
                Copy Link
              </button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent("Submit Your Event — ETF Analysis");
                  const body = encodeURIComponent(`Hi,\n\nWe'd love to evaluate your event for Texas Events Trust Fund eligibility. Please complete our quick intake form:\n\n${intakeUrl}\n\nIt takes about 5 minutes and helps us determine if your event qualifies for funding support.\n\nLet us know if you have any questions!`);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}
                style={{ padding: "9px 18px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, fontSize: 13.5, color: "#9FB8A9", cursor: "pointer" }}
              >
                Email to Organizer
              </button>
              <a
                href={intakeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "9px 18px", background: "transparent", border: "1px solid #2E5644", borderRadius: 10, fontSize: 13.5, color: "#9FB8A9", textDecoration: "none", display: "inline-block" }}
              >
                Preview Form ↗
              </a>
            </div>
          </div>
        </div>

        {/* Pending submissions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ ...styles.h2, margin: 0 }}>
            Pending Submissions
            {intakeItems.length > 0 && (
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, background: "#dc2626", color: "#fff", borderRadius: 10, padding: "2px 8px" }}>
                {intakeItems.length} new
              </span>
            )}
          </h2>
        </div>

        {intakeLoading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#979A8D", fontSize: 13 }}>Loading…</div>
        ) : intakeItems.length === 0 ? (
          <div style={{ padding: "20px 24px", background: "#F1EFE6", border: "1px dashed #DFDDD0", borderRadius: 10, textAlign: "center", fontSize: 13.5, color: "#979A8D" }}>
            No pending submissions. Share the intake link with event organizers to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {intakeItems.map((item) => {
              const eligPassed = item.elig
                ? Object.values(item.elig).filter((v) => v === true).length
                : 0;
              const eligTotal = ELIG_KEYS.length;
              return (
                <div key={item.id} style={{ background: "#fff", border: "1px solid #DFDDD0", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1E4536", marginBottom: 4 }}>{item.eventName || "Untitled Event"}</div>
                    <div style={{ fontSize: 12.5, color: "#6C7065", marginBottom: 8 }}>
                      {item.orgName} · {item.contactName} · <a href={`mailto:${item.contactEmail}`} style={{ color: "#6C7065" }}>{item.contactEmail}</a>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
                      {item.firstDay && <span style={{ padding: "2px 8px", background: "#f3f4f6", borderRadius: 10, color: "#374151" }}>📅 {item.firstDay}{item.lastDay ? ` → ${item.lastDay}` : ""}</span>}
                      {item.totalAttendance && <span style={{ padding: "2px 8px", background: "#f3f4f6", borderRadius: 10, color: "#374151" }}>👥 {item.totalAttendance} attendees</span>}
                      {item.roomNightsNeeded && <span style={{ padding: "2px 8px", background: "#f3f4f6", borderRadius: 10, color: "#374151" }}>🏨 {item.roomNightsNeeded} room nights</span>}
                      {item.elig && <span style={{ padding: "2px 8px", background: eligPassed >= 3 ? "#d1fae5" : "#FBE4D8", borderRadius: 10, color: eligPassed >= 3 ? "#065f46" : "#B04E31" }}>Eligibility: {eligPassed}/{eligTotal}</span>}
                    </div>
                    {item.notes && <div style={{ fontSize: 12.5, color: "#6C7065", marginTop: 8, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{item.notes}"</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handlePromote(item)}
                      disabled={promoting === item.id}
                      style={{ padding: "8px 16px", background: "#1E4536", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {promoting === item.id ? "Adding…" : "→ Add to Pipeline"}
                    </button>
                    {confirmDismissId === item.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button
                          onClick={() => handleDismiss(item)}
                          style={{ padding: "6px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Confirm dismiss
                        </button>
                        <button
                          onClick={() => setConfirmDismissId(null)}
                          style={{ padding: "6px 12px", background: "transparent", color: "#979A8D", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 12, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDismissId(item.id)}
                        style={{ padding: "8px 16px", background: "transparent", color: "#979A8D", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.quickStart}>
        <h2 style={styles.h2}>How this works</h2>
        <div style={styles.flowGrid}>
          {[
            { n: "01", t: "Capture the Event", d: "Enter event details, dates, and the site selection organization's pitch." },
            { n: "02", t: "Run the Decision Framework", d: "Answer five eligibility questions from § 480.0051. Weigh results against financial thresholds to decide whether to pursue." },
            { n: "03", t: "Model Economic Impact", d: "Build out attendee days by category. The engine computes state/local tax generation and the required local match." },
            { n: "04", t: "Work the Timeline", d: "Every deadline — application, support contract, attendance certification, local share, disbursement — auto-calculated from your event date." },
            { n: "05", t: "Check Documents", d: "Track the seven application docs plus post-event deliverables. Never miss a submission." },
            { n: "06", t: "Reference Rules", d: "Allowable and unallowable costs, statute text, and FAQ are one click away." },
          ].map((step, i) => (
            <div key={i} style={styles.flowCard}>
              <div style={styles.flowNum}>{step.n}</div>
              <div style={styles.flowTitle}>{step.t}</div>
              <div style={styles.flowDesc}>{step.d}</div>
            </div>
          ))}
        </div>
      </section>

      {events.length > 0 && (
        <section style={styles.recentSection}>
          <h2 style={styles.h2}>Your Events</h2>
          <div style={styles.recentList}>
            {events.map((e) => {
              const calc = calculateTrustFund(e);
              const est = calc.totalFund > 0 ? calc.totalFund : calc.quickEstimate;
              return (
                <div key={e.id} style={styles.recentCard} onClick={() => onOpen(e.id)}>
                  <div>
                    <div style={styles.recentName}>{e.name || "Untitled"}</div>
                    <div style={styles.recentMeta}>
                      {e.firstDay ? fmtDate(e.firstDay) : "No date set"}
                      {(e.venues && e.venues.length > 0)
                        ? ` · ${e.venues.join(", ")}`
                        : (e.venue && ` · ${e.venue}`)}
                    </div>
                  </div>
                  <div style={styles.recentStats}>
                    <div style={styles.recentStat}>
                      <div style={styles.recentStatLabel}>Projected</div>
                      <div style={styles.recentStatValue}>{fmtMoney(est)}</div>
                    </div>
                    <StatusPill status={e.status} />
                    <ChevronRight size={16} color="#999" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div style={styles.ctaRow}>
        <button style={styles.ctaPrimary} onClick={onCreate}>
          <Plus size={16} /> Start a new event analysis
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <div>
        <div style={styles.statLabel}>{label}</div>
        <div style={styles.statValue}>{value}</div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Event View — tabs
// ————————————————————————————————————————————————————————————————
function EventView({ event, update, tab, setTab, orgVenues, orgData }) {
  const calc = useMemo(() => calculateTrustFund(event), [event]);
  const thresholds = useMemo(() => ({
    min: orgData?.thresholdMin ?? 75000,
    strong: orgData?.thresholdStrong ?? 150000,
    strategic: orgData?.thresholdStrategic ?? 300000,
  }), [orgData]);
  const decision = useMemo(() => evaluateDecision(event, calc, thresholds), [event, calc, thresholds]);
  const [shareCopied, setShareCopied] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Presence heartbeat: tell the server we're viewing this event and
  // learn who else has it open right now
  useEffect(() => {
    if (!event?.id || orgData?.demo) return;
    let cancelled = false;
    const beat = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            memberId: localStorage.getItem("etf_member_id") || "anon",
            memberName: localStorage.getItem("etf_team_member") || "Someone",
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setViewers(Array.isArray(data.others) ? data.others : []);
        }
      } catch (_) {}
    };
    beat();
    const interval = setInterval(beat, 30000);
    return () => { cancelled = true; clearInterval(interval); setViewers([]); };
  }, [event?.id]);

  // Copy a public read-only link, minting the token on first use
  const handleShare = async () => {
    if (orgData?.demo) {
      alert("Sharing is disabled in the demo. Create your organization to share real analyses.");
      return;
    }
    let token = event.shareToken;
    if (!token) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      update((e) => ({ ...e, shareToken: token }));
    }
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (_) {
      window.prompt("Copy this read-only link:", url);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const exportPDF = () => {
    const deadlines = event.firstDay ? TIMELINE.map(item => ({
      label: item.label,
      date: (() => { const d = addDays(event.firstDay, item.offset); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; })(),
    })) : [];
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${event.name || "Event Analysis"} — ETF Analysis</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; color: #1E4536; background: #fff; padding: 48px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #1E4536; }
  .header-left h1 { font-family: 'Fraunces', Georgia, serif; font-size: 28px; font-weight: 600; margin-bottom: 4px; }
  .header-left p { font-size: 13px; color: #6C7065; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  .badge-pursue { background: #d1fae5; color: #065f46; }
  .badge-conditional { background: #FBE4D8; color: #B04E31; }
  .badge-strong { background: #dbeafe; color: #1e40af; }
  .badge-strategic { background: #ede9fe; color: #5b21b6; }
  .badge-no { background: #fee2e2; color: #991b1b; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: #979A8D; margin-bottom: 12px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .stat-box { background: #F1EFE6; border: 1px solid #DFDDD0; border-radius: 4px; padding: 14px 16px; }
  .stat-label { font-size: 11px; color: #979A8D; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
  .stat-value { font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 600; }
  .stat-value.gold { color: #B04E31; }
  .elig-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; }
  .elig-row:last-child { border-bottom: none; }
  .pass { color: #059669; font-weight: 600; }
  .fail { color: #dc2626; font-weight: 600; }
  .na { color: #979A8D; }
  .deadline-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; }
  .deadline-row:last-child { border-bottom: none; }
  .deadline-date { font-weight: 600; color: #374151; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #DFDDD0; display: flex; justify-content: space-between; font-size: 11px; color: #979A8D; }
  @media print { body { padding: 32px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${event.name || "Untitled Event"}</h1>
      <p>${event.firstDay ? `${event.firstDay}${event.lastDay ? ' → ' + event.lastDay : ''}` : 'Dates not set'}${event.siteSelectionOrg ? ' · ' + event.siteSelectionOrg : ''}</p>
    </div>
    <div>
      <div class="badge badge-${decision.recommendation === 'DO NOT PURSUE' ? 'no' : decision.recommendation === 'STRATEGIC PRIORITY' ? 'strategic' : decision.recommendation === 'STRONG TARGET' ? 'strong' : decision.recommendation === 'PURSUE WITH CONDITIONS' ? 'conditional' : 'pursue'}">${decision.recommendation || 'Under Analysis'}</div>
      <p style="font-size:11px;color:#979A8D;margin-top:6px;text-align:right">Generated ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
    </div>
  </div>

  <div class="grid-3 section">
    <div class="stat-box">
      <div class="stat-label">Projected ETF Value</div>
      <div class="stat-value gold">${fmtMoney(decision.estimate)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">State Contribution</div>
      <div class="stat-value">${fmtMoney(calc.stateTaxTotal || 0)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Required Local Match</div>
      <div class="stat-value">${fmtMoney(calc.requiredLocalMatch || 0)}</div>
    </div>
  </div>

  <div class="grid-2 section">
    <div class="stat-box">
      <div class="stat-label">Estimated Room Nights</div>
      <div class="stat-value">${fmtNum(event.roomNights || calc.totalRoomNights || 0)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Out-of-Market Attendance</div>
      <div class="stat-value">${event.outOfMarketPct || 0}%</div>
    </div>
  </div>

  <div class="section" style="background:#F1EFE6;border:1px solid #DFDDD0;border-radius:4px;padding:16px 20px;margin-bottom:28px">
    <div class="section-title">Recommendation</div>
    <div style="margin-bottom:12px">
      <span class="badge badge-${decision.recommendation === 'DO NOT PURSUE' ? 'no' : decision.recommendation === 'STRATEGIC PRIORITY' ? 'strategic' : decision.recommendation === 'STRONG TARGET' ? 'strong' : decision.recommendation === 'PURSUE WITH CONDITIONS' ? 'conditional' : 'pursue'}">${decision.recommendation || 'Under Analysis'}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #DFDDD0;font-size:12.5px"><span>Projected State Share</span><span style="font-weight:600">${fmtMoney(calc.stateTaxTotal || 0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #DFDDD0;font-size:12.5px"><span>Required Local Match</span><span style="font-weight:600">${fmtMoney(calc.requiredLocalMatch || 0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #DFDDD0;font-size:12.5px"><span>Total Fund Value</span><span style="font-weight:700">${fmtMoney(calc.totalFund || 0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px"><span>State:Local Ratio</span><span style="font-weight:600">6.25 : 1</span></div>
  </div>

  <div class="section">
    <div class="section-title">Eligibility Check</div>
    ${[
      ['Competitive site-selection process against out-of-state alternatives', event.elig?.competitiveBid],
      ['Signed selection letter naming this city', event.elig?.siteSelectionLetter],
      ['Event held only once per year', event.elig?.annualOrOnce],
      ['Sole site or sole regional site', event.elig?.soleSiteOrRegional],
      ['Not held elsewhere in Texas or adjoining states same year', event.elig?.notHeldElsewhere],
    ].map(([label, val]) => `
      <div class="elig-row">
        <span>${label}</span>
        <span class="${val === true ? 'pass' : val === false ? 'fail' : 'na'}">${val === true ? '✓ Yes' : val === false ? '✗ No' : '— Not answered'}</span>
      </div>
    `).join('')}
  </div>

  ${deadlines && deadlines.length > 0 ? `
  <div class="section">
    <div class="section-title">Key Deadlines</div>
    ${deadlines.slice(0,6).map(d => `
      <div class="deadline-row">
        <span>${d.label || d.name}</span>
        <span class="deadline-date">${d.date || '—'}</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${decision.issues && decision.issues.length > 0 ? `
  <div class="section">
    <div class="section-title">Issues to Resolve</div>
    ${decision.issues.map(i => `<div style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:12.5px;color:#dc2626">⚠ ${i}</div>`).join('')}
  </div>
  ` : ''}

  ${event.notes ? `
  <div class="section">
    <div class="section-title">Notes</div>
    <p style="font-size:13px;color:#374151;line-height:1.7">${event.notes.replace(/\n/g,'<br>')}</p>
  </div>
  ` : ''}

  <div class="footer">
    <span>Texas Events Trust Fund Analysis Tool · etfplaybook.vercel.app</span>
    <span>Not affiliated with the Texas Office of the Governor or EDT. For internal planning purposes only.</span>
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      // Popup blocked — create a download link instead
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(event.name || 'ETF-Analysis').replace(/[^a-z0-9]/gi, '-')}.html`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  const TABS = [
    { k: "overview", label: "Overview", icon: <Info size={14} /> },
    { k: "decision", label: "Decision Framework", icon: <Scale size={14} /> },
    { k: "calculator", label: "Impact Calculator", icon: <Calculator size={14} /> },
    { k: "timeline", label: "Timeline", icon: <Calendar size={14} /> },
    { k: "documents", label: "Documents", icon: <ClipboardList size={14} /> },
    { k: "costs", label: "Allowable Costs", icon: <DollarSign size={14} /> },
    { k: "apply", label: "Apply to ETF", icon: <ArrowRight size={14} />, highlight: decision.recommendation !== "DO NOT PURSUE" && decision.recommendation !== "" },
    { k: "reference", label: "Reference", icon: <BookOpen size={14} /> },
  ];

  return (
    <div style={styles.eventView}>
      <header style={styles.eventHeader}>
        <input
          style={styles.eventTitleInput}
          value={event.name}
          placeholder="Name this event..."
          onChange={(e) => update((ev) => ({ ...ev, name: e.target.value }))}
        />
        {viewers.length > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#FBE4D8", border: "1px solid #E0784E55", borderRadius: 10, fontSize: 12.5, color: "#B04E31", fontWeight: 600, marginBottom: 12 }}>
            👀 {viewers.join(", ")} {viewers.length === 1 ? "is" : "are"} also viewing this event — careful with simultaneous edits
          </div>
        )}
        <div style={styles.eventHeaderMeta}>
          <div style={styles.headerStat}>
            <span style={styles.headerStatLabel}>Projected Fund</span>
            <span style={styles.headerStatValue}>{fmtMoney(decision.estimate)}</span>
          </div>
          <div style={styles.headerStat}>
            <span style={styles.headerStatLabel}>Recommendation</span>
            <RecPill rec={decision.recommendation} />
          </div>
          <div style={styles.headerStat}>
            <span style={styles.headerStatLabel}>Status</span>
            <select
              style={styles.statusSelect}
              value={event.status}
              onChange={(e) => update((ev) => ({ ...ev, status: e.target.value }))}
            >
              <option value="analysis">Analysis</option>
              <option value="application">Application</option>
              <option value="approved">Approved</option>
              <option value="post-event">Post-Event</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <div style={styles.headerStat}>
            <button
              onClick={exportPDF}
              style={{ padding: "6px 14px", background: "#1E4536", color: "#F7F5EF", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              ↓ Export PDF
            </button>
          </div>
          <div style={styles.headerStat}>
            <button
              onClick={handleShare}
              style={{ padding: "6px 14px", background: shareCopied ? "#059669" : "transparent", color: shareCopied ? "#fff" : "#6C7065", border: `1px solid ${shareCopied ? "#059669" : "#DFDDD0"}`, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all .15s" }}
              title="Copy a read-only link anyone can view without signing in"
            >
              {shareCopied ? "✓ Link copied" : "⇪ Share read-only link"}
            </button>
          </div>
          <div style={styles.headerStat}>
            <button
              onClick={() => setShowHistory(true)}
              style={{ padding: "6px 14px", background: "transparent", color: "#6C7065", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              title="Who changed what, and when"
            >
              <Clock size={12} /> History
            </button>
          </div>
        </div>
      </header>

      {showHistory && (
        <ActivityHistoryModal event={event} orgData={orgData} onClose={() => setShowHistory(false)} />
      )}

      <nav style={styles.tabs} className="etf-tabs">
        {TABS.map((t) => (
          <button
            key={t.k}
            style={{
              ...styles.tab,
              ...(tab === t.k ? styles.tabActive : {}),
              ...(t.highlight && tab !== t.k ? {
                background: "#064e3b",
                color: "#d1fae5",
                borderColor: "#064e3b",
              } : {}),
            }}
            className="etf-tab"
            onClick={() => setTab(t.k)}
          >
            {t.icon} {t.label}
            {t.highlight && tab !== t.k && <span style={{ marginLeft: 4, fontSize: 10, background: "#10b981", color: "#fff", borderRadius: 10, padding: "1px 5px" }}>GO</span>}
          </button>
        ))}
      </nav>

      <div style={styles.tabPanel} className="etf-tab-panel">
        {tab === "overview" && <OverviewTab event={event} update={update} calc={calc} decision={decision} setTab={setTab} orgVenues={orgVenues} />}
        {tab === "decision" && <DecisionTab event={event} update={update} calc={calc} decision={decision} thresholds={thresholds} />}
        {tab === "calculator" && <CalculatorTab event={event} update={update} calc={calc} />}
        {tab === "timeline" && <TimelineTab event={event} update={update} />}
        {tab === "documents" && <DocumentsTab event={event} update={update} />}
        {tab === "costs" && <CostsTab />}
        {tab === "apply" && <ApplyTab event={event} update={update} calc={calc} decision={decision} orgData={orgData} />}
        {tab === "reference" && <ReferenceTab />}
      </div>
    </div>
  );
}

function RecPill({ rec }) {
  const map = {
    "STRATEGIC PRIORITY": { bg: "#064e3b", fg: "#ecfdf5" },
    "STRONG PURSUE": { bg: "#065f46", fg: "#d1fae5" },
    "PURSUE WITH CONDITIONS": { bg: "#B04E31", fg: "#FBE4D8" },
    "DO NOT PURSUE": { bg: "#7f1d1d", fg: "#fee2e2" },
  };
  const c = map[rec] || map["DO NOT PURSUE"];
  return <span style={{ ...styles.recPill, background: c.bg, color: c.fg }}>{rec}</span>;
}

// ————————————————————————————————————————————————————————————————
// ApplicationWindowStatus — traffic-light banner for the 120-day deadline
// Per Event Trust Fund Guidelines (Sept 2025, p.4):
// "ETF & MSRTF: No later than 120 days before the first day of the event."
// ————————————————————————————————————————————————————————————————
function ApplicationWindowStatus({ event }) {
  if (!event.firstDay) {
    return (
      <div style={windowStyles.wrap}>
        <div style={windowStyles.topRow}>
          <div style={{ ...windowStyles.light, ...windowStyles.gray }}>
            <div style={windowStyles.dot} />
          </div>
          <div style={windowStyles.body}>
            <div style={windowStyles.status}>Awaiting Event Date</div>
            <div style={windowStyles.detail}>
              Set the event's first day in Event Details below to calculate your 120-day application deadline.
            </div>
          </div>
        </div>
        <div style={windowStyles.rule}>
          <div style={windowStyles.ruleLabel}>ETF Application Rule</div>
          <div style={windowStyles.ruleText}>Submit no later than 120 days before the first day of the event.</div>
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(event.firstDay + "T12:00:00");
  const deadline = addDays(event.firstDay, -120);
  const daysUntilEvent = Math.ceil((eventDate - today) / 86400000);
  const daysUntilDeadline = Math.ceil((deadline - today) / 86400000);

  // Check if application has been submitted
  const appSubmitted = event.docs?.application?.done;

  // Determine status
  let tone, statusText, detailText;

  if (appSubmitted) {
    tone = "green";
    statusText = "Application Submitted";
    detailText = event.docs.application.date
      ? `Marked complete on ${fmtDate(event.docs.application.date)}. Well done.`
      : "Application marked complete. You're in the clear.";
  } else if (daysUntilEvent < 0) {
    tone = "black";
    statusText = "Event Has Passed";
    detailText = "The event has already happened. Focus on post-event deadlines (attendance certification, local share, disbursement).";
  } else if (daysUntilDeadline < 0) {
    // Past the 120-day cutoff
    tone = "red";
    statusText = "Application Window Closed";
    detailText = `The 120-day deadline was ${fmtDate(deadline)} — ${Math.abs(daysUntilDeadline)} days ago. The event is likely no longer eligible for ETF funding.`;
  } else if (daysUntilDeadline <= 14) {
    tone = "red";
    statusText = "Critical — Submit Immediately";
    detailText = `Only ${daysUntilDeadline} ${daysUntilDeadline === 1 ? "day" : "days"} left before the application window closes on ${fmtDate(deadline)}.`;
  } else if (daysUntilDeadline <= 30) {
    tone = "yellow";
    statusText = "Window Closing Soon";
    detailText = `${daysUntilDeadline} days until the application deadline (${fmtDate(deadline)}). Application packet needs to be ready.`;
  } else {
    tone = "green";
    statusText = "On Track";
    detailText = `${daysUntilDeadline} days remaining to submit the application (deadline: ${fmtDate(deadline)}).`;
  }

  const toneStyle = windowStyles[tone];
  const pct = Math.max(0, Math.min(100, (daysUntilDeadline / 120) * 100));

  return (
    <div style={{ ...windowStyles.wrap, ...toneStyle.wrap }}>
      <div style={windowStyles.topRow}>
        <div style={{ ...windowStyles.light, ...toneStyle.light }}>
          <div style={{ ...windowStyles.dot, ...toneStyle.dot }} />
        </div>
        <div style={windowStyles.body}>
          <div style={windowStyles.statusRow}>
            <div style={{ ...windowStyles.status, color: toneStyle.textColor }}>{statusText}</div>
            {!appSubmitted && daysUntilDeadline >= 0 && daysUntilEvent >= 0 && (
              <div style={windowStyles.countdown}>
                <span style={{ ...windowStyles.countdownNum, color: toneStyle.textColor }}>
                  {daysUntilDeadline}
                </span>
                <span style={windowStyles.countdownLabel}>
                  {daysUntilDeadline === 1 ? "day left" : "days left"}
                </span>
              </div>
            )}
          </div>
          <div style={windowStyles.detail}>{detailText}</div>
        </div>
      </div>

      {!appSubmitted && daysUntilDeadline >= 0 && daysUntilEvent >= 0 && (
        <div style={windowStyles.progressWrap}>
          <div style={windowStyles.progressTrack}>
            <div style={{
              ...windowStyles.progressFill,
              width: `${pct}%`,
              background: toneStyle.bar,
            }} />
          </div>
          <div style={windowStyles.progressMarkers}>
            <span>Deadline: {fmtDate(deadline)}</span>
            <span>Event: {fmtDate(eventDate)}</span>
          </div>
        </div>
      )}

      <div style={windowStyles.rule}>
        <div style={windowStyles.ruleLabel}>ETF Application Deadline</div>
        <div style={windowStyles.ruleText}>120 days before the first day of the event</div>
        <div style={windowStyles.ruleCite}>Event Trust Fund Guidelines, Sept 2025</div>
      </div>
    </div>
  );
}

const windowStyles = {
  wrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    padding: "18px 22px",
    background: "#fff",
    border: "1px solid #DFDDD0",
    borderLeft: "4px solid #979A8D",
    marginBottom: 20,
    borderRadius: 3,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  light: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#6b7280",
  },
  body: { minWidth: 0, flex: 1 },
  statusRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap" as const,
  },
  status: {
    fontFamily: `'Fraunces', Georgia, serif`,
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: "-.01em",
    lineHeight: 1.2,
  },
  countdown: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
  },
  countdownNum: {
    fontFamily: `'Fraunces', Georgia, serif`,
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: "-.02em",
    lineHeight: 1,
  },
  countdownLabel: {
    fontSize: 11,
    color: "#6C7065",
    textTransform: "uppercase" as const,
    letterSpacing: ".1em",
    fontWeight: 600,
  },
  detail: {
    fontSize: 13,
    color: "#6C7065",
    marginTop: 4,
    lineHeight: 1.5,
  },
  progressWrap: { marginTop: 12 },
  progressTrack: {
    height: 6,
    background: "#f2ede5",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    transition: "width .4s, background .3s",
  },
  progressMarkers: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10.5,
    color: "#6C7065",
    marginTop: 5,
    textTransform: "uppercase" as const,
    letterSpacing: ".05em",
    fontWeight: 500,
  },
  rule: {
    borderTop: "1px solid #DFDDD0",
    paddingTop: 10,
    fontSize: 11.5,
  },
  ruleLabel: {
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: ".1em",
    color: "#6C7065",
    fontWeight: 700,
    marginBottom: 4,
  },
  ruleText: {
    fontSize: 12.5,
    color: "#1E4536",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  ruleCite: {
    fontSize: 10,
    color: "#979A8D",
    marginTop: 4,
    fontStyle: "italic" as const,
  },

  // Tone variants
  green: {
    wrap: { borderLeftColor: "#059669" },
    light: { background: "#d1fae5", boxShadow: "0 0 0 4px rgba(5, 150, 105, 0.15)" },
    dot: { background: "#059669", boxShadow: "0 0 12px rgba(5, 150, 105, 0.6)" },
    bar: "#059669",
    textColor: "#065f46",
  },
  yellow: {
    wrap: { borderLeftColor: "#E0784E" },
    light: { background: "#FBE4D8", boxShadow: "0 0 0 4px rgba(217, 119, 6, 0.15)" },
    dot: { background: "#E0784E", boxShadow: "0 0 12px rgba(217, 119, 6, 0.6)" },
    bar: "#E0784E",
    textColor: "#B04E31",
  },
  red: {
    wrap: { borderLeftColor: "#dc2626" },
    light: { background: "#fee2e2", boxShadow: "0 0 0 4px rgba(220, 38, 38, 0.15)" },
    dot: { background: "#dc2626", boxShadow: "0 0 12px rgba(220, 38, 38, 0.6)" },
    bar: "#dc2626",
    textColor: "#991b1b",
  },
  black: {
    wrap: { borderLeftColor: "#1E4536" },
    light: { background: "#e5e7eb" },
    dot: { background: "#1E4536" },
    bar: "#1E4536",
    textColor: "#1E4536",
  },
  gray: {
    background: "#f2ede5",
  },
};

// ————————————————————————————————————————————————————————————————
// Tab 1 — Overview
// ————————————————————————————————————————————————————————————————
function OverviewTab({ event, update, calc, decision, setTab, orgVenues }) {
  const set = (field, val) => update((e) => ({ ...e, [field]: val }));

  const nextDeadline = useMemo(() => {
    if (!event.firstDay) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const item of TIMELINE) {
      const dt = addDays(event.firstDay, item.offset);
      if (dt && dt >= today) return { ...item, date: dt };
    }
    return null;
  }, [event.firstDay]);

  return (
    <div>
      <ApplicationWindowStatus event={event} />
      <div style={styles.twoCol}>
      <div>
        <Section title="Event Details">
          <Field label="Event Name">
            <input style={styles.input} value={event.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. 2025 Regional Basketball Championship" />
          </Field>
          <Field label="Site Selection Organization">
            <input style={styles.input} value={event.siteSelectionOrg} onChange={(e) => set("siteSelectionOrg", e.target.value)} placeholder="The organization that selected your city" />
          </Field>
          <div style={styles.twoFields} className="etf-two-col">
            <Field label="First Day">
              <input type="date" style={styles.input} value={event.firstDay} onChange={(e) => set("firstDay", e.target.value)} />
            </Field>
            <Field label="Last Day">
              <input type="date" style={styles.input} value={event.lastDay} onChange={(e) => set("lastDay", e.target.value)} />
            </Field>
          </div>
          <Field label="Primary Venue(s)">
            <VenuePicker
              selected={event.venues || []}
              legacyValue={event.venue}
              onChange={(venues) => update((ev) => ({ ...ev, venues, venue: venues.join(", ") }))}
              orgVenues={orgVenues}
            />
          </Field>
          <Field label="Notes">
            <textarea style={{ ...styles.input, minHeight: 80, fontFamily: "inherit" }} value={event.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any context, contacts, or considerations..." />
          </Field>
        </Section>

        <Section title="Quick Estimate" subtitle="Use before you've built the full model">
          <div style={styles.twoFields} className="etf-two-col">
            <Field label="Estimated Total Attendees">
              <input type="number" style={styles.input} value={event.attendeeEst || ""} onChange={(e) => set("attendeeEst", Number(e.target.value))} />
            </Field>
            <Field label="Quality ($/attendee)">
              <select style={styles.input} value={event.qualityPerAttendee} onChange={(e) => set("qualityPerAttendee", Number(e.target.value))}>
                <option value={6}>$6 — low quality</option>
                <option value={8}>$8 — standard</option>
                <option value={9}>$9 — above average</option>
                <option value={10}>$10 — high quality</option>
                <option value={12}>$12 — premium</option>
              </select>
            </Field>
          </div>
          <div style={styles.estimateBanner}>
            <div>
              <div style={styles.estimateLabel}>Quick estimate of ETF value</div>
              <div style={styles.estimateNum}>{fmtMoney(calc.quickEstimate)}</div>
            </div>
            <button style={styles.textBtn} onClick={() => setTab("calculator")}>
              Build full model <ArrowRight size={14} />
            </button>
          </div>
        </Section>

        <Section title="Hotel & Market">
          <div style={styles.twoFields} className="etf-two-col">
            <Field label="Projected Room Nights">
              <input type="number" style={styles.input} value={event.roomNights || ""} onChange={(e) => set("roomNights", Number(e.target.value))} />
            </Field>
            <Field label="Out-of-Market Attendance %">
              <input type="number" min="0" max="100" style={styles.input} value={event.outOfMarketPct || ""} onChange={(e) => set("outOfMarketPct", Number(e.target.value))} />
            </Field>
          </div>
          <label style={styles.checkRow}>
            <input type="checkbox" checked={event.hotelBlockConfirmed} onChange={(e) => set("hotelBlockConfirmed", e.target.checked)} />
            <span>Hotel block utilization is confirmed with partners</span>
          </label>
        </Section>
      </div>

      <div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Recommendation</div>
          <RecPill rec={decision.recommendation} />
          <p style={styles.summaryRationale}>{decision.rationale}</p>

          <div style={styles.summaryDivider} />

          <div style={styles.summaryStat}>
            <span>Projected State Share</span>
            <strong>{fmtMoney(calc.stateTaxTotal || decision.estimate * 0.862)}</strong>
          </div>
          <div style={styles.summaryStat}>
            <span>Required Local Match</span>
            <strong>{fmtMoney(calc.requiredLocalMatch || decision.estimate * 0.138)}</strong>
          </div>
          <div style={styles.summaryStat}>
            <span>Total Fund Value</span>
            <strong style={{ fontSize: 16 }}>{fmtMoney(decision.estimate)}</strong>
          </div>
          <div style={styles.summaryStat}>
            <span>State:Local Ratio</span>
            <strong>6.25 : 1</strong>
          </div>
        </div>

        {nextDeadline && (
          <div style={styles.nextDeadline}>
            <div style={styles.nextDeadlineLabel}>NEXT DEADLINE</div>
            <div style={styles.nextDeadlineTitle}>{nextDeadline.label}</div>
            <div style={styles.nextDeadlineDate}>{fmtDate(nextDeadline.date)}</div>
            <button style={styles.textBtn} onClick={() => setTab("timeline")}>
              View full timeline <ArrowRight size={14} />
            </button>
          </div>
        )}

        <div style={styles.eligibilitySummary}>
          <div style={styles.summaryLabel}>Eligibility Checks</div>
          {decision.checks.map((c, i) => (
            <div key={i} style={styles.checkSummary}>
              {c.pass ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color={c.critical ? "#dc2626" : "#E0784E"} />}
              <div style={{ flex: 1 }}>
                <div style={styles.checkSummaryLabel}>{c.label}</div>
                {c.detail && <div style={styles.checkSummaryDetail}>{c.detail}</div>}
              </div>
            </div>
          ))}
          <button style={styles.textBtn} onClick={() => setTab("decision")}>
            Review framework <ArrowRight size={14} />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Tab 2 — Decision Framework
// ————————————————————————————————————————————————————————————————
function DecisionTab({ event, update, calc, decision, thresholds = {} }) {
  const t = {
    min: thresholds.min ?? 75000,
    strong: thresholds.strong ?? 150000,
    strategic: thresholds.strategic ?? 300000,
  };
  const setElig = (key, val) =>
    update((e) => ({ ...e, elig: { ...e.elig, [key]: val } }));

  const questions = [
    {
      key: "competitiveBid",
      q: "Did a site selection organization competitively evaluate this event against sites outside Texas?",
      help: "ETF statute requires a 'highly competitive selection process' that considered out-of-state locations. This is non-negotiable per § 480.0051.",
    },
    {
      key: "siteSelectionLetter",
      q: "Will the site selection organization provide a signed Selection Letter naming your city?",
      help: "The letter must describe the competitive process, list the out-of-state alternatives considered, and name the LOC/municipality.",
    },
    {
      key: "annualOrOnce",
      q: "Is this event held once in Texas (either one-time, or once per year)?",
      help: "Per § 480.0051, the event must not be held more than once per year in Texas or an adjoining state.",
    },
    {
      key: "soleSiteOrRegional",
      q: "Is your city the sole site (or the sole regional site) for this event?",
      help: "The selected site must be the only location in Texas, or the only location in a region including Texas and adjoining states.",
    },
    {
      key: "notHeldElsewhere",
      q: "The event will not be held elsewhere in Texas or an adjoining state in the same year?",
      help: "A duplicate event in the same year voids eligibility.",
    },
  ];

  return (
    <div>
      <Section title="Eligibility Test — The Five Non-Negotiables" subtitle="These come straight from Texas Government Code Chapter 480. All five must be YES.">
        {questions.map((q) => (
          <div key={q.key} style={styles.question}>
            <div style={styles.questionText}>{q.q}</div>
            <div style={styles.questionHelp}>{q.help}</div>
            <div style={styles.yesNoRow}>
              <button
                style={{ ...styles.ynBtn, ...(event.elig[q.key] === true ? styles.ynYes : {}) }}
                onClick={() => setElig(q.key, true)}
              >
                <CheckCircle2 size={14} /> Yes
              </button>
              <button
                style={{ ...styles.ynBtn, ...(event.elig[q.key] === false ? styles.ynNo : {}) }}
                onClick={() => setElig(q.key, false)}
              >
                <XCircle size={14} /> No
              </button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Financial Framework" subtitle="Recommended thresholds — adjust to your organization's capacity and cost structure">
        <div style={styles.thresholdGrid}>
          {[
            { range: `< ${fmtMoney(t.min)}`, label: "Not worth pursuing", color: "#991b1b", bg: "#fee2e2" },
            { range: `${fmtMoney(t.min)} – ${fmtMoney(t.strong)}`, label: "Pursue with conditions", color: "#B04E31", bg: "#FBE4D8" },
            { range: `${fmtMoney(t.strong)} – ${fmtMoney(t.strategic)}`, label: "Strong target", color: "#065f46", bg: "#d1fae5" },
            { range: `${fmtMoney(t.strategic)} +`, label: "Strategic priority", color: "#064e3b", bg: "#a7f3d0" },
          ].map((th, i) => {
            const isCurrent =
              (decision.estimate >= t.strategic && i === 3) ||
              (decision.estimate >= t.strong && decision.estimate < t.strategic && i === 2) ||
              (decision.estimate >= t.min && decision.estimate < t.strong && i === 1) ||
              (decision.estimate < t.min && i === 0);
            return (
              <div
                key={i}
                style={{
                  ...styles.thresholdCard,
                  background: th.bg,
                  color: th.color,
                  outline: isCurrent ? `2px solid ${th.color}` : "none",
                  transform: isCurrent ? "scale(1.02)" : "scale(1)",
                }}
              >
                <div style={styles.thresholdRange}>{th.range}</div>
                <div style={styles.thresholdLabel}>{th.label}</div>
                {isCurrent && <div style={styles.thresholdCurrent}>← Current projection</div>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Final Recommendation">
        <div style={{ ...styles.finalCard, borderLeftColor: recColor(decision.recommendation) }}>
          <RecPill rec={decision.recommendation} />
          <p style={styles.finalRationale}>{decision.rationale}</p>
          <div style={styles.summaryDivider} />
          <div style={styles.finalDetail}>
            <div><strong>Projected ETF value:</strong> {fmtMoney(decision.estimate)}</div>
            <div><strong>Room nights:</strong> {fmtNum(event.roomNights || calc.totalRoomNights)}</div>
            <div><strong>Out-of-market %:</strong> {event.outOfMarketPct || 0}%</div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function recColor(rec) {
  return {
    "STRATEGIC PRIORITY": "#064e3b",
    "STRONG PURSUE": "#065f46",
    "PURSUE WITH CONDITIONS": "#B04E31",
    "DO NOT PURSUE": "#7f1d1d",
  }[rec] || "#999";
}

// ————————————————————————————————————————————————————————————————
// Tab 3 — Calculator
// ————————————————————————————————————————————————————————————————
function CalculatorTab({ event, update, calc }) {
  const safeDays = event?.calc?.days || [];
  const safeRates = event?.calc?.rates || {};
  const safeMix = event?.calc?.mix || {};
  const addDay = () => {
    update((e) => {
      const days = e.calc?.days || [];
      const lastDate = days.length ? days[days.length - 1].date : e.firstDay;
      const nextDate = lastDate ? addDays(lastDate, 1) : null;
      const dateStr = nextDate ? nextDate.toISOString().split("T")[0] : "";
      return {
        ...e,
        calc: {
          ...e.calc,
          days: [...days, {
            id: "d" + Date.now(),
            date: dateStr,
            schedule: "",
            players: 0, coaches: 0, staff: 0, scouts: 0, media: 0, spectators: 0,
          }],
        },
      };
    });
  };

  const updateDay = (id, field, val) => {
    update((e) => ({
      ...e,
      calc: {
        ...e.calc,
        days: (e.calc?.days || []).map((d) => d.id === id ? { ...d, [field]: val } : d),
      },
    }));
  };

  const removeDay = (id) => {
    update((e) => ({
      ...e,
      calc: { ...e.calc, days: (e.calc?.days || []).filter((d) => d.id !== id) },
    }));
  };

  const setRate = (key, val) => {
    update((e) => ({
      ...e,
      calc: { ...e.calc, rates: { ...(e.calc?.rates || {}), [key]: Number(val) } },
    }));
  };
  const setMix = (key, val) => {
    update((e) => ({
      ...e,
      calc: { ...e.calc, mix: { ...(e.calc?.mix || {}), [key]: Number(val) } },
    }));
  };

  const mixTotal = (event.calc?.mix?.outOfState || 0) + (event.calc?.mix?.texasOutOfMarket || 0) + (event.calc?.mix?.dayVisitor || 0);

  return (
    <div>
      <Section
        title="Attendance Model"
        subtitle="Enter attendance by category for each day of the event. Load-in and load-out days count too."
      >
        {safeDays.length === 0 ? (
          <div style={styles.emptyState}>
            <Users size={32} color="#ccc" />
            <div>No days added yet</div>
            <button style={styles.addBtn} onClick={addDay}><Plus size={14} /> Add Day 1</button>
          </div>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Schedule</th>
                    {ATTENDEE_CATS.map((c) => (
                      <th key={c.key} style={styles.th}>{c.label.split("/")[0]}</th>
                    ))}
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {safeDays.map((d) => {
                    const total = ATTENDEE_CATS.reduce((s, c) => s + (Number(d[c.key]) || 0), 0);
                    return (
                      <tr key={d.id}>
                        <td style={styles.td}>
                          <input type="date" style={styles.tableInput} value={d.date} onChange={(e) => updateDay(d.id, "date", e.target.value)} />
                        </td>
                        <td style={styles.td}>
                          <input style={styles.tableInput} value={d.schedule} placeholder="e.g. Competition" onChange={(e) => updateDay(d.id, "schedule", e.target.value)} />
                        </td>
                        {ATTENDEE_CATS.map((c) => (
                          <td key={c.key} style={styles.td}>
                            <input type="number" style={styles.tableNumInput} value={d[c.key] || ""} onChange={(e) => updateDay(d.id, c.key, Number(e.target.value))} />
                          </td>
                        ))}
                        <td style={{ ...styles.td, fontWeight: 600 }}>{fmtNum(total)}</td>
                        <td style={styles.td}>
                          <button style={styles.iconBtn} onClick={() => removeDay(d.id)}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button style={styles.addBtn} onClick={addDay}><Plus size={14} /> Add Day</button>
          </>
        )}
      </Section>

      <Section title="Visitor Mix" subtitle="Percentage breakdown of all attendees. Should sum to 100%.">
        <div style={styles.threeFields}>
          <Field label="Out-of-State %">
            <input type="number" style={styles.input} value={event.calc?.mix?.outOfState || 0} onChange={(e) => setMix("outOfState", e.target.value)} />
          </Field>
          <Field label="Texas (50+ mi from your city) %">
            <input type="number" style={styles.input} value={event.calc?.mix?.texasOutOfMarket || 0} onChange={(e) => setMix("texasOutOfMarket", e.target.value)} />
          </Field>
          <Field label="Day Visitors (local market) %">
            <input type="number" style={styles.input} value={event.calc?.mix?.dayVisitor || 0} onChange={(e) => setMix("dayVisitor", e.target.value)} />
          </Field>
        </div>
        <div style={{ ...styles.mixBanner, background: mixTotal === 100 ? "#f0fdf4" : "#FBE4D8" }}>
          {mixTotal === 100 ? "✓ " : "⚠ "} Mix totals {mixTotal}% {mixTotal !== 100 && "— should equal 100%"}
        </div>
      </Section>

      <Section title="Spending Rates" subtitle="Per-person, per-day spending assumptions. Defaults mirror the Adidas 3SSB benchmark.">
        <div style={styles.ratesGrid}>
          <Field label="Hotel rate / room / night ($)">
            <input type="number" style={styles.input} value={safeRates.hotelRate} onChange={(e) => setRate("hotelRate", e.target.value)} />
          </Field>
          <Field label="Persons / room">
            <input type="number" step="0.1" style={styles.input} value={safeRates.personsPerRoom} onChange={(e) => setRate("personsPerRoom", e.target.value)} />
          </Field>
          <Field label="% staying in hotel">
            <input type="number" style={styles.input} value={safeRates.pctStayingHotel} onChange={(e) => setRate("pctStayingHotel", e.target.value)} />
          </Field>
          <Field label="Food & non-alc ($/person/day)">
            <input type="number" style={styles.input} value={safeRates.foodBev} onChange={(e) => setRate("foodBev", e.target.value)} />
          </Field>
          <Field label="Entertainment & shopping ($/day)">
            <input type="number" style={styles.input} value={safeRates.entertainment} onChange={(e) => setRate("entertainment", e.target.value)} />
          </Field>
          <Field label="Alcohol ($/day)">
            <input type="number" style={styles.input} value={safeRates.alcohol} onChange={(e) => setRate("alcohol", e.target.value)} />
          </Field>
          <Field label="% drinking alcohol">
            <input type="number" style={styles.input} value={safeRates.pctAlcohol} onChange={(e) => setRate("pctAlcohol", e.target.value)} />
          </Field>
          <Field label="Rental car ($/day)">
            <input type="number" style={styles.input} value={safeRates.rentalCar} onChange={(e) => setRate("rentalCar", e.target.value)} />
          </Field>
          <Field label="% renting cars">
            <input type="number" style={styles.input} value={safeRates.pctRenting} onChange={(e) => setRate("pctRenting", e.target.value)} />
          </Field>
          <Field label="Persons / rental car">
            <input type="number" step="0.1" style={styles.input} value={safeRates.personsPerCar} onChange={(e) => setRate("personsPerCar", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Projected Economic Impact">
        <div style={styles.resultsGrid}>
          <ResultCard label="Total Attendance" value={fmtNum(calc.totalAttendance)} sub="all attendee-days" icon={<Users size={18} />} />
          <ResultCard label="Room Nights" value={fmtNum(calc.totalRoomNights)} sub={`at ${fmtMoney(safeRates.hotelRate)}/night`} icon={<Building2 size={18} />} />
          <ResultCard label="Total Visitor Spend" value={fmtMoney(calc.totalSpend)} sub="taxable direct spending" icon={<TrendingUp size={18} />} />
        </div>

        <div style={styles.breakdownTable}>
          <div style={styles.breakdownRow}>
            <span>Hotel</span><span>{fmtMoney(calc.spendBreakdown.hotel)}</span>
          </div>
          <div style={styles.breakdownRow}>
            <span>Food & Non-Alcoholic</span><span>{fmtMoney(calc.spendBreakdown.foodBev)}</span>
          </div>
          <div style={styles.breakdownRow}>
            <span>Entertainment & Shopping</span><span>{fmtMoney(calc.spendBreakdown.entertainment)}</span>
          </div>
          <div style={styles.breakdownRow}>
            <span>Alcohol</span><span>{fmtMoney(calc.spendBreakdown.alcohol)}</span>
          </div>
          <div style={styles.breakdownRow}>
            <span>Rental Cars</span><span>{fmtMoney(calc.spendBreakdown.rental)}</span>
          </div>
        </div>

        <div style={styles.fundCallout}>
          <div style={styles.fundRow}>
            <span>State tax generated</span>
            <strong>{fmtMoney(calc.stateTaxTotal)}</strong>
          </div>
          <div style={styles.fundRow}>
            <span>Local tax generated</span>
            <strong>{fmtMoney(calc.localTaxTotal)}</strong>
          </div>
          <div style={styles.fundRow}>
            <span>Required local match (state ÷ 6.25)</span>
            <strong>{fmtMoney(calc.requiredLocalMatch)}</strong>
          </div>
          <div style={{ ...styles.fundRow, ...styles.fundRowTotal }}>
            <span>Total Trust Fund Value</span>
            <strong>{fmtMoney(calc.totalFund)}</strong>
          </div>
        </div>

        <div style={{ height: 8 }} />
      </Section>
    </div>
  );
}

function ResultCard({ label, value, sub, icon }) {
  return (
    <div style={styles.resultCard}>
      <div style={styles.resultIcon}>{icon}</div>
      <div style={styles.resultLabel}>{label}</div>
      <div style={styles.resultValue}>{value}</div>
      <div style={styles.resultSub}>{sub}</div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Tab 4 — Timeline
// ————————————————————————————————————————————————————————————————
function TimelineTab({ event, update }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timeline = useMemo(() => {
    if (!event.firstDay) return [];
    return TIMELINE.map((t) => {
      const date = addDays(event.firstDay, t.offset);
      const daysAway = date ? Math.ceil((date - today) / 86400000) : null;
      return { ...t, date, daysAway };
    });
  }, [event.firstDay]);

  if (!event.firstDay) {
    return (
      <div style={styles.emptyState}>
        <Calendar size={32} color="#ccc" />
        <div>Set the event's first day to generate the timeline.</div>
      </div>
    );
  }

  return (
    <div>
      <Section title="Auto-Generated Deadline Timeline" subtitle={`All dates calculated from event start: ${fmtDate(event.firstDay)}`}>
        <div style={styles.timeline}>
          {timeline.map((t, i) => {
            const isPast = t.daysAway < 0;
            const isNow = t.daysAway >= 0 && t.daysAway < 30;
            const isEvent = t.key === "eventStart";
            return (
              <div key={i} style={styles.timelineRow}>
                <div style={styles.timelineLeft}>
                  <div style={{
                    ...styles.timelineDot,
                    background: isEvent ? "#111" : isPast ? "#ccc" : isNow ? "#E0784E" : "#fff",
                    borderColor: isEvent ? "#111" : isNow ? "#E0784E" : "#ccc",
                  }} />
                  {i < timeline.length - 1 && <div style={styles.timelineLine} />}
                </div>
                <div style={{
                  ...styles.timelineCard,
                  ...(isEvent ? styles.timelineCardEvent : {}),
                  ...(t.critical && !isPast ? styles.timelineCardCritical : {}),
                }}>
                  <div style={styles.timelineHeader}>
                    <div style={styles.timelineLabel}>{t.label}</div>
                    {t.critical && !isEvent && <span style={styles.criticalBadge}>CRITICAL</span>}
                  </div>
                  <div style={styles.timelineDate}>
                    {fmtDate(t.date)}
                    <span style={styles.timelineOffset}>
                      {t.offset === 0 ? "Event day" : t.offset < 0 ? `${Math.abs(t.offset)} days before` : `${t.offset} days after`}
                    </span>
                  </div>
                  {t.daysAway != null && (
                    <div style={styles.timelineCountdown}>
                      {isPast ? `${Math.abs(t.daysAway)} days ago` :
                       t.daysAway === 0 ? "TODAY" :
                       `${t.daysAway} days from today`}
                    </div>
                  )}
                  <div style={styles.timelineRef}>{t.ref}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Timeline Notes">
        <ul style={styles.notesList}>
          <li>All deadlines are 11:59 PM CST except <strong>Local Share</strong> (2:00 PM CST).</li>
          <li>If a Local Share deadline falls on a weekend or holiday, submit the <strong>business day prior</strong>.</li>
          <li>EDT has 30 days from receipt of a complete application to notify of the Award Amount.</li>
          <li>EDT accepts or rejects the Attendance Certification within 14 days.</li>
          <li>Disbursements require an approved Attendance Cert AND submitted Local Share.</li>
        </ul>
      </Section>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Tab 5 — Documents
// ————————————————————————————————————————————————————————————————
function DocumentsTab({ event, update }) {
  const docs = event.docs || {};

  const DOC_LIST = [
    { key: "application", label: "Events Trust Fund Application", phase: "Pre-Event (by Day -120)", desc: "Completed and signed by an official authorized to bind the applying entity." },
    { key: "endorsement", label: "Endorsement Documentation", phase: "Pre-Event (by Day -120)", desc: "Letter from the endorsing municipality/county requesting participation; signed by an authorized person and naming the LOC if applicable." },
    { key: "selectionLetter", label: "Selection Letter", phase: "Pre-Event (by Day -120)", desc: "Signed by the site selection organization, describing the competitive process, listing out-of-state alternatives considered, and naming your city." },
    { key: "economicImpact", label: "Economic Impact Study", phase: "Pre-Event (by Day -120)", desc: "Detailed study with attendance, spending rates, and tax-by-tax projections (the Calculator tab produces this data)." },
    { key: "attendanceChart", label: "Estimated Attendance Chart", phase: "Pre-Event (by Day -120)", desc: "Day-by-day attendance by category, aligned with the Economic Impact Study." },
    { key: "affidavitEIS", label: "Affidavit for Economic Impact", phase: "Pre-Event (by Day -120)", desc: "Signed by whoever prepared the Economic Impact Study." },
    { key: "affidavitEndorsing", label: "Affidavit of Endorsing Entity", phase: "Pre-Event (by Day -120)", desc: "Signed and notarized by each endorsing municipality, county, and/or LOC." },
    { key: "supportContract", label: "Event Support Contract", phase: "Pre-Event (by Day -1)", desc: "Contract between site selection org and LOC/municipality. Early submission strongly encouraged." },
    { key: "attendanceCert", label: "Attendance Certification", phase: "Post-Event (by Day +45)", desc: "Total actual attendance and estimated non-Texas resident count, with supporting documentation (ticket counts, etc)." },
    { key: "localShare", label: "Local Share Deposit", phase: "Post-Event (by Day +90)", desc: "Via ACH to the ETF Local Share Depository Account (Routing 021409169, Account 0139021006)." },
    { key: "disbursement", label: "Disbursement Request", phase: "Post-Event (by Day +180)", desc: "Signed request form plus itemized cost list, invoices, receipts, proof of payment, and supporting materials." },
  ];

  const toggleDoc = (key) => {
    update((e) => {
      const currentDocs = e.docs || {};
      const current = currentDocs[key] || { done: false, date: "" };
      return {
        ...e,
        docs: {
          ...currentDocs,
          [key]: {
            done: !current.done,
            date: !current.done ? new Date().toISOString().split("T")[0] : "",
          },
        },
      };
    });
  };

  const setDocDate = (key, date) => {
    update((e) => {
      const currentDocs = e.docs || {};
      return {
        ...e,
        docs: { ...currentDocs, [key]: { ...(currentDocs[key] || {}), date } },
      };
    });
  };

  const phases = [...new Set(DOC_LIST.map((d) => d.phase))];
  const completed = DOC_LIST.filter((d) => docs[d.key]?.done).length;

  return (
    <div>
      <Section
        title="Document Checklist"
        subtitle={`${completed} of ${DOC_LIST.length} complete`}
      >
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${(completed / DOC_LIST.length) * 100}%` }} />
        </div>

        {phases.map((phase) => (
          <div key={phase} style={styles.phaseGroup}>
            <div style={styles.phaseLabel}>{phase}</div>
            {DOC_LIST.filter((d) => d.phase === phase).map((d) => {
              const doc = docs[d.key] || { done: false, date: "" };
              return (
                <div
                  key={d.key}
                  style={{ ...styles.docRow, ...(doc.done ? styles.docRowDone : {}) }}
                >
                  <button
                    style={styles.docCheck}
                    onClick={() => toggleDoc(d.key)}
                    aria-label="Mark complete"
                  >
                    {doc.done ? <CheckCircle2 size={22} color="#059669" /> : <Circle size={22} color="#ccc" />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={styles.docLabel}>{d.label}</div>
                    <div style={styles.docDesc}>{d.desc}</div>
                  </div>
                  {doc.done && (
                    <input
                      type="date"
                      style={styles.dateMini}
                      value={doc.date}
                      onChange={(e) => setDocDate(d.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Section>

      <Section title="Submission Details">
        <div style={styles.submissionBox}>
          <div><strong>Email all documents to:</strong> eventsfund@gov.texas.gov</div>
          <div><strong>Local Share ACH:</strong> Routing 021409169 · Account 0139021006</div>
          <div><strong>Before sending Local Share:</strong> Email EventsFund@gov.texas.gov, Accounting@gov.texas.gov, and funds.transfer@cpa.texas.gov with event name, project code, amount, and send date.</div>
        </div>
      </Section>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Tab 6 — Costs
// ————————————————————————————————————————————————————————————————
function CostsTab() {
  const [filter, setFilter] = useState("all");

  const ALLOWABLE = [
    "Costs to rent event facilities",
    "On-site facility personnel necessary to operate the event",
    "Seating, tables, bleachers, chairs, water jugs/cups, court-lining supplies",
    "Portable restrooms, trash receptacles, sanitation",
    "Temporary signs and banners",
    "Food provided ON-SITE for personnel directly running the event (up to $36/person/day)",
    "Third-party event management services",
    "Ground transportation for staff (airport ↔ lodging ↔ venue)",
    "Travel for event participants/coaches/refs/judges at state rates (lodging, mileage, rental car, coach airfare) — must NOT reside in market area",
    "Labor for technical crews, setup, announcers, camera crews, referees, medical",
    "Production costs: staging, rigging, sound, lighting",
    "Competition equipment purchase, shipping, delivery",
    "Internet services for the event",
    "Water, ice, sports drinks",
    "Printing, awards, official attire",
    "Event-specific signage — production, installation, removal",
    "Event marketing and advertising (event name + date + location)",
    "Security, fire marshal, engineers for facilities",
    "ADA accommodations",
    "Credentials",
    "Public health/safety command center expenses",
    "Police, fire, emergency operations staff",
    "Traffic planning and management",
    "Permits",
    "Performance bonds or insurance for the event",
    "Photographer/videographer documenting the event",
    "Non-monetary prizes or awards that are reasonable and customary",
    "National anthem performance costs",
  ];

  const UNALLOWABLE = [
    "Any tax (sales, hotel, vehicle rental)",
    "Gifts — tips, gratuities, honoraria",
    "Grants to any person or organization",
    "Alcoholic beverages",
    "Food outside the on-site participant rule",
    "Cash prizes, gift cards, prepaid certificates for competition",
    "Gaming, raffles, giveaways (unless nominal promotional items)",
    "Personal items and services",
    "Entertainment, hospitality, appearance/talent fees, VIP expenses",
    "Reimbursement for costs not actually incurred (lost profit, in-kind)",
    "Damages of any kind",
    "Constructing an arena, stadium, or convention center",
    "Usual and customary facility maintenance",
    "More than 5% of cost of a structural improvement/fixture on private property",
    "Costs that aren't direct costs",
    "Conflict-of-interest payments",
    "Sanction/host fees exceeding the amount stated in the application",
    "Costs already recouped or refunded from another source",
    "Parties, banquets, pre/post-event meetings (food)",
    "Preparing the ETF application or disbursement request itself",
    "Preparing pre/post-event economic impact studies",
    "Pre/post-event surveys",
    "Responding to PIA or auditor requests",
  ];

  const show = (which) => filter === "all" || filter === which;

  return (
    <div>
      <div style={styles.filterRow}>
        <button style={{ ...styles.filterBtn, ...(filter === "all" ? styles.filterActive : {}) }} onClick={() => setFilter("all")}>All</button>
        <button style={{ ...styles.filterBtn, ...(filter === "allow" ? styles.filterActive : {}) }} onClick={() => setFilter("allow")}>Allowable</button>
        <button style={{ ...styles.filterBtn, ...(filter === "deny" ? styles.filterActive : {}) }} onClick={() => setFilter("deny")}>Unallowable</button>
      </div>

      {show("allow") && (
        <Section title="Allowable Costs" subtitle="TAC Rule § 184.44 — eligible for reimbursement when listed in the Event Support Contract">
          <div style={styles.costList}>
            {ALLOWABLE.map((c, i) => (
              <div key={i} style={{ ...styles.costItem, background: "#f0fdf4", borderLeftColor: "#059669" }}>
                <CheckCircle2 size={14} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {show("deny") && (
        <Section title="Unallowable Costs" subtitle="TAC Rule § 184.45 — NEVER eligible, even if in the Event Support Contract">
          <div style={styles.costList}>
            {UNALLOWABLE.map((c, i) => (
              <div key={i} style={{ ...styles.costItem, background: "#fef2f2", borderLeftColor: "#dc2626" }}>
                <XCircle size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Food & Travel — Special Rules">
        <div style={styles.rulesBox}>
          <h4 style={styles.ruleH}>Food ($36/person/day cap)</h4>
          <ul style={styles.rulesList}>
            <li>Must be <strong>directly related to conducting the event</strong></li>
            <li>Must be <strong>provided on-site</strong> at the event</li>
            <li>Must be for <strong>event participants or personnel essential to conducting the event</strong></li>
            <li>Parties, banquets, pre/post-event meetings are NEVER allowable</li>
            <li>Documentation must show what was provided, to whom, and headcount</li>
          </ul>
          <h4 style={styles.ruleH}>Travel</h4>
          <ul style={styles.rulesList}>
            <li>Only for <strong>participants, coaches, referees, judges, or similar</strong> — not residing in the market area</li>
            <li>Lodging & mileage capped at <strong>state employee rates</strong></li>
            <li>Rental car capped at <strong>standard full-size published rate</strong></li>
            <li>Airfare capped at <strong>published coach-class rate</strong></li>
            <li>Documentation must include traveler, role, and residence</li>
          </ul>
        </div>
      </Section>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Tab — Apply to EDT
// Shows when event passes decision framework. Links to all official
// EDT documents and generates a pre-filled email draft.
// ————————————————————————————————————————————————————————————————
function ApplyTab({ event, update, calc, decision, orgData }) {
  const outcome = event.outcome || {};
  const setOutcome = (key, value) => {
    update((e) => ({ ...e, outcome: { ...(e.outcome || {}), [key]: value } }));
  };
  const isEligible = decision.recommendation && decision.recommendation !== "DO NOT PURSUE";
  const appDeadline = event.firstDay ? addDays(event.firstDay, -120) : null;
  const daysUntilDeadline = appDeadline ? Math.ceil((appDeadline - new Date()) / (1000 * 60 * 60 * 24)) : null;

  const generatePacket = async () => {
    const org = orgData || {};
    const safeDays = event.calc?.days || [];
    const totalRoomNights = Math.round(calc.totalRoomNights || event.roomNights || 0);
    const totalAttendance = Math.round(calc.totalAttendance || 0);

    // — Attendance Chart CSV download —
    const csvRows = [
      ["Date", "Players/Competitors", "Coaches", "Staff", "Scouts/College Coaches", "Media/TV", "Friends/Family/Spectators", "Daily Total"],
    ];
    let colTotals = [0, 0, 0, 0, 0, 0, 0];
    safeDays.forEach((day) => {
      const vals = [
        Number(day.players) || 0,
        Number(day.coaches) || 0,
        Number(day.staff) || 0,
        Number(day.scouts) || 0,
        Number(day.media) || 0,
        Number(day.spectators) || 0,
      ];
      const dayTotal = vals.reduce((a, b) => a + b, 0);
      vals.forEach((v, i) => { colTotals[i] += v; });
      colTotals[6] += dayTotal;
      csvRows.push([day.date || "", ...vals, dayTotal]);
    });
    csvRows.push(["TOTAL", ...colTotals]);

    const csvContent = csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const csvBlob = new Blob([csvContent], { type: "text/csv" });
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement("a");
    csvLink.href = csvUrl;
    csvLink.download = `${(event.name || "ETF").replace(/[^a-z0-9]/gi, "-")}-Attendance-Chart.csv`;
    csvLink.click();
    URL.revokeObjectURL(csvUrl);

    // — Pre-filled Word document via API —
    try {
      const res = await fetch("/api/generate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, calc, decision, org }),
      });
      if (!res.ok) throw new Error("API error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ETF-Application-${(event.name || "Event").replace(/[^a-z0-9]/gi, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      alert("Could not generate the Word document. Check your connection and try again.");
    }
  };

  const emailSubject = encodeURIComponent(
    `ETF Application — ${event.name || "Untitled Event"}${event.firstDay ? ` — ${fmtDate(event.firstDay)}` : ""}`
  );
  const emailBody = encodeURIComponent(
`Dear EDT Events Trust Fund Team,

We are writing to submit an application for Events Trust Fund consideration for the following event:

Event Name: ${event.name || "[Event Name]"}
Event Dates: ${event.firstDay ? fmtDate(event.firstDay) : "[First Day]"} – ${event.lastDay ? fmtDate(event.lastDay) : "[Last Day]"}
Venue(s): ${event.venues?.join(", ") || "[Venue]"}
Site Selection Organization: ${event.siteSelectionOrg || "[Site Selection Org]"}
Projected ETF Value: ${fmtMoney(decision.estimate)}
Estimated Room Nights: ${fmtNum(calc.totalRoomNights || event.roomNights || 0)}

Please find our complete application packet attached, including:
• Events Trust Fund Application (completed)
• Estimated Attendance Chart
• Economic Impact Study / Supporting Data
• Site Selection Letter (on organization letterhead)
• Affidavit of Endorsing Entity (signed and notarized)
• Affidavit for Economic Impact Documentation (signed and notarized)
• ACH Direct Deposit Authorization Form

Please confirm receipt and let us know if any additional information is required.

Thank you,
[Your Name]
[Your Title]
[Your Organization]
[Phone]`
  );

  const EDT_DOCS = [
    {
      title: "ETF Program Page",
      desc: "Official overview, eligibility details, and all current program documents",
      url: "https://gov.texas.gov/business/page/event-trust-funds-program",
      tag: "Start Here",
      tagColor: "#064e3b",
    },
    {
      title: "Events Trust Fund Guidelines (Sept 2025)",
      desc: "The definitive procedural document. Read before completing any form.",
      url: "https://gov.texas.gov/uploads/files/business/Event_Trust_Fund_Guidelines.pdf",
      tag: "Required Reading",
      tagColor: "#1e40af",
    },
    {
      title: "ETF Application Form",
      desc: "Official application — updated October 15, 2025. Must be submitted ≥120 days before first event day.",
      url: "https://gov.texas.gov/uploads/files/business/Events_Application.docx",
      tag: "Submit to ETF",
      tagColor: "#B04E31",
    },
    {
      title: "Estimated Attendance Chart",
      desc: "Required attachment to the application — updated September 2025.",
      url: "https://gov.texas.gov/uploads/files/business/Estimated_Attendance_Chart_for_Application.xlsx",
      tag: "Submit to ETF",
      tagColor: "#B04E31",
    },
    {
      title: "Affidavit of Endorsing Entity",
      desc: "Must be signed and notarized by the municipality, county, or LOC representative.",
      url: "https://gov.texas.gov/uploads/files/business/Affidavit_of_Endorsing_Entity.docx",
      tag: "Notarized",
      tagColor: "#6b21a8",
    },
    {
      title: "Affidavit for Economic Impact Documentation",
      desc: "Must be signed and notarized by whoever prepares the economic impact study.",
      url: "https://gov.texas.gov/uploads/files/business/Affidavit_for_Economic_Impact_Documentation.docx",
      tag: "Notarized",
      tagColor: "#6b21a8",
    },
    {
      title: "ACH Direct Deposit Authorization",
      desc: "Required for disbursement. Submit with your application packet.",
      url: "https://gov.texas.gov/uploads/files/business/ACH_Direct_Deposit_Instructions.pdf",
      tag: "Banking",
      tagColor: "#374151",
    },
    {
      title: "Attendance Certification Form",
      desc: "Due 45 days after last event day. Certifies actual attendance vs. estimates.",
      url: "https://gov.texas.gov/uploads/files/business/Events_Attendance_Certification.docx",
      tag: "Post-Event",
      tagColor: "#065f46",
    },
  ];

  const CHECKLIST = [
    { item: "Site selection org has agreed to provide a signed Selection Letter on their letterhead", critical: true },
    { item: "Selection letter names your city/county and lists out-of-state alternatives considered", critical: true },
    { item: "Event occurs only once per year and your city is the sole (or sole regional) site", critical: true },
    { item: "Event is not held elsewhere in Texas or adjoining states the same calendar year", critical: true },
    { item: "Application submitted at least 120 days before first event day", critical: true },
    { item: "Completed ETF Application form (all sections filled, no blanks)", critical: false },
    { item: "Estimated Attendance Chart completed and attached", critical: false },
    { item: "Economic Impact Study or supporting attendance/spending data attached", critical: false },
    { item: "Affidavit of Endorsing Entity — signed AND notarized", critical: false },
    { item: "Affidavit for Economic Impact Documentation — signed AND notarized", critical: false },
    { item: "ACH Direct Deposit Authorization form completed", critical: false },
    { item: "Municipality/county request letter signed by authorized official", critical: false },
    { item: "No contingency clauses, blanket terms, or 'miscellaneous' line items in budget", critical: false },
  ];

  const [checked, setChecked] = useState({});
  const completedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Recommendation banner */}
      {!isEligible ? (
        <div style={{ padding: "16px 20px", background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626", borderRadius: 10, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#991b1b", marginBottom: 4 }}>⛔ DO NOT PURSUE</div>
          <div style={{ fontSize: 13.5, color: "#7f1d1d", lineHeight: 1.6 }}>
            This event does not meet the eligibility or financial threshold requirements. Return to the Decision Framework tab to review which criteria failed before proceeding.
          </div>
        </div>
      ) : (
        <div style={{ padding: "16px 20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderLeft: "4px solid #059669", borderRadius: 10, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#065f46", marginBottom: 4 }}>
            ✓ {decision.recommendation} — Ready to apply
          </div>
          <div style={{ fontSize: 13.5, color: "#064e3b", lineHeight: 1.6 }}>
            Projected ETF value: <strong>{fmtMoney(decision.estimate)}</strong> &nbsp;·&nbsp;
            Application deadline: <strong>{appDeadline ? fmtDate(appDeadline.toISOString().split("T")[0]) : "Set event dates first"}</strong>
            {daysUntilDeadline !== null && (
              <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: daysUntilDeadline < 14 ? "#dc2626" : daysUntilDeadline < 30 ? "#E0784E" : "#059669", color: "#fff" }}>
                {daysUntilDeadline > 0 ? `${daysUntilDeadline} days left` : "DEADLINE PASSED"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Generate Application Packet */}
      <div style={{ background: "#F1EFE6", border: "1px solid #DFDDD0", borderRadius: 12, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1E4536", marginBottom: 4 }}>Generate Application Packet</div>
          <div style={{ fontSize: 13, color: "#6C7065", lineHeight: 1.5 }}>
            Opens a pre-filled reference document with all your event data, plus downloads the Attendance Chart as a CSV.<br />
            <span style={{ color: "#979A8D", fontSize: 12 }}>Fill out the ETF Application Profile in Organization Settings for the best results.</span>
          </div>
        </div>
        <button
          onClick={generatePacket}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", background: "#1E4536", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <Download size={15} /> Generate Packet
        </button>
      </div>

      {/* Pre-submission checklist */}
      <Section title="Pre-Submission Checklist" subtitle={`${completedCount} of ${CHECKLIST.length} confirmed`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CHECKLIST.map((item, i) => (
            <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "8px 10px", background: checked[i] ? "#f0fdf4" : "#F1EFE6", border: `1px solid ${checked[i] ? "#bbf7d0" : "#DFDDD0"}`, borderRadius: 10 }}>
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={() => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13.5, color: checked[i] ? "#065f46" : "#1E4536", lineHeight: 1.5 }}>
                {item.critical && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#dc2626", marginRight: 6, textTransform: "uppercase" }}>Statutory</span>}
                {item.item}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* Official documents */}
      <Section title="Official ETF Documents" subtitle="All links go directly to gov.texas.gov — these are the real forms">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {EDT_DOCS.map((doc, i) => (
            <a
              key={i}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "12px 16px", background: "#F1EFE6", border: "1px solid #DFDDD0", borderRadius: 10, textDecoration: "none", color: "inherit" }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#1E4536", marginBottom: 3 }}>{doc.title}</div>
                <div style={{ fontSize: 12.5, color: "#6C7065", lineHeight: 1.5 }}>{doc.desc}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: doc.tagColor + "22", color: doc.tagColor }}>{doc.tag}</span>
                <ArrowRight size={14} color="#979A8D" />
              </div>
            </a>
          ))}
        </div>
      </Section>

      {/* Email EDT */}
      <Section title="Email EDT" subtitle="Opens your email client with event details pre-filled — review and attach documents before sending">
        <div style={{ padding: "16px 20px", background: "#F1EFE6", border: "1px solid #DFDDD0", borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#6C7065", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>To</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>eventsfund@gov.texas.gov</div>
          <div style={{ fontSize: 12, color: "#6C7065", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Subject</div>
          <div style={{ fontSize: 13.5, marginBottom: 16, color: "#1E4536" }}>
            ETF Application — {event.name || "Untitled Event"}{event.firstDay ? ` — ${fmtDate(event.firstDay)}` : ""}
          </div>
          <div style={{ fontSize: 12, color: "#6C7065", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Body preview</div>
          <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-line", background: "#fff", padding: 12, border: "1px solid #DFDDD0", borderRadius: 3, maxHeight: 200, overflow: "auto" }}>
{`Dear EDT Events Trust Fund Team,

We are submitting an application for Events Trust Fund consideration:

Event: ${event.name || "[Event Name]"}
Dates: ${event.firstDay ? fmtDate(event.firstDay) : "[First Day]"} – ${event.lastDay ? fmtDate(event.lastDay) : "[Last Day]"}
Projected ETF Value: ${fmtMoney(decision.estimate)}
Estimated Room Nights: ${fmtNum(calc.totalRoomNights || event.roomNights || 0)}

Complete application packet attached.`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={`mailto:eventsfund@gov.texas.gov?subject=${emailSubject}&body=${emailBody}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "#1E4536", color: "#fff", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600 }}
          >
            <ArrowRight size={14} /> Open in Email Client
          </a>
          <div style={{ fontSize: 12, color: "#979A8D", display: "flex", alignItems: "center", lineHeight: 1.4 }}>
            ⚠ Always attach your full application packet before sending. This tool does not transmit files to EDT.
          </div>
        </div>
      </Section>

      {/* What EDT will reject */}
      <Section title="Common EDT Rejection Reasons" subtitle="Review before submitting — these will get your application kicked back">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "Contingency clauses in the Event Support Contract (e.g. 'if funds are available')",
            "Blanket terms like 'etc.', 'miscellaneous', or 'other expenses' in the budget",
            "Any language in the ESC that shifts EDT's obligations or references EDT's decision-making authority",
            "Application submitted fewer than 120 days before the first event day",
            "Selection Letter does not specifically name your city/county",
            "Selection Letter does not describe the competitive process or list out-of-state alternatives",
            "Unallowable costs included in the budget (alcohol, prizes, cash awards, giveaways, parties/banquets)",
            "Affidavits not notarized",
            "Attendance Certification not submitted within 45 days of last event day",
          ].map((reason, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13 }}>
              <span style={{ color: "#dc2626", flexShrink: 0 }}>✗</span>
              <span style={{ color: "#7f1d1d", lineHeight: 1.5 }}>{reason}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Post-award outcome tracking */}
      <Section title="Award & Outcome Tracking" subtitle="Record what actually happened — award, attendance, disbursement. Builds your projected-vs-actual track record for future applications and budget presentations.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#6C7065", display: "block", marginBottom: 5 }}>Awarded Amount ($)</label>
            <input type="number" value={outcome.awardedAmount || ""} onChange={(e) => setOutcome("awardedAmount", e.target.value)} placeholder="From EDT award letter" style={{ width: "100%", padding: "10px 12px", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#6C7065", display: "block", marginBottom: 5 }}>Award Date</label>
            <input type="date" value={outcome.awardDate || ""} onChange={(e) => setOutcome("awardDate", e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#6C7065", display: "block", marginBottom: 5 }}>Actual Attendance</label>
            <input type="number" value={outcome.actualAttendance || ""} onChange={(e) => setOutcome("actualAttendance", e.target.value)} placeholder="For 45-day certification" style={{ width: "100%", padding: "10px 12px", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#6C7065", display: "block", marginBottom: 5 }}>Disbursed Amount ($)</label>
            <input type="number" value={outcome.disbursedAmount || ""} onChange={(e) => setOutcome("disbursedAmount", e.target.value)} placeholder="Final amount received" style={{ width: "100%", padding: "10px 12px", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#6C7065", display: "block", marginBottom: 5 }}>Disbursement Date</label>
            <input type="date" value={outcome.disbursedDate || ""} onChange={(e) => setOutcome("disbursedDate", e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
        </div>
        {(Number(outcome.awardedAmount) > 0 && decision.estimate > 0) && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#F1EFE6", border: "1px solid #DFDDD0", borderRadius: 10, fontSize: 13, color: "#1E4536" }}>
            Projected {fmtMoney(decision.estimate)} → Awarded {fmtMoney(Number(outcome.awardedAmount))}
            {" "}({Math.round((Number(outcome.awardedAmount) / decision.estimate) * 100)}% of projection)
            {Number(outcome.actualAttendance) > 0 && calc.totalAttendance > 0 && (
              <span> · Attendance: {fmtNum(calc.totalAttendance)} projected → {fmtNum(Number(outcome.actualAttendance))} actual</span>
            )}
          </div>
        )}
      </Section>

    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Tab 7 — Reference
// ————————————————————————————————————————————————————————————————
function ReferenceTab() {
  const [expanded, setExpanded] = useState("process");

  const toggle = (k) => setExpanded(expanded === k ? null : k);

  const sections = [
    {
      k: "process",
      t: "The ETF Process — Plain English",
      body: (
        <div>
          <p><strong>What it is:</strong> The Texas Events Trust Fund (ETF) reimburses cities and local organizing committees for eligible costs of hosting qualifying events that compete against out-of-state locations.</p>
          <p><strong>How the money works:</strong> The state deposits 6.25× whatever the local entity contributes, up to the estimated incremental tax gain from the event. If your city puts in $24K local match, the state matches with up to $150K — a total fund of $174K.</p>
          <p><strong>The money is a reimbursement</strong>, not a grant. You must front the costs, submit documentation, and receive disbursement <em>after</em> the event.</p>
          <p><strong>Key deadlines:</strong></p>
          <ul>
            <li>120 days <em>before</em> the event: Full application packet</li>
            <li>Before event day: Event Support Contract</li>
            <li>45 days after: Attendance Certification</li>
            <li>90 days after: Local Share deposit</li>
            <li>180 days after: Disbursement Request</li>
          </ul>
        </div>
      ),
    },
    {
      k: "eligibility",
      t: "Eligibility in Detail (§ 480.0051)",
      body: (
        <div>
          <p>An event is ETF-eligible <strong>ONLY IF</strong>:</p>
          <ol>
            <li>A site selection organization selected Texas after a <strong>highly competitive process</strong> that considered one or more out-of-state sites.</li>
            <li>The Texas site is either:
              <ul>
                <li>The sole site for the event, OR</li>
                <li>The sole site for the event in a region (Texas + adjoining states)</li>
              </ul>
            </li>
            <li>The event happens <strong>no more than once per year</strong> in Texas or any adjoining state.</li>
          </ol>
          <p>The 2023 amendment (§ 480.00515) clarifies that annual sporting events held once per season qualify.</p>
        </div>
      ),
    },
    {
      k: "mckinney",
      t: "Financial Framework — Why These Thresholds",
      body: (
        <div>
          <p><strong>$6–$12 per attendee quick estimate:</strong> Based on observed patterns across completed ETFs. A regional youth sports event averages ~$9/attendee in ETF generation; premium national events hit $12+.</p>
          <p><strong>$75K minimum:</strong> Below this, the administrative lift (application, support contract, cert, disbursement paperwork) typically consumes more staff time than the fund is worth for most teams.</p>
          <p><strong>$150K target:</strong> Comparable to the Adidas 3SSB benchmark ($168K). Enough to materially subsidize facility rental, staffing, and safety costs.</p>
          <p><strong>1,500–2,000 room nights minimum:</strong> Validates that the event is drawing overnight visitors — the single biggest driver of both state HOT tax and local HOT tax, which is what makes the math work.</p>
          <p><strong>50%+ out-of-market:</strong> Ensures incremental tax gain is real, not cannibalized from existing local visitors.</p>
          <p style={{ color: "#6b7280", fontSize: 12, marginTop: 12 }}>These thresholds are guidelines, not ETF program rules. Adjust them to fit your organization's administrative capacity and strategic priorities.</p>
        </div>
      ),
    },
    {
      k: "contract",
      t: "Event Support Contract — What Must Be In It",
      body: (
        <div>
          <p>The ESC is a contract between the Site Selection Organization and the LOC/municipality. EDT uses it as the ONLY source of truth for allowable costs — <strong>if it's not in the ESC, it won't be reimbursed.</strong></p>
          <p><strong>Must include:</strong></p>
          <ul>
            <li>Parties and their roles</li>
            <li>Applicant's specific obligations in planning and executing the event</li>
            <li>Detailed list of allowable obligations (enough detail for EDT to judge each one)</li>
            <li>References to any revenues or compensation expected</li>
            <li>Compliance with TAC § 184.4(C)(5), 184.50, 184.51</li>
          </ul>
          <p><strong>EDT will REJECT contracts that contain:</strong></p>
          <ul>
            <li>Contingency clauses relieving the applicant's obligation to pay</li>
            <li>Clauses shifting obligations to EDT</li>
            <li>Blanket terms like "any necessary fixtures"</li>
            <li>"etc.", "miscellaneous", "as needed", "other"</li>
            <li>"any expense allowed by the Office" or similar deferrals</li>
          </ul>
        </div>
      ),
    },
    {
      k: "attendance",
      t: "Attendance Verification — Don't Get Rejected",
      body: (
        <div>
          <p>The Attendance Certification is due 45 days after the event. <strong>Without supporting documentation, it will be rejected — and the event becomes ineligible for disbursement.</strong></p>
          <p><strong>Accepted methods:</strong></p>
          <ul>
            <li>Ticket sales count</li>
            <li>Turnstile count</li>
            <li>Ticket scan count</li>
            <li>Convention registration check-in count</li>
            <li>Participant totals (must be paired with ticket/turnstile count for MERP & MSRTF)</li>
            <li>Other methods ONLY if approved by EDT before the event</li>
          </ul>
          <p><strong>Penalty for low attendance:</strong> If actual attendance is ≥25% below estimate, EDT may proportionally reduce the disbursement.</p>
          <p><strong>Best practice:</strong> Use conservative estimates in the original application. Overshooting creates downside with no upside.</p>
        </div>
      ),
    },
    {
      k: "pia",
      t: "Public Information Act — What Gets Disclosed",
      body: (
        <div>
          <p>All documents submitted to the Office of the Governor are subject to the Texas Public Information Act (Chapter 552). This includes the application, ESC, economic impact study, and disbursement documentation.</p>
          <p><strong>If information is proprietary:</strong> Mark it clearly as such when submitting. You'll receive notice if someone requests it. You — not the OOG — must submit arguments to the AG.</p>
          <p><strong>Auto-redacted:</strong> Bank account/routing numbers, SSNs, driver licenses.</p>
          <p><strong>Blanket claims of confidentiality are NOT accepted.</strong> Specific information must be clearly marked.</p>
        </div>
      ),
    },
    {
      k: "statute",
      t: "The Statute — Texas Government Code Chapter 480",
      body: (
        <div>
          <p>Key sections referenced in this tool:</p>
          <ul>
            <li><strong>§ 480.0001</strong> — Definitions</li>
            <li><strong>§ 480.0051</strong> — Eligible events (the 5 non-negotiables)</li>
            <li><strong>§ 480.0052</strong> — Limitations on funding requests &lt;$200K (10/year cap, 3 non-sporting)</li>
            <li><strong>§ 480.0102</strong> — How EDT determines incremental tax receipts</li>
            <li><strong>§ 480.0151</strong> — Fund establishment</li>
            <li><strong>§ 480.0155</strong> — State share at 6.25× local match</li>
            <li><strong>§ 480.0202</strong> — Disbursement from fund</li>
            <li><strong>§ 480.0203</strong> — Reduction for significantly lower attendance</li>
            <li><strong>§ 480.0204</strong> — Allowable expenses</li>
            <li><strong>§ 480.0206</strong> — Prohibited disbursements</li>
          </ul>
          <p>Full statute: <a href="https://statutes.capitol.texas.gov/Docs/GV/htm/GV.480.htm" target="_blank" rel="noopener noreferrer" style={{ color: "#B04E31" }}>statutes.capitol.texas.gov</a></p>
          <p>Administrative rules: Texas Administrative Code, Title 10, Part 5, Chapter 184.1 – 184.51</p>
          <p>Program page: <a href="https://gov.texas.gov/business/page/event-trust-funds-program" target="_blank" rel="noopener noreferrer" style={{ color: "#B04E31" }}>gov.texas.gov</a></p>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Section title="Reference Library">
        {sections.map((s) => (
          <div key={s.k} style={styles.accordion}>
            <button style={styles.accordionHeader} onClick={() => toggle(s.k)}>
              {expanded === s.k ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>{s.t}</span>
            </button>
            {expanded === s.k && (
              <div style={styles.accordionBody}>{s.body}</div>
            )}
          </div>
        ))}
      </Section>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Shared components
// ————————————————————————————————————————————————————————————————
function Section({ title, subtitle, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        {subtitle && <div style={styles.sectionSub}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// VenuePicker — multi-select, uses org venues from database
// ————————————————————————————————————————————————————————————————
function VenuePicker({ selected, legacyValue, onChange, orgVenues }) {
  // orgVenues from database — falls back to McKinney defaults if not set
  const baseVenues = orgVenues && orgVenues.length > 0 ? orgVenues : [];

  const [customVenues, setCustomVenues] = useState([]);
  const [newVenue, setNewVenue] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load any additional custom venues added inline (beyond org's base list)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("etf_custom_venues");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Only keep customs that aren't already in the org's base list
          setCustomVenues(parsed.filter((v) => !baseVenues.includes(v)));
        }
      }
    } catch (e) { /* none yet */ }
    setLoaded(true);
  }, []);

  // Persist custom venues
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("etf_custom_venues", JSON.stringify(customVenues)); } catch (_) {}
  }, [customVenues, loaded]);

  // Migrate legacy single-venue string into the selected array on first load
  useEffect(() => {
    if (!loaded) return;
    if (legacyValue && (!selected || selected.length === 0)) {
      const parts = legacyValue.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length) {
        const allKnown = [...baseVenues, ...customVenues];
        const newCustom = parts.filter((p) => !allKnown.includes(p));
        if (newCustom.length) setCustomVenues((prev) => [...prev, ...newCustom]);
        onChange(parts);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const allVenues = [...baseVenues, ...customVenues];
  const selectedSet = new Set(selected || []);

  const toggle = (v) => {
    const next = selectedSet.has(v)
      ? (selected || []).filter((x) => x !== v)
      : [...(selected || []), v];
    onChange(next);
  };

  const addCustom = () => {
    const v = newVenue.trim();
    if (!v) return;
    if (allVenues.includes(v)) {
      // Already exists — just select it
      if (!selectedSet.has(v)) onChange([...(selected || []), v]);
    } else {
      setCustomVenues((prev) => [...prev, v]);
      onChange([...(selected || []), v]);
    }
    setNewVenue("");
  };

  const removeCustom = (v) => {
    setCustomVenues((prev) => prev.filter((x) => x !== v));
    onChange((selected || []).filter((x) => x !== v));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  };

  return (
    <div style={venueStyles.wrap}>
      {selected && selected.length > 0 && (
        <div style={venueStyles.chipRow}>
          {selected.map((v) => (
            <span key={v} style={venueStyles.chip}>
              {v}
              <button
                style={venueStyles.chipX}
                onClick={() => toggle(v)}
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={venueStyles.list}>
        {allVenues.map((v) => {
          const isCustom = !baseVenues.includes(v);
          const checked = selectedSet.has(v);
          return (
            <label
              key={v}
              style={{
                ...venueStyles.row,
                ...(checked ? venueStyles.rowChecked : {}),
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(v)}
                style={venueStyles.checkbox}
              />
              <span style={venueStyles.label}>{v}</span>
              {isCustom && (
                <button
                  style={venueStyles.removeBtn}
                  onClick={(e) => {
                    e.preventDefault();
                    removeCustom(v);
                  }}
                  title="Remove this custom venue"
                  aria-label={`Delete custom venue ${v}`}
                >
                  <Trash2 size={11} />
                </button>
              )}
              {!isCustom && <span style={venueStyles.defaultTag}>Default</span>}
            </label>
          );
        })}
      </div>

      <div style={venueStyles.addRow}>
        <input
          style={venueStyles.addInput}
          value={newVenue}
          onChange={(e) => setNewVenue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add another venue..."
        />
        <button
          type="button"
          style={venueStyles.addBtn}
          onClick={addCustom}
          disabled={!newVenue.trim()}
        >
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

const venueStyles = {
  wrap: { display: "flex", flexDirection: "column", gap: 10 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 4px 4px 10px",
    background: "#FBE4D8",
    color: "#78350f",
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 3,
    border: "1px solid #fde68a",
  },
  chipX: {
    background: "transparent",
    border: "none",
    color: "#78350f",
    fontSize: 16,
    lineHeight: 1,
    padding: "0 4px",
    cursor: "pointer",
  },
  list: {
    border: "1px solid #DFDDD0",
    borderRadius: 3,
    background: "#fff",
    maxHeight: 280,
    overflowY: "auto",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderBottom: "1px solid #f2ede5",
    cursor: "pointer",
    fontSize: 13,
    transition: "background .1s",
  },
  rowChecked: {
    background: "#fffbeb",
  },
  checkbox: {
    width: 14,
    height: 14,
    accentColor: "#B04E31",
    cursor: "pointer",
    margin: 0,
  },
  label: { flex: 1, color: "#1E4536" },
  defaultTag: {
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    color: "#B04E31",
    background: "#FBE4D8",
    padding: "2px 6px",
    borderRadius: 2,
    fontWeight: 600,
  },
  removeBtn: {
    background: "transparent",
    border: "none",
    color: "#979A8D",
    padding: 4,
    display: "flex",
    alignItems: "center",
  },
  addRow: { display: "flex", gap: 8 },
  addInput: {
    flex: 1,
    padding: "8px 12px",
    border: "1px solid #DFDDD0",
    background: "#fff",
    fontSize: 13,
    borderRadius: 3,
    fontFamily: "inherit",
  },
  addBtn: {
    padding: "8px 14px",
    background: "#1E4536",
    color: "#F1EFE6",
    border: "none",
    fontSize: 12.5,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 5,
    borderRadius: 3,
  },
};

// ————————————————————————————————————————————————————————————————
// Global styles
// ————————————————————————————————————————————————————————————————
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      input, select, textarea, button { font-family: inherit; }
      input[type="date"], input[type="number"], input[type="text"], select, textarea {
        transition: border-color .15s ease, box-shadow .15s ease;
      }
      input[type="date"]:focus, input[type="number"]:focus, input[type="text"]:focus, select:focus, textarea:focus {
        outline: none;
        border-color: #B04E31;
        box-shadow: 0 0 0 3px rgba(146, 64, 14, .12);
      }
      button:hover { cursor: pointer; }
      a { text-decoration: underline; text-underline-offset: 3px; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }

      /* ── Responsive layout ── */

      /* Mobile sidebar overlay */
      .etf-sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 40;
      }
      .etf-sidebar-overlay.open { display: block; }

      /* Mobile sidebar drawer */
      @media (max-width: 768px) {
        .etf-sidebar {
          position: fixed !important;
          left: -280px !important;
          top: 0 !important;
          height: 100vh !important;
          height: 100dvh !important;
          width: 280px !important;
          z-index: 50;
          transition: left .25s ease;
          box-shadow: 4px 0 24px rgba(0,0,0,.12);
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
        .etf-sidebar.open { left: 0 !important; }
        .etf-main { margin-left: 0 !important; width: 100% !important; }
        .etf-mobile-header {
          display: flex !important;
        }
        .etf-app { flex-direction: column !important; }
      }

      /* Mobile header bar */
      .etf-mobile-header {
        display: none;
        position: sticky;
        top: 0;
        z-index: 30;
        background: #fff;
        border-bottom: 1px solid #DFDDD0;
        padding: 12px 16px;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .etf-hamburger {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: #1E4536;
      }

      /* Two-column grids → single column on mobile */
      @media (max-width: 640px) {
        .etf-two-col {
          grid-template-columns: 1fr !important;
        }
        .etf-field-row {
          grid-template-columns: 1fr !important;
        }
        .etf-stats-row {
          grid-template-columns: 1fr !important;
        }
        .etf-how-row {
          grid-template-columns: 1fr !important;
        }
        .etf-dash-header {
          padding: 24px 16px 16px !important;
        }
        .etf-tab-panel {
          padding: 16px !important;
        }
        .etf-event-header {
          padding: 16px !important;
          flex-direction: column !important;
          gap: 12px !important;
        }
        .etf-event-header-stats {
          flex-wrap: wrap !important;
          gap: 8px !important;
        }
      }

      /* Tabs — horizontal scroll on mobile */
      @media (max-width: 768px) {
        .etf-tabs {
          overflow-x: auto !important;
          flex-wrap: nowrap !important;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .etf-tabs::-webkit-scrollbar { display: none; }
        .etf-tab {
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }
        .etf-intake-card {
          flex-direction: column !important;
        }
        .etf-intake-card-actions {
          flex-direction: row !important;
          width: 100% !important;
        }
      }

      /* Bigger touch targets on mobile */
      @media (max-width: 768px) {
        input, select, textarea {
          font-size: 16px !important; /* prevents iOS zoom */
          min-height: 44px;
        }
        button {
          min-height: 44px;
        }
        .etf-tab {
          padding: 10px 14px !important;
          font-size: 12px !important;
        }
      }

      /* Dashboard stats — tablet */
      @media (max-width: 900px) {
        .etf-stats-row {
          grid-template-columns: 1fr 1fr !important;
        }
      }
    `}</style>
  );
}

// ————————————————————————————————————————————————————————————————
// Styles
// ————————————————————————————————————————————————————————————————
const SERIF = `'Fraunces', Georgia, serif`;
const SANS = `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
const BG = "#F7F5EF";
const INK = "#1E4536";
const MUTED = "#6C7065";
const LINE = "#DFDDD0";
const ACCENT = "#B04E31";
const ACCENT_SOFT = "#FBE4D8";

const styles = {
  app: {
    display: "flex",
    minHeight: "100vh",
    background: BG,
    color: INK,
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 1.5,
  },
  loadingScreen: {
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: "100vh", background: BG, fontFamily: SERIF,
  },
  loadingText: { color: MUTED, fontSize: 18, fontStyle: "italic" },

  // Sidebar
  sidebar: {
    width: 260,
    background: "#1E4536",
    borderRight: "none",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    height: "100vh",
    overflow: "hidden",
    flexShrink: 0,
  },
  brand: {
    padding: "24px 20px 20px",
    display: "flex", gap: 12, alignItems: "center",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  brandMark: {
    width: 36, height: 36,
    background: "#E0784E",
    color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: SERIF, fontWeight: 700, fontSize: 14,
    letterSpacing: ".5px",
    borderRadius: 14,
  },
  brandTitle: { fontFamily: SERIF, fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", color: "#F7F5EF" },
  brandSub: { fontSize: 10.5, color: "#9FB8A9", textTransform: "uppercase", letterSpacing: ".1em" },
  newBtn: {
    margin: "16px 20px 0",
    padding: "10px 14px",
    background: "#E0784E",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: ".02em",
    display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
  },
  sidebarLabel: {
    display: "flex", justifyContent: "space-between",
    padding: "20px 20px 8px",
    fontSize: 10.5,
    color: "#9FB8A9",
    textTransform: "uppercase",
    letterSpacing: ".1em",
    fontWeight: 600,
  },
  count: {
    background: "rgba(255,255,255,0.12)",
    color: "#F7F5EF",
    padding: "1px 7px",
    borderRadius: 10,
    fontSize: 10,
  },
  eventList: { flex: 1, overflow: "auto", padding: "0 8px" },
  emptyList: { padding: 16, color: "#9FB8A9", fontSize: 12, fontStyle: "italic" },
  eventItem: {
    position: "relative",
    padding: "10px 12px",
    borderRadius: 14,
    marginBottom: 2,
    cursor: "pointer",
    transition: "background .15s",
  },
  eventItemActive: { background: "rgba(212,120,74,0.25)" },
  eventItemName: {
    fontSize: 13,
    fontWeight: 500,
    color: "#F7F5EF",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingRight: 20,
  },
  eventItemMeta: {
    fontSize: 11,
    color: "#9FB8A9",
    marginTop: 3,
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  deleteBtn: {
    position: "absolute",
    right: 6,
    top: 8,
    background: "transparent",
    border: "none",
    color: "#9FB8A9",
    padding: 4,
    opacity: 0.5,
  },
  sidebarFooter: {
    padding: "12px 20px",
    fontSize: 10.5,
    color: "#9FB8A9",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
    background: "#1E4536",
  },

  // Main
  main: { flex: 1, minWidth: 0, overflow: "auto" },

  // Dashboard
  dashboard: { maxWidth: 960, margin: "0 auto", padding: "clamp(16px, 4vw, 48px) clamp(16px, 4vw, 40px)" },
  dashHeader: { marginBottom: 32 },

  eyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".15em",
    color: ACCENT,
    fontWeight: 600,
    marginBottom: 16,
  },
  h1: {
    fontFamily: SERIF,
    fontSize: 48,
    lineHeight: 1.05,
    fontWeight: 500,
    letterSpacing: "-.02em",
    margin: "0 0 20px",
  },
  lede: {
    fontSize: 16,
    lineHeight: 1.6,
    color: MUTED,
    maxWidth: 680,
    margin: 0,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 48,
  },
  statCard: {
    background: "#fff",
    border: `1px solid ${LINE}`,
    borderRadius: 14,
    padding: "20px 22px",
    display: "flex",
    gap: 14,
    alignItems: "center",
  },
  statIcon: {
    width: 36, height: 36,
    background: ACCENT_SOFT,
    color: ACCENT,
    borderRadius: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 12,
  },
  statLabel: { fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, marginBottom: 4 },
  statValue: { fontFamily: SERIF, fontSize: 24, fontWeight: 600, letterSpacing: "-.01em" },

  quickStart: { marginBottom: 56 },
  h2: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: 500,
    letterSpacing: "-.01em",
    marginBottom: 24,
  },
  flowGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
  },
  flowCard: {
    background: "#fff",
    border: `1px solid ${LINE}`,
    padding: "24px 22px",
  },
  flowNum: {
    fontFamily: SERIF,
    fontSize: 32,
    fontWeight: 300,
    color: ACCENT,
    fontStyle: "italic",
    marginBottom: 8,
    letterSpacing: "-.02em",
  },
  flowTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 6,
  },
  flowDesc: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 1.5,
  },

  recentSection: { marginBottom: 40 },
  recentList: { display: "flex", flexDirection: "column", gap: 8 },
  recentCard: {
    background: "#fff",
    border: `1px solid ${LINE}`,
    padding: "16px 20px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "border-color .15s, transform .15s",
  },
  recentName: { fontFamily: SERIF, fontSize: 18, fontWeight: 500 },
  recentMeta: { fontSize: 12.5, color: MUTED, marginTop: 3 },
  recentStats: { display: "flex", gap: 20, alignItems: "center" },
  recentStat: { textAlign: "right" },
  recentStatLabel: { fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 },
  recentStatValue: { fontFamily: SERIF, fontSize: 17, fontWeight: 600, marginTop: 2 },

  ctaRow: { display: "flex", justifyContent: "center" },
  ctaPrimary: {
    padding: "14px 28px",
    background: INK,
    color: BG,
    border: "none",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: ".01em",
    display: "flex", gap: 10, alignItems: "center",
  },

  pill: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: ".02em",
  },
  recPill: {
    display: "inline-block",
    padding: "5px 12px",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: ".05em",
    textTransform: "uppercase",
    borderRadius: 3,
  },

  // Event view
  eventView: { maxWidth: 1100, margin: "0 auto", padding: "36px 40px 60px" },
  eventHeader: { marginBottom: 24 },
  eventTitleInput: {
    width: "100%",
    fontFamily: SERIF,
    fontSize: 36,
    fontWeight: 500,
    letterSpacing: "-.02em",
    border: "none",
    borderBottom: `2px solid transparent`,
    padding: "4px 0 10px",
    background: "transparent",
    color: INK,
    marginBottom: 20,
  },
  eventHeaderMeta: {
    display: "flex",
    gap: 32,
    paddingBottom: 20,
    borderBottom: `1px solid ${LINE}`,
  },
  headerStat: { display: "flex", flexDirection: "column", gap: 4 },
  headerStatLabel: { fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600 },
  headerStatValue: { fontFamily: SERIF, fontSize: 20, fontWeight: 600 },
  statusSelect: {
    padding: "3px 8px",
    fontSize: 12,
    border: `1px solid ${LINE}`,
    background: "#fff",
    fontWeight: 500,
    borderRadius: 14,
  },

  tabs: {
    display: "flex",
    gap: 4,
    marginBottom: 32,
    borderBottom: `1px solid ${LINE}`,
    flexWrap: "wrap",
  },
  tab: {
    padding: "10px 16px",
    background: "transparent",
    border: "none",
    borderBottom: `2px solid transparent`,
    borderRadius: "8px 8px 0 0",
    fontSize: 13,
    color: MUTED,
    fontWeight: 500,
    display: "flex", alignItems: "center", gap: 6,
    marginBottom: -1,
  },
  tabActive: {
    color: INK,
    borderBottomColor: ACCENT,
    fontWeight: 600,
    background: "rgba(154,87,45,0.06)",
  },

  tabPanel: { paddingBottom: 40 },

  section: {
    background: "#fff",
    border: `1px solid ${LINE}`,
    borderRadius: 14,
    padding: "24px 26px",
    marginBottom: 20,
  },
  sectionHeader: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: "-.01em",
    margin: 0,
  },
  sectionSub: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
  },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 20,
  },
  field: { marginBottom: 14 },
  fieldLabel: {
    display: "block",
    fontSize: 11,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    fontWeight: 600,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    border: `1px solid ${LINE}`,
    background: "#fff",
    fontSize: 13.5,
    color: INK,
    borderRadius: 3,
  },
  twoFields: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  threeFields: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 },

  checkRow: { display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: INK, cursor: "pointer", padding: "4px 0" },

  estimateBanner: {
    background: ACCENT_SOFT,
    padding: "16px 18px",
    marginTop: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 3,
  },
  estimateLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#78350f", fontWeight: 600 },
  estimateNum: { fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: "#78350f", marginTop: 2 },
  textBtn: {
    background: "transparent",
    border: "none",
    color: ACCENT,
    fontWeight: 600,
    fontSize: 13,
    display: "flex", alignItems: "center", gap: 4,
    padding: 4,
  },

  summaryCard: {
    background: "#fff",
    border: `1px solid ${LINE}`,
    padding: "22px 22px",
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 600, marginBottom: 10 },
  summaryRationale: { fontSize: 13, color: MUTED, lineHeight: 1.55, marginTop: 12, marginBottom: 0 },
  summaryDivider: { height: 1, background: LINE, margin: "16px 0" },
  summaryStat: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "6px 0",
    fontSize: 13,
  },

  nextDeadline: {
    background: INK,
    color: BG,
    padding: "22px 22px",
    marginBottom: 16,
  },
  nextDeadlineLabel: { fontSize: 10.5, color: "#c5b8a8", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 600, marginBottom: 8 },
  nextDeadlineTitle: { fontFamily: SERIF, fontSize: 18, fontWeight: 500, lineHeight: 1.3 },
  nextDeadlineDate: { fontFamily: SERIF, fontSize: 24, fontWeight: 600, marginTop: 8, marginBottom: 12 },

  eligibilitySummary: {
    background: "#fff",
    border: `1px solid ${LINE}`,
    padding: "22px 22px",
  },
  checkSummary: {
    display: "flex", gap: 10, alignItems: "flex-start",
    padding: "8px 0",
    borderTop: `1px solid ${LINE}`,
  },
  checkSummaryLabel: { fontSize: 12.5, fontWeight: 500 },
  checkSummaryDetail: { fontSize: 11.5, color: MUTED, marginTop: 2 },

  // Decision
  question: {
    padding: "16px 0",
    borderTop: `1px solid ${LINE}`,
  },
  questionText: { fontFamily: SERIF, fontSize: 16, fontWeight: 500, marginBottom: 6, lineHeight: 1.35 },
  questionHelp: { fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginBottom: 12 },
  yesNoRow: { display: "flex", gap: 8 },
  ynBtn: {
    padding: "7px 16px",
    background: "#fff",
    border: `1px solid ${LINE}`,
    fontSize: 12.5,
    fontWeight: 600,
    display: "flex", gap: 6, alignItems: "center",
    color: MUTED,
  },
  ynYes: { background: "#065f46", borderColor: "#065f46", color: "#fff" },
  ynNo: { background: "#7f1d1d", borderColor: "#7f1d1d", color: "#fff" },

  thresholdGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
  },
  thresholdCard: {
    padding: "16px 14px",
    transition: "transform .2s",
    borderRadius: 10,
  },
  thresholdRange: { fontFamily: SERIF, fontSize: 18, fontWeight: 700, marginBottom: 4 },
  thresholdLabel: { fontSize: 12, fontWeight: 500 },
  thresholdCurrent: { fontSize: 10.5, marginTop: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" },

  finalCard: {
    padding: "22px 24px",
    background: "#fff",
    borderLeft: `4px solid`,
  },
  finalRationale: { fontSize: 14, marginTop: 12, lineHeight: 1.55, color: INK },
  finalDetail: { display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 },

  // Calculator
  emptyState: {
    padding: "40px 20px",
    textAlign: "center",
    color: MUTED,
    display: "flex", flexDirection: "column", gap: 12, alignItems: "center",
  },
  addBtn: {
    padding: "8px 14px",
    background: INK,
    color: BG,
    border: "none",
    fontSize: 12.5,
    fontWeight: 600,
    display: "inline-flex", gap: 6, alignItems: "center",
    marginTop: 8,
  },
  tableWrap: { overflowX: "auto", marginBottom: 10 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  th: {
    textAlign: "left",
    padding: "8px 6px",
    fontWeight: 600,
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    color: MUTED,
    borderBottom: `1px solid ${LINE}`,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "4px 6px",
    borderBottom: `1px solid ${LINE}`,
  },
  tableInput: {
    width: "100%",
    padding: "5px 8px",
    border: `1px solid transparent`,
    background: "transparent",
    fontSize: 12.5,
    fontFamily: "inherit",
    borderRadius: 2,
  },
  tableNumInput: {
    width: 65,
    padding: "5px 8px",
    border: `1px solid transparent`,
    background: "transparent",
    fontSize: 12.5,
    textAlign: "right",
    fontFamily: "inherit",
    borderRadius: 2,
  },
  iconBtn: {
    padding: 4,
    background: "transparent",
    border: "none",
    color: MUTED,
  },

  mixBanner: {
    padding: "8px 12px",
    fontSize: 12.5,
    fontWeight: 500,
    borderRadius: 3,
    marginTop: 4,
  },

  ratesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 14,
  },

  resultsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 20,
  },
  resultCard: {
    padding: "18px 18px",
    background: "#F1EFE6",
    border: `1px solid ${LINE}`,
  },
  resultIcon: { color: ACCENT, marginBottom: 8 },
  resultLabel: { fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 },
  resultValue: { fontFamily: SERIF, fontSize: 26, fontWeight: 600, marginTop: 4 },
  resultSub: { fontSize: 11.5, color: MUTED, marginTop: 4 },

  breakdownTable: {
    background: "#F1EFE6",
    padding: "12px 16px",
    marginBottom: 16,
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 13,
    borderBottom: `1px solid ${LINE}`,
  },

  fundCallout: {
    background: INK,
    color: BG,
    padding: "18px 22px",
    marginBottom: 16,
  },
  fundRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 13.5,
  },
  fundRowTotal: {
    borderTop: `1px solid rgba(255,255,255,.2)`,
    marginTop: 8,
    paddingTop: 12,
    fontFamily: SERIF,
    fontSize: 17,
    fontWeight: 600,
  },

  benchmark: {
    padding: "12px 16px",
    background: ACCENT_SOFT,
    color: "#78350f",
    fontSize: 12.5,
    lineHeight: 1.5,
    borderRadius: 3,
  },

  // Timeline
  timeline: { position: "relative" },
  timelineRow: {
    display: "flex",
    gap: 16,
    position: "relative",
  },
  timelineLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 16,
    paddingTop: 6,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    border: `2px solid ${LINE}`,
    background: "#fff",
    flexShrink: 0,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    background: LINE,
    marginTop: 2,
  },
  timelineCard: {
    flex: 1,
    background: "#fff",
    border: `1px solid ${LINE}`,
    padding: "12px 16px",
    marginBottom: 10,
  },
  timelineCardEvent: {
    background: INK,
    color: BG,
    borderColor: INK,
  },
  timelineCardCritical: {
    borderLeft: `3px solid ${ACCENT}`,
  },
  timelineHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  timelineLabel: { fontSize: 14, fontWeight: 600 },
  criticalBadge: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: ".08em",
    color: ACCENT,
    background: ACCENT_SOFT,
    padding: "2px 6px",
    borderRadius: 2,
  },
  timelineDate: {
    fontSize: 12.5,
    color: "inherit",
    opacity: 0.8,
    marginTop: 4,
    display: "flex",
    gap: 10,
    alignItems: "baseline",
  },
  timelineOffset: { fontSize: 11, opacity: 0.7 },
  timelineCountdown: { fontSize: 11, marginTop: 4, fontWeight: 600, opacity: 0.7 },
  timelineRef: { fontSize: 10.5, color: MUTED, marginTop: 6, fontStyle: "italic" },

  notesList: { margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 },

  // Documents
  progressBar: {
    height: 6,
    background: LINE,
    borderRadius: 3,
    marginBottom: 20,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#059669",
    transition: "width .3s",
  },
  phaseGroup: { marginBottom: 20 },
  phaseLabel: {
    fontSize: 11,
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: ".12em",
    fontWeight: 700,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1px solid ${LINE}`,
  },
  docRow: {
    display: "flex",
    gap: 14,
    padding: "12px 14px",
    background: "#F1EFE6",
    marginBottom: 6,
    alignItems: "flex-start",
    borderRadius: 3,
    transition: "background .15s",
  },
  docRowDone: { background: "#f0fdf4" },
  docCheck: {
    padding: 0,
    background: "transparent",
    border: "none",
    display: "flex",
    alignItems: "center",
  },
  docLabel: { fontSize: 13.5, fontWeight: 600, marginBottom: 3 },
  docDesc: { fontSize: 12, color: MUTED, lineHeight: 1.5 },
  dateMini: {
    padding: "4px 8px",
    border: `1px solid ${LINE}`,
    fontSize: 11.5,
    borderRadius: 3,
  },

  submissionBox: {
    background: ACCENT_SOFT,
    padding: "14px 18px",
    fontSize: 13,
    lineHeight: 1.8,
    color: "#78350f",
    borderRadius: 3,
  },

  // Costs
  filterRow: { display: "flex", gap: 6, marginBottom: 16 },
  filterBtn: {
    padding: "7px 14px",
    background: "#fff",
    border: `1px solid ${LINE}`,
    fontSize: 12.5,
    fontWeight: 500,
    color: MUTED,
    borderRadius: 3,
  },
  filterActive: {
    background: INK,
    color: BG,
    borderColor: INK,
    fontWeight: 600,
  },
  costList: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 8 },
  costItem: {
    display: "flex",
    gap: 10,
    padding: "10px 14px",
    borderLeft: `3px solid`,
    fontSize: 13,
    lineHeight: 1.45,
  },
  rulesBox: { background: "#F1EFE6", padding: "16px 20px", borderRadius: 3 },
  ruleH: { fontFamily: SERIF, fontSize: 15, fontWeight: 600, margin: "12px 0 6px" },
  rulesList: { margin: "4px 0 8px", paddingLeft: 20, fontSize: 13, lineHeight: 1.7 },

  // Reference
  accordion: {
    borderBottom: `1px solid ${LINE}`,
  },
  accordionHeader: {
    width: "100%",
    textAlign: "left",
    padding: "14px 4px",
    background: "transparent",
    border: "none",
    fontFamily: SERIF,
    fontSize: 16,
    fontWeight: 500,
    display: "flex",
    gap: 10,
    alignItems: "center",
    color: INK,
  },
  accordionBody: {
    padding: "4px 4px 18px 30px",
    fontSize: 13.5,
    lineHeight: 1.65,
    color: INK,
  },
};
