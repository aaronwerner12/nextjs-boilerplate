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
// Texas ETF Pursuit Tool — monday.com Edition
// Shared team tool: events sync to/from a monday.com board so the
// whole team sees the same pipeline.
// NOT an official state form. NOT affiliated with EDT.
// ————————————————————————————————————————————————————————————————

// ————————————————————————————————————————————————————————————————
// Monday.com API layer
// All calls go through the v2 GraphQL endpoint.
// Token and board ID are stored in localStorage (browser-only).
// ————————————————————————————————————————————————————————————————
const MONDAY_API = "https://api.monday.com/v2";

const mondayQuery = async (token, query, variables = {}) => {
  const res = await fetch(MONDAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token,
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
};

// Column IDs we'll use — created once, stored in localStorage
const COL = {
  status:       "status",
  firstDay:     "date4",
  lastDay:      "date",
  siteOrg:      "text",
  projectedFund:"numbers",
  localMatch:   "numbers1",
  roomNights:   "numbers2",
  outOfMarket:  "numbers3",
  recommendation: "text1",
  eligPass:     "checkbox",
  hotelBlock:   "checkbox1",
  appDeadline:  "date0",
  docsComplete: "numbers4",
  notes:        "long_text",
  mondayId:     "__monday_item_id__", // not a real column — stored in event obj
};

// Convert a local event object → Monday column values (only safe text/number fields)
// We write to columns by their auto-generated IDs after creation.
// To avoid errors from missing columns, we catch per-column and continue.
const eventToMondaySimple = (event, calc, decision) => {
  const appDeadline = event.firstDay
    ? addDays(event.firstDay, -120)?.toISOString().split("T")[0]
    : null;
  const docsComplete = event.docs
    ? Object.values(event.docs).filter((d) => d.done).length
    : 0;
  // Return a plain object of label→value pairs we'll set via name-based lookup
  return {
    "Projected Fund":   Math.round(decision?.estimate || 0),
    "Local Match":      Math.round(calc?.requiredLocalMatch || 0),
    "Room Nights":      Math.round(event.roomNights || calc?.totalRoomNights || 0),
    "Out-of-Market %":  event.outOfMarketPct || 0,
    "Recommendation":   decision?.recommendation || "",
    "Docs Complete":    docsComplete,
    "Notes":            event.notes || "",
    "Status":           STATUS_LABELS[event.status] || "Analysis",
  };
};

// Write simple column values by fetching column IDs from the board first
const updateBoardItemSafe = async (token, boardId, itemId, labelValueMap) => {
  // Get board columns to find IDs by title
  let cols = [];
  try {
    const data = await mondayQuery(token, `{ boards(ids:[${boardId}]){ columns { id title type } } }`);
    cols = data?.boards?.[0]?.columns || [];
  } catch (_) { return; }

  const colValues = {};
  Object.entries(labelValueMap).forEach(([title, value]) => {
    const col = cols.find((c) => c.title === title);
    if (!col) return;
    if (col.type === "numeric" || col.type === "numbers") {
      colValues[col.id] = String(value);
    } else if (col.type === "color" || col.type === "status") {
      colValues[col.id] = JSON.stringify({ label: String(value) });
    } else if (col.type === "long_text") {
      colValues[col.id] = JSON.stringify({ text: String(value) });
    } else {
      colValues[col.id] = String(value);
    }
  });

  if (Object.keys(colValues).length === 0) return;
  const colValStr = JSON.stringify(JSON.stringify(colValues));
  try {
    await mondayQuery(token, `
      mutation {
        change_multiple_column_values(board_id: ${boardId}, item_id: ${itemId}, column_values: ${colValStr}) { id }
      }
    `);
  } catch (_) { /* ignore column errors */ }
};

// Status label map (Monday status column uses label text)
const STATUS_LABELS = {
  analysis:    "Analysis",
  application: "Application",
  approved:    "Approved",
  "post-event":"Post-Event",
  complete:    "Complete",
};

// Create all needed columns on the board (idempotent — safe to call multiple times)
const ensureBoardColumns = async (token, boardId) => {
  // We'll use Monday's "create_column" mutation — if columns already exist it'll error, we just ignore those errors
  const cols = [
    { title: "Status",             column_type: "color" },
    { title: "First Day",          column_type: "date" },
    { title: "Last Day",           column_type: "date" },
    { title: "Site Selection Org", column_type: "text" },
    { title: "Projected Fund",     column_type: "numeric" },
    { title: "Local Match",        column_type: "numeric" },
    { title: "Room Nights",        column_type: "numeric" },
    { title: "Out-of-Market %",    column_type: "numeric" },
    { title: "Recommendation",     column_type: "text" },
    { title: "Eligibility Pass",   column_type: "checkbox" },
    { title: "Hotel Block",        column_type: "checkbox" },
    { title: "App Deadline",       column_type: "date" },
    { title: "Docs Complete",      column_type: "numeric" },
    { title: "Notes",              column_type: "long_text" },
  ];
  // Fire-and-forget — columns may already exist
  for (const col of cols) {
    try {
      await mondayQuery(token, `
        mutation {
          create_column(board_id: ${boardId}, title: "${col.title}", column_type: ${col.column_type}) { id }
        }
      `);
    } catch (_) { /* column likely already exists */ }
  }
};

// Fetch all items from the board and map to local event summaries
const fetchBoardItems = async (token, boardId) => {
  const data = await mondayQuery(token, `
    {
      boards(ids: [${boardId}]) {
        items_page(limit: 200) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `);
  return data?.boards?.[0]?.items_page?.items || [];
};

// Create a new item on the board, return the Monday item ID
const createBoardItem = async (token, boardId, name) => {
  const data = await mondayQuery(token, `
    mutation {
      create_item(board_id: ${boardId}, item_name: "${name.replace(/"/g, "'")}") { id }
    }
  `);
  return data?.create_item?.id;
};

// Update column values for an existing item
const updateBoardItem = async (token, boardId, itemId, columnValues) => {
  // Remove nulls
  const clean = {};
  Object.entries(columnValues).forEach(([k, v]) => {
    if (v !== null && v !== undefined && k !== COL.mondayId) clean[k] = v;
  });
  const colValStr = JSON.stringify(JSON.stringify(clean));
  await mondayQuery(token, `
    mutation {
      change_multiple_column_values(board_id: ${boardId}, item_id: ${itemId}, column_values: ${colValStr}) { id }
    }
  `);
};

// Delete an item from the board
const deleteBoardItem = async (token, boardId, itemId) => {
  await mondayQuery(token, `
    mutation { delete_item(item_id: ${itemId}) { id } }
  `);
};

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
});

// Categories for attendee mix
const ATTENDEE_CATS = [
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
const TIMELINE = [
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
function calculateTrustFund(event) {
  const { calc, roomNights, outOfMarketPct, attendeeEst, qualityPerAttendee } = event;

  // Quick estimate if no detailed calc
  const quickEstimate = (attendeeEst || 0) * (qualityPerAttendee || 0);

  // Detailed calc (following the Adidas EIS pattern)
  const totalDays = calc.days.length;
  let totalAttendance = 0;
  let totalHotelSpend = 0;
  let totalFoodBev = 0;
  let totalEntertainment = 0;
  let totalAlcohol = 0;
  let totalCarRental = 0;
  let totalRoomNights = 0;

  // Mix fractions
  const mixOOS = (calc.mix.outOfState || 0) / 100;
  const mixTX = (calc.mix.texasOutOfMarket || 0) / 100;
  // Day visitors don't contribute to hotel/incremental tax in same way
  // but still generate food/entertainment sales tax
  const r = calc.rates;

  // Sum attendee-days across all categories and days
  calc.days.forEach((day) => {
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
  };
}

// ————————————————————————————————————————————————————————————————
// Decision framework — pursuit evaluation logic
// ————————————————————————————————————————————————————————————————
function evaluateDecision(event, calcResult) {
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
    label: "ETF value exceeds $75K viability floor",
    pass: estimate >= 75000,
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
  } else if (estimate < 75000) {
    recommendation = "DO NOT PURSUE";
    rationale = "Projected ETF value below $75K — administrative burden likely exceeds the fund value.";
  } else if (estimate >= 300000) {
    recommendation = "STRATEGIC PRIORITY";
    rationale = "High-value event meeting all criteria. Move to application immediately.";
  } else if (estimate >= 150000) {
    recommendation = "STRONG PURSUE";
    rationale = "Solid ETF value with eligibility intact. Proceed with application.";
  } else {
    recommendation = "PURSUE WITH CONDITIONS";
    rationale = "Moderate ETF value. Validate room block and out-of-market assumptions before committing.";
  }

  return { checks, recommendation, rationale, estimate };
}

// ————————————————————————————————————————————————————————————————
// Component — Main App (Monday.com edition)
// ————————————————————————————————————————————————————————————————
export default function ETFPlaybook() {
  const [events, setEvents] = useState([]);
  const [currentEventId, setCurrentEventId] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(""); // "saving" | "saved" | "error" | "syncing" | "synced"
  const [showSettings, setShowSettings] = useState(false);

  // Monday config — initialized empty, loaded from localStorage in useEffect (SSR-safe)
  const [mondayToken, setMondayToken] = useState("");
  const [mondayBoardId, setMondayBoardId] = useState("18410218031");
  const mondayEnabled = !!(mondayToken && mondayBoardId);

  // ── Load: first from localStorage, then sync from Monday ──────
  useEffect(() => {
    // Safe to access localStorage here — this only runs in the browser
    const storedToken = localStorage.getItem("etf_monday_token") || "";
    const storedBoard = localStorage.getItem("etf_monday_board") || "18410218031";
    if (storedToken) setMondayToken(storedToken);
    if (storedBoard) setMondayBoardId(storedBoard);

    (async () => {
      // 1. Load local cache immediately so UI is fast
      try {
        const raw = localStorage.getItem("etf_events_cache");
        if (raw) setEvents(JSON.parse(raw));
      } catch (_) {}

      // 2. If Monday is configured, pull latest from board
      if (storedToken && storedBoard) {
        try {
          setSaveStatus("syncing");
          // Ensure columns exist on the board (safe to call repeatedly)
          await ensureBoardColumns(storedToken, storedBoard);
          const items = await fetchBoardItems(storedToken, storedBoard);
          if (items.length > 0) {
            // Merge Monday items with local cache — Monday is source of truth for shared fields
            setEvents((prev) => {
              const merged = [...prev];
              items.forEach((item) => {
                const existing = merged.find((e) => e.mondayItemId === item.id);
                if (!existing) {
                  // New item from Monday — add as minimal event
                  merged.push({
                    ...blankEvent(),
                    id: "mon_" + item.id,
                    mondayItemId: item.id,
                    name: item.name,
                  });
                }
              });
              return merged;
            });
          }
          setSaveStatus("synced");
          setTimeout(() => setSaveStatus(""), 2000);
        } catch (e) {
          setSaveStatus("error");
        }
      }
      setLoading(false);
    })();
  }, [mondayToken, mondayBoardId]);

  // ── Save: local cache always, Monday when configured ──────────
  const syncToMonday = async (eventsToSync) => {
    if (!mondayEnabled) return;
    setSaveStatus("syncing");
    try {
      // Fetch current Monday items to use as dedup reference
      let existingItems = [];
      try {
        existingItems = await fetchBoardItems(mondayToken, mondayBoardId);
      } catch (_) {}

      const updatedEvents = [...eventsToSync];

      for (let i = 0; i < updatedEvents.length; i++) {
        const event = updatedEvents[i];
        if (!event.name) continue; // skip unnamed events

        const calc = calculateTrustFund(event);
        const decision = evaluateDecision(event, calc);

        // Find Monday item by stored ID first, then fall back to name match
        let mondayId = event.mondayItemId;
        if (!mondayId) {
          const match = existingItems.find((item) => item.name === event.name);
          if (match) mondayId = match.id;
        }

        if (mondayId) {
          // Update existing item
          await updateBoardItemSafe(mondayToken, mondayBoardId, mondayId, eventToMondaySimple(event, calc, decision));
          updatedEvents[i] = { ...event, mondayItemId: mondayId };
        } else {
          // Create new item — only if no match found on board
          const newId = await createBoardItem(mondayToken, mondayBoardId, event.name);
          if (newId) {
            await updateBoardItemSafe(mondayToken, mondayBoardId, newId, eventToMondaySimple(event, calc, decision));
            updatedEvents[i] = { ...event, mondayItemId: newId };
          }
        }
      }

      // Persist updated events (with mondayItemIds) to local cache
      localStorage.setItem("etf_events_cache", JSON.stringify(updatedEvents));
      setEvents(updatedEvents);

      setSaveStatus("synced");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (e) {
      console.error("Monday sync error:", e);
      setSaveStatus("error");
    }
  };

  useEffect(() => {
    if (loading) return;
    // Always save to local cache immediately
    localStorage.setItem("etf_events_cache", JSON.stringify(events));
    // Debounce Monday sync
    const t = setTimeout(() => syncToMonday(events), 2000);
    return () => clearTimeout(t);
  }, [events, loading]);

  const currentEvent = events.find((e) => e.id === currentEventId);

  const updateEvent = (updater) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === currentEventId ? updater(e) : e))
    );
  };

  const createEvent = () => {
    const e = blankEvent();
    setEvents((prev) => [e, ...prev]);
    setCurrentEventId(e.id);
    setTab("overview");
  };

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this event and all its data?")) return;
    const event = events.find((e) => e.id === id);
    if (event?.mondayItemId && mondayEnabled) {
      try { await deleteBoardItem(mondayToken, mondayBoardId, event.mondayItemId); } catch (_) {}
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (currentEventId === id) setCurrentEventId(null);
  };

  const saveSettings = (token, boardId) => {
    localStorage.setItem("etf_monday_token", token);
    localStorage.setItem("etf_monday_board", boardId);
    setMondayToken(token);
    setMondayBoardId(boardId);
    setShowSettings(false);
  };

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingText}>
          {mondayEnabled ? "Syncing with monday.com…" : "Loading ETF Pursuit Tool…"}
        </div>
      </div>
    );
  }

  if (showSettings) {
    return (
      <SettingsScreen
        initialToken={mondayToken}
        initialBoardId={mondayBoardId}
        onSave={saveSettings}
        onCancel={() => setShowSettings(false)}
      />
    );
  }

  return (
    <div style={styles.app}>
      <GlobalStyles />
      <Sidebar
        events={events}
        currentEventId={currentEventId}
        onSelect={(id) => { setCurrentEventId(id); setTab("overview"); }}
        onCreate={createEvent}
        onDelete={deleteEvent}
        onHome={() => { setCurrentEventId(null); setTab("dashboard"); }}
        saveStatus={saveStatus}
        mondayEnabled={mondayEnabled}
        onSettings={() => setShowSettings(true)}
      />
      <main style={styles.main}>
        {!currentEvent ? (
          <Dashboard
            events={events}
            onOpen={(id) => { setCurrentEventId(id); setTab("overview"); }}
            onCreate={createEvent}
            mondayEnabled={mondayEnabled}
            onSettings={() => setShowSettings(true)}
          />
        ) : (
          <EventView
            event={currentEvent}
            update={updateEvent}
            tab={tab}
            setTab={setTab}
          />
        )}
      </main>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Settings Screen — Monday.com configuration
// ————————————————————————————————————————————————————————————————
function SettingsScreen({ initialToken, initialBoardId, onSave, onCancel }) {
  const [token, setToken] = useState(initialToken);
  const [boardId, setBoardId] = useState(initialBoardId);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await mondayQuery(token, `{ me { name email } boards(ids: [${boardId}]) { name } }`);
      setTestResult({
        ok: true,
        msg: `Connected as ${data.me.name} · Board: "${data.boards?.[0]?.name || boardId}"`,
      });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message });
    }
    setTesting(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", border: "1px solid #e8e3db", borderRadius: 6, padding: 40, maxWidth: 540, width: "100%" }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 600, marginBottom: 6 }}>
          monday.com Settings
        </div>
        <p style={{ fontSize: 13.5, color: "#6b6660", marginBottom: 28, lineHeight: 1.6 }}>
          Connect to your monday.com board so your whole team shares the same ETF pipeline. Your token is stored only in this browser.
        </p>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#6b6660", display: "block", marginBottom: 6 }}>
            API Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your monday.com API token"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8e3db", borderRadius: 4, fontSize: 13.5, fontFamily: "monospace", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 5 }}>
            monday.com → Profile picture → Developers → My Access Tokens
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#6b6660", display: "block", marginBottom: 6 }}>
            Board ID
          </label>
          <input
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            placeholder="e.g. 18410218031"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #e8e3db", borderRadius: 4, fontSize: 13.5, fontFamily: "monospace", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 5 }}>
            Found in the board URL: monday.com/boards/<strong>XXXXXXXXXX</strong>
          </div>
        </div>

        {testResult && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 4,
            marginBottom: 20,
            fontSize: 13,
            background: testResult.ok ? "#f0fdf4" : "#fef2f2",
            color: testResult.ok ? "#065f46" : "#991b1b",
            border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}`,
          }}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={testConnection}
            disabled={!token || !boardId || testing}
            style={{ padding: "10px 18px", background: "#fff", border: "1px solid #e8e3db", borderRadius: 4, fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <button
            onClick={() => onSave(token, boardId)}
            disabled={!token || !boardId}
            style={{ padding: "10px 18px", background: "#1a1613", color: "#fff", border: "none", borderRadius: 4, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
          >
            Save & Connect
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{ padding: "10px 14px", background: "transparent", border: "none", fontSize: 13.5, color: "#6b6660", cursor: "pointer" }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Sidebar
// ————————————————————————————————————————————————————————————————
function Sidebar({ events, currentEventId, onSelect, onCreate, onDelete, onHome, saveStatus, mondayEnabled, onSettings }) {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand} onClick={onHome}>
        <div style={styles.brandMark}>ETF</div>
        <div>
          <div style={styles.brandTitle}>ETF Pursuit Tool</div>
          <div style={styles.brandSub}>Texas Events Trust Fund</div>
        </div>
      </div>

      <button style={styles.newBtn} onClick={onCreate}>
        <Plus size={14} /> New Event
      </button>

      <div style={styles.sidebarLabel}>
        <span>Your Events</span>
        <span style={styles.count}>{events.length}</span>
      </div>

      <div style={styles.eventList}>
        {events.length === 0 && (
          <div style={styles.emptyList}>
            No events yet. Click <em>New Event</em> to begin an analysis.
          </div>
        )}
        {events.map((e) => (
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
            <button
              style={styles.deleteBtn}
              onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
              aria-label="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <div style={styles.sidebarFooter}>
        <div style={{ marginBottom: 8 }}>
          {saveStatus === "syncing" && <span style={{ color: "#d97706" }}>⟳ Syncing to monday…</span>}
          {saveStatus === "synced"  && <span style={{ color: "#059669" }}>✓ Synced to monday</span>}
          {saveStatus === "error"   && <span style={{ color: "#dc2626" }}>✗ Sync error</span>}
          {!saveStatus && mondayEnabled && <span style={{ color: "#059669" }}>● monday.com connected</span>}
          {!saveStatus && !mondayEnabled && <span style={{ color: "#d97706" }}>○ monday not connected</span>}
        </div>
        <button
          onClick={onSettings}
          style={{ fontSize: 11, color: "#9ca3af", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
        >
          monday.com settings
        </button>
      </div>
    </aside>
  );
}

function StatusPill({ status }) {
  const colors = {
    analysis: { bg: "#fef3c7", fg: "#92400e", label: "Analysis" },
    application: { bg: "#dbeafe", fg: "#1e40af", label: "Application" },
    approved: { bg: "#d1fae5", fg: "#065f46", label: "Approved" },
    "post-event": { bg: "#ede9fe", fg: "#5b21b6", label: "Post-Event" },
    complete: { bg: "#e5e7eb", fg: "#374151", label: "Complete" },
  };
  const c = colors[status] || colors.analysis;
  return <span style={{ ...styles.pill, background: c.bg, color: c.fg }}>{c.label}</span>;
}

// ————————————————————————————————————————————————————————————————
// Dashboard (no event selected)
// ————————————————————————————————————————————————————————————————
function Dashboard({ events, onOpen, onCreate, mondayEnabled, onSettings }) {
  const stats = useMemo(() => {
    let projected = 0;
    let active = 0;
    events.forEach((e) => {
      const calc = calculateTrustFund(e);
      const est = calc.totalFund > 0 ? calc.totalFund : calc.quickEstimate;
      projected += est;
      if (e.status !== "complete") active++;
    });
    return { projected, active, total: events.length };
  }, [events]);

  return (
    <div style={styles.dashboard}>
      <header style={styles.dashHeader}>
        <div>
          <div style={styles.eyebrow}>Texas Events Trust Fund · Independent DMO Planning Tool</div>
          <h1 style={styles.h1}>
            <em>Events Trust Fund</em> evaluation and administration.
          </h1>
          <p style={styles.lede}>
            Analyze prospective events against ETF eligibility requirements,
            project state and local tax contributions, generate your complete deadline
            timeline, and track every required document from application through disbursement.
          </p>
          <div style={{
            marginTop: 14,
            padding: "10px 16px",
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderLeft: "3px solid #d97706",
            borderRadius: 3,
            fontSize: 12.5,
            color: "#78350f",
            lineHeight: 1.6,
          }}>
            <strong>⚠ Planning tool only.</strong> This tool is NOT affiliated with the Texas Office of the Governor or the Economic Development and Tourism division (EDT). It does not submit applications or constitute official program participation. All official submissions must be made directly to EDT at <strong>eventsfund@gov.texas.gov</strong> using the official state templates.
          </div>

          {mondayEnabled ? (
            <div style={{ marginTop: 10, padding: "10px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderLeft: "3px solid #059669", borderRadius: 3, fontSize: 12.5, color: "#065f46" }}>
              <strong>● monday.com connected</strong> — events sync automatically across your team.{" "}
              <button onClick={onSettings} style={{ background: "none", border: "none", color: "#065f46", textDecoration: "underline", cursor: "pointer", fontSize: 12.5, padding: 0 }}>Manage settings</button>
            </div>
          ) : (
            <div style={{ marginTop: 10, padding: "10px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "3px solid #d97706", borderRadius: 3, fontSize: 12.5, color: "#92400e" }}>
              <strong>○ monday.com not connected</strong> — events are saved in this browser only.{" "}
              <button onClick={onSettings} style={{ background: "none", border: "none", color: "#92400e", textDecoration: "underline", cursor: "pointer", fontSize: 12.5, padding: 0 }}>Connect now →</button>
            </div>
          )}
        </div>
      </header>

      <div style={styles.statGrid}>
        <StatCard label="Active Events" value={stats.active} icon={<Target size={16} />} />
        <StatCard label="Total in Pipeline" value={stats.total} icon={<Folder size={16} />} />
        <StatCard label="Projected Fund Value" value={fmtMoney(stats.projected)} icon={<DollarSign size={16} />} />
      </div>

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
function EventView({ event, update, tab, setTab }) {
  const calc = useMemo(() => calculateTrustFund(event), [event]);
  const decision = useMemo(() => evaluateDecision(event, calc), [event, calc]);

  const TABS = [
    { k: "overview", label: "Overview", icon: <Info size={14} /> },
    { k: "decision", label: "Decision Framework", icon: <Scale size={14} /> },
    { k: "calculator", label: "Impact Calculator", icon: <Calculator size={14} /> },
    { k: "timeline", label: "Timeline", icon: <Calendar size={14} /> },
    { k: "documents", label: "Documents", icon: <ClipboardList size={14} /> },
    { k: "costs", label: "Allowable Costs", icon: <DollarSign size={14} /> },
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
        </div>
      </header>

      <nav style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.k}
            style={{ ...styles.tab, ...(tab === t.k ? styles.tabActive : {}) }}
            onClick={() => setTab(t.k)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <div style={styles.tabPanel}>
        {tab === "overview" && <OverviewTab event={event} update={update} calc={calc} decision={decision} setTab={setTab} />}
        {tab === "decision" && <DecisionTab event={event} update={update} calc={calc} decision={decision} />}
        {tab === "calculator" && <CalculatorTab event={event} update={update} calc={calc} />}
        {tab === "timeline" && <TimelineTab event={event} update={update} />}
        {tab === "documents" && <DocumentsTab event={event} update={update} />}
        {tab === "costs" && <CostsTab />}
        {tab === "reference" && <ReferenceTab />}
      </div>
    </div>
  );
}

function RecPill({ rec }) {
  const map = {
    "STRATEGIC PRIORITY": { bg: "#064e3b", fg: "#ecfdf5" },
    "STRONG PURSUE": { bg: "#065f46", fg: "#d1fae5" },
    "PURSUE WITH CONDITIONS": { bg: "#92400e", fg: "#fef3c7" },
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
        <div style={{ ...windowStyles.light, ...windowStyles.gray }}>
          <div style={windowStyles.dot} />
        </div>
        <div style={windowStyles.body}>
          <div style={windowStyles.status}>Awaiting Event Date</div>
          <div style={windowStyles.detail}>
            Set the event's first day in Event Details below to calculate your 120-day application deadline.
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
      </div>

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
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: 20,
    alignItems: "center",
    padding: "18px 22px",
    background: "#fff",
    border: "1px solid #e8e3db",
    borderLeft: "4px solid #9ca3af",
    marginBottom: 20,
    borderRadius: 3,
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
  body: { minWidth: 0 },
  statusRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
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
    color: "#6b6660",
    textTransform: "uppercase",
    letterSpacing: ".1em",
    fontWeight: 600,
  },
  detail: {
    fontSize: 13,
    color: "#6b6660",
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
    color: "#6b6660",
    marginTop: 5,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    fontWeight: 500,
  },
  rule: {
    borderLeft: "1px solid #e8e3db",
    paddingLeft: 20,
    fontSize: 11.5,
    maxWidth: 220,
  },
  ruleLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".1em",
    color: "#6b6660",
    fontWeight: 700,
    marginBottom: 4,
  },
  ruleText: {
    fontSize: 12.5,
    color: "#1a1613",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  ruleCite: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 4,
    fontStyle: "italic",
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
    wrap: { borderLeftColor: "#d97706" },
    light: { background: "#fef3c7", boxShadow: "0 0 0 4px rgba(217, 119, 6, 0.15)" },
    dot: { background: "#d97706", boxShadow: "0 0 12px rgba(217, 119, 6, 0.6)" },
    bar: "#d97706",
    textColor: "#92400e",
  },
  red: {
    wrap: { borderLeftColor: "#dc2626" },
    light: { background: "#fee2e2", boxShadow: "0 0 0 4px rgba(220, 38, 38, 0.15)" },
    dot: { background: "#dc2626", boxShadow: "0 0 12px rgba(220, 38, 38, 0.6)" },
    bar: "#dc2626",
    textColor: "#991b1b",
  },
  black: {
    wrap: { borderLeftColor: "#1a1613" },
    light: { background: "#e5e7eb" },
    dot: { background: "#1a1613" },
    bar: "#1a1613",
    textColor: "#1a1613",
  },
  gray: {
    background: "#f2ede5",
  },
};

// ————————————————————————————————————————————————————————————————
// Tab 1 — Overview
// ————————————————————————————————————————————————————————————————
function OverviewTab({ event, update, calc, decision, setTab }) {
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
          <div style={styles.twoFields}>
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
            />
          </Field>
          <Field label="Notes">
            <textarea style={{ ...styles.input, minHeight: 80, fontFamily: "inherit" }} value={event.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any context, contacts, or considerations..." />
          </Field>
        </Section>

        <Section title="Quick Estimate" subtitle="Use before you've built the full model">
          <div style={styles.twoFields}>
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
          <div style={styles.twoFields}>
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
              {c.pass ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color={c.critical ? "#dc2626" : "#d97706"} />}
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
function DecisionTab({ event, update, calc, decision }) {
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
            { range: "< $75K", label: "Not worth pursuing", color: "#991b1b", bg: "#fee2e2" },
            { range: "$75K – $150K", label: "Pursue with conditions", color: "#92400e", bg: "#fef3c7" },
            { range: "$150K – $300K", label: "Strong target", color: "#065f46", bg: "#d1fae5" },
            { range: "$300K +", label: "Strategic priority", color: "#064e3b", bg: "#a7f3d0" },
          ].map((t, i) => {
            const isCurrent =
              (decision.estimate >= 300000 && i === 3) ||
              (decision.estimate >= 150000 && decision.estimate < 300000 && i === 2) ||
              (decision.estimate >= 75000 && decision.estimate < 150000 && i === 1) ||
              (decision.estimate < 75000 && i === 0);
            return (
              <div
                key={i}
                style={{
                  ...styles.thresholdCard,
                  background: t.bg,
                  color: t.color,
                  outline: isCurrent ? `2px solid ${t.color}` : "none",
                  transform: isCurrent ? "scale(1.02)" : "scale(1)",
                }}
              >
                <div style={styles.thresholdRange}>{t.range}</div>
                <div style={styles.thresholdLabel}>{t.label}</div>
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
    "PURSUE WITH CONDITIONS": "#92400e",
    "DO NOT PURSUE": "#7f1d1d",
  }[rec] || "#999";
}

// ————————————————————————————————————————————————————————————————
// Tab 3 — Calculator
// ————————————————————————————————————————————————————————————————
function CalculatorTab({ event, update, calc }) {
  const addDay = () => {
    update((e) => {
      const lastDate = e.calc.days.length ? e.calc.days[e.calc.days.length - 1].date : e.firstDay;
      const nextDate = lastDate ? addDays(lastDate, 1) : null;
      const dateStr = nextDate ? nextDate.toISOString().split("T")[0] : "";
      return {
        ...e,
        calc: {
          ...e.calc,
          days: [...e.calc.days, {
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
        days: e.calc.days.map((d) => d.id === id ? { ...d, [field]: val } : d),
      },
    }));
  };

  const removeDay = (id) => {
    update((e) => ({
      ...e,
      calc: { ...e.calc, days: e.calc.days.filter((d) => d.id !== id) },
    }));
  };

  const setRate = (key, val) => {
    update((e) => ({
      ...e,
      calc: { ...e.calc, rates: { ...e.calc.rates, [key]: Number(val) } },
    }));
  };
  const setMix = (key, val) => {
    update((e) => ({
      ...e,
      calc: { ...e.calc, mix: { ...e.calc.mix, [key]: Number(val) } },
    }));
  };

  const mixTotal = event.calc.mix.outOfState + event.calc.mix.texasOutOfMarket + event.calc.mix.dayVisitor;

  return (
    <div>
      <Section
        title="Attendance Model"
        subtitle="Enter attendance by category for each day of the event. Load-in and load-out days count too."
      >
        {event.calc.days.length === 0 ? (
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
                  {event.calc.days.map((d) => {
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
            <input type="number" style={styles.input} value={event.calc.mix.outOfState} onChange={(e) => setMix("outOfState", e.target.value)} />
          </Field>
          <Field label="Texas (50+ mi from your city) %">
            <input type="number" style={styles.input} value={event.calc.mix.texasOutOfMarket} onChange={(e) => setMix("texasOutOfMarket", e.target.value)} />
          </Field>
          <Field label="Day Visitors (local market) %">
            <input type="number" style={styles.input} value={event.calc.mix.dayVisitor} onChange={(e) => setMix("dayVisitor", e.target.value)} />
          </Field>
        </div>
        <div style={{ ...styles.mixBanner, background: mixTotal === 100 ? "#f0fdf4" : "#fef3c7" }}>
          {mixTotal === 100 ? "✓ " : "⚠ "} Mix totals {mixTotal}% {mixTotal !== 100 && "— should equal 100%"}
        </div>
      </Section>

      <Section title="Spending Rates" subtitle="Per-person, per-day spending assumptions. Defaults mirror the Adidas 3SSB benchmark.">
        <div style={styles.ratesGrid}>
          <Field label="Hotel rate / room / night ($)">
            <input type="number" style={styles.input} value={event.calc.rates.hotelRate} onChange={(e) => setRate("hotelRate", e.target.value)} />
          </Field>
          <Field label="Persons / room">
            <input type="number" step="0.1" style={styles.input} value={event.calc.rates.personsPerRoom} onChange={(e) => setRate("personsPerRoom", e.target.value)} />
          </Field>
          <Field label="% staying in hotel">
            <input type="number" style={styles.input} value={event.calc.rates.pctStayingHotel} onChange={(e) => setRate("pctStayingHotel", e.target.value)} />
          </Field>
          <Field label="Food & non-alc ($/person/day)">
            <input type="number" style={styles.input} value={event.calc.rates.foodBev} onChange={(e) => setRate("foodBev", e.target.value)} />
          </Field>
          <Field label="Entertainment & shopping ($/day)">
            <input type="number" style={styles.input} value={event.calc.rates.entertainment} onChange={(e) => setRate("entertainment", e.target.value)} />
          </Field>
          <Field label="Alcohol ($/day)">
            <input type="number" style={styles.input} value={event.calc.rates.alcohol} onChange={(e) => setRate("alcohol", e.target.value)} />
          </Field>
          <Field label="% drinking alcohol">
            <input type="number" style={styles.input} value={event.calc.rates.pctAlcohol} onChange={(e) => setRate("pctAlcohol", e.target.value)} />
          </Field>
          <Field label="Rental car ($/day)">
            <input type="number" style={styles.input} value={event.calc.rates.rentalCar} onChange={(e) => setRate("rentalCar", e.target.value)} />
          </Field>
          <Field label="% renting cars">
            <input type="number" style={styles.input} value={event.calc.rates.pctRenting} onChange={(e) => setRate("pctRenting", e.target.value)} />
          </Field>
          <Field label="Persons / rental car">
            <input type="number" step="0.1" style={styles.input} value={event.calc.rates.personsPerCar} onChange={(e) => setRate("personsPerCar", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Projected Economic Impact">
        <div style={styles.resultsGrid}>
          <ResultCard label="Total Attendance" value={fmtNum(calc.totalAttendance)} sub="all attendee-days" icon={<Users size={18} />} />
          <ResultCard label="Room Nights" value={fmtNum(calc.totalRoomNights)} sub={`at ${fmtMoney(event.calc.rates.hotelRate)}/night`} icon={<Building2 size={18} />} />
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

        <div style={styles.benchmark}>
          <strong>Benchmark:</strong> The 2024 Adidas Boys 3SSB event in Bryan had ~13,660 attendees,
          ~2,581 room nights, and produced a $168,953 total fund ($145,649 state + $23,304 local).
        </div>
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
                    background: isEvent ? "#111" : isPast ? "#ccc" : isNow ? "#d97706" : "#fff",
                    borderColor: isEvent ? "#111" : isNow ? "#d97706" : "#ccc",
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
    update((e) => ({
      ...e,
      docs: {
        ...e.docs,
        [key]: {
          done: !e.docs[key].done,
          date: !e.docs[key].done ? new Date().toISOString().split("T")[0] : "",
        },
      },
    }));
  };

  const setDocDate = (key, date) => {
    update((e) => ({
      ...e,
      docs: { ...e.docs, [key]: { ...e.docs[key], date } },
    }));
  };

  const phases = [...new Set(DOC_LIST.map((d) => d.phase))];
  const completed = DOC_LIST.filter((d) => event.docs[d.key]?.done).length;

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
              const doc = event.docs[d.key] || { done: false, date: "" };
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
          <p><strong>$75K minimum:</strong> Below this, the administrative lift (application, support contract, cert, disbursement paperwork) typically consumes more staff time than the fund is worth for most DMOs.</p>
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
          <p>Full statute: <a href="https://statutes.capitol.texas.gov/Docs/GV/htm/GV.480.htm" target="_blank" rel="noopener noreferrer" style={{ color: "#92400e" }}>statutes.capitol.texas.gov</a></p>
          <p>Administrative rules: Texas Administrative Code, Title 10, Part 5, Chapter 184.1 – 184.51</p>
          <p>Program page: <a href="https://gov.texas.gov/business/page/event-trust-funds-program" target="_blank" rel="noopener noreferrer" style={{ color: "#92400e" }}>gov.texas.gov</a></p>
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
// VenuePicker — multi-select with persistent custom venue list
// ————————————————————————————————————————————————————————————————
function VenuePicker({ selected, legacyValue, onChange }) {
  const [customVenues, setCustomVenues] = useState([]);
  const [newVenue, setNewVenue] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load custom venues from storage (shared across all events for this user)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("etf_custom_venues");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCustomVenues(parsed);
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
        // Any that aren't in defaults or custom get promoted to custom
        const allKnown = [...DEFAULT_MCKINNEY_VENUES, ...customVenues];
        const newCustom = parts.filter((p) => !allKnown.includes(p));
        if (newCustom.length) setCustomVenues((prev) => [...prev, ...newCustom]);
        onChange(parts);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const allVenues = [...DEFAULT_MCKINNEY_VENUES, ...customVenues];
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
          const isCustom = !DEFAULT_MCKINNEY_VENUES.includes(v);
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
    background: "#fef3c7",
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
    border: "1px solid #e8e3db",
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
    accentColor: "#92400e",
    cursor: "pointer",
    margin: 0,
  },
  label: { flex: 1, color: "#1a1613" },
  defaultTag: {
    fontSize: 9.5,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    color: "#92400e",
    background: "#fef3c7",
    padding: "2px 6px",
    borderRadius: 2,
    fontWeight: 600,
  },
  removeBtn: {
    background: "transparent",
    border: "none",
    color: "#9ca3af",
    padding: 4,
    display: "flex",
    alignItems: "center",
  },
  addRow: { display: "flex", gap: 8 },
  addInput: {
    flex: 1,
    padding: "8px 12px",
    border: "1px solid #e8e3db",
    background: "#fff",
    fontSize: 13,
    borderRadius: 3,
    fontFamily: "inherit",
  },
  addBtn: {
    padding: "8px 14px",
    background: "#1a1613",
    color: "#faf8f4",
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
        border-color: #92400e;
        box-shadow: 0 0 0 3px rgba(146, 64, 14, .12);
      }
      button:hover { cursor: pointer; }
      a { text-decoration: underline; text-underline-offset: 3px; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
    `}</style>
  );
}

// ————————————————————————————————————————————————————————————————
// Styles
// ————————————————————————————————————————————————————————————————
const SERIF = `'Fraunces', Georgia, serif`;
const SANS = `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
const BG = "#faf8f4";
const INK = "#1a1613";
const MUTED = "#6b6660";
const LINE = "#e8e3db";
const ACCENT = "#92400e";
const ACCENT_SOFT = "#fef3c7";

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
    background: "#fff",
    borderRight: `1px solid ${LINE}`,
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    height: "100vh",
  },
  brand: {
    padding: "24px 20px 20px",
    display: "flex", gap: 12, alignItems: "center",
    cursor: "pointer",
    borderBottom: `1px solid ${LINE}`,
  },
  brandMark: {
    width: 36, height: 36,
    background: INK,
    color: BG,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: SERIF, fontWeight: 700, fontSize: 14,
    letterSpacing: ".5px",
  },
  brandTitle: { fontFamily: SERIF, fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" },
  brandSub: { fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: ".1em" },
  newBtn: {
    margin: "16px 20px 0",
    padding: "10px 14px",
    background: INK,
    color: BG,
    border: "none",
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: ".02em",
    display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
  },
  sidebarLabel: {
    display: "flex", justifyContent: "space-between",
    padding: "20px 20px 8px",
    fontSize: 10.5,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: ".1em",
    fontWeight: 600,
  },
  count: {
    background: LINE,
    padding: "1px 7px",
    borderRadius: 10,
    fontSize: 10,
  },
  eventList: { flex: 1, overflow: "auto", padding: "0 8px" },
  emptyList: { padding: 16, color: MUTED, fontSize: 12, fontStyle: "italic" },
  eventItem: {
    position: "relative",
    padding: "10px 12px",
    borderRadius: 6,
    marginBottom: 2,
    cursor: "pointer",
    transition: "background .15s",
  },
  eventItemActive: { background: ACCENT_SOFT },
  eventItemName: {
    fontSize: 13,
    fontWeight: 500,
    color: INK,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingRight: 20,
  },
  eventItemMeta: {
    fontSize: 11,
    color: MUTED,
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
    color: MUTED,
    padding: 4,
    opacity: 0.5,
  },
  sidebarFooter: {
    padding: "12px 20px",
    fontSize: 10.5,
    color: MUTED,
    borderTop: `1px solid ${LINE}`,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  // Main
  main: { flex: 1, minWidth: 0 },

  // Dashboard
  dashboard: { maxWidth: 960, margin: "0 auto", padding: "48px 40px" },
  dashHeader: { marginBottom: 48 },
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
    padding: "20px 22px",
    display: "flex",
    gap: 14,
    alignItems: "center",
  },
  statIcon: {
    width: 36, height: 36,
    background: ACCENT_SOFT,
    color: ACCENT,
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 6,
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
    borderRadius: 3,
  },

  tabs: {
    display: "flex",
    gap: 2,
    marginBottom: 32,
    borderBottom: `1px solid ${LINE}`,
    flexWrap: "wrap",
  },
  tab: {
    padding: "10px 16px",
    background: "transparent",
    border: "none",
    borderBottom: `2px solid transparent`,
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
  },

  tabPanel: { paddingBottom: 40 },

  section: {
    background: "#fff",
    border: `1px solid ${LINE}`,
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
    borderRadius: 4,
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
    background: "#faf8f4",
    border: `1px solid ${LINE}`,
  },
  resultIcon: { color: ACCENT, marginBottom: 8 },
  resultLabel: { fontSize: 10.5, color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 },
  resultValue: { fontFamily: SERIF, fontSize: 26, fontWeight: 600, marginTop: 4 },
  resultSub: { fontSize: 11.5, color: MUTED, marginTop: 4 },

  breakdownTable: {
    background: "#faf8f4",
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
    background: "#faf8f4",
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
  rulesBox: { background: "#faf8f4", padding: "16px 20px", borderRadius: 3 },
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
