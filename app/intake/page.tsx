// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const SERIF = "'Fraunces', 'Georgia', serif";
const MONO = "'IBM Plex Mono', 'Courier New', monospace";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f0e0c",
    color: "#f5f0e8",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  header: {
    borderBottom: "1px solid #2a2720",
    padding: "20px 40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontFamily: SERIF,
    fontSize: 18,
    fontWeight: 600,
    color: "#f5f0e8",
    letterSpacing: "-.01em",
  },
  logoSub: {
    fontSize: 11,
    color: "#6b6660",
    textTransform: "uppercase" as const,
    letterSpacing: ".12em",
    marginTop: 2,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    color: "#c8b97a",
    background: "#c8b97a18",
    border: "1px solid #c8b97a33",
    borderRadius: 20,
    padding: "4px 12px",
    textTransform: "uppercase" as const,
    letterSpacing: ".1em",
  },
  hero: {
    padding: "64px 40px 48px",
    maxWidth: 720,
    margin: "0 auto",
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "#c8b97a",
    textTransform: "uppercase" as const,
    letterSpacing: ".14em",
    marginBottom: 16,
  },
  h1: {
    fontFamily: SERIF,
    fontSize: 42,
    fontWeight: 600,
    lineHeight: 1.15,
    margin: "0 0 20px",
    color: "#f5f0e8",
  },
  h1Em: {
    fontStyle: "italic",
    color: "#c8b97a",
  },
  lede: {
    fontSize: 16,
    color: "#9e9890",
    lineHeight: 1.7,
    margin: 0,
    maxWidth: 560,
  },
  form: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "0 40px 80px",
  },
  section: {
    marginBottom: 48,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1px solid #2a2720",
  },
  sectionNum: {
    fontFamily: MONO,
    fontSize: 11,
    color: "#c8b97a",
    background: "#c8b97a15",
    border: "1px solid #c8b97a30",
    borderRadius: 3,
    padding: "3px 8px",
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: 600,
    color: "#f5f0e8",
    margin: 0,
  },
  fieldGroup: {
    display: "grid",
    gap: 20,
  },
  fieldRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "#9e9890",
    textTransform: "uppercase" as const,
    letterSpacing: ".1em",
  },
  required: {
    color: "#c8b97a",
    marginLeft: 3,
  },
  hint: {
    fontSize: 11.5,
    color: "#6b6660",
    lineHeight: 1.5,
    marginTop: 4,
  },
  input: {
    background: "#1a1814",
    border: "1px solid #2a2720",
    borderRadius: 4,
    color: "#f5f0e8",
    fontSize: 14,
    padding: "11px 14px",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color .15s",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  textarea: {
    background: "#1a1814",
    border: "1px solid #2a2720",
    borderRadius: 4,
    color: "#f5f0e8",
    fontSize: 14,
    padding: "11px 14px",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical" as const,
    minHeight: 90,
    width: "100%",
    boxSizing: "border-box" as const,
  },
  select: {
    background: "#1a1814",
    border: "1px solid #2a2720",
    borderRadius: 4,
    color: "#f5f0e8",
    fontSize: 14,
    padding: "11px 14px",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
    appearance: "none" as const,
    cursor: "pointer",
  },
  radioGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    marginTop: 4,
  },
  radioOption: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 16px",
    background: "#1a1814",
    border: "1px solid #2a2720",
    borderRadius: 4,
    cursor: "pointer",
    transition: "border-color .15s",
  },
  radioOptionSelected: {
    borderColor: "#c8b97a",
    background: "#c8b97a08",
  },
  radioLabel: {
    fontSize: 14,
    color: "#f5f0e8",
    lineHeight: 1.5,
  },
  radioHint: {
    fontSize: 12,
    color: "#6b6660",
    marginTop: 2,
  },
  eligBox: {
    background: "#1a1814",
    border: "1px solid #2a2720",
    borderRadius: 6,
    padding: "20px 24px",
    marginTop: 8,
  },
  eligRow: {
    display: "flex",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid #2a2720",
    alignItems: "flex-start",
  },
  eligQ: {
    flex: 1,
    fontSize: 13.5,
    color: "#c8c0b0",
    lineHeight: 1.5,
  },
  eligBtns: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
  },
  eligBtn: (active: boolean, isYes: boolean) => ({
    padding: "5px 14px",
    borderRadius: 3,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: active
      ? `1px solid ${isYes ? "#4ade80" : "#f87171"}`
      : "1px solid #2a2720",
    background: active
      ? isYes ? "#4ade8018" : "#f8717118"
      : "transparent",
    color: active
      ? isYes ? "#4ade80" : "#f87171"
      : "#6b6660",
    transition: "all .15s",
  }),
  submitArea: {
    borderTop: "1px solid #2a2720",
    paddingTop: 32,
    marginTop: 8,
  },
  disclaimer: {
    fontSize: 12,
    color: "#6b6660",
    lineHeight: 1.6,
    marginBottom: 20,
    padding: "12px 16px",
    background: "#1a1814",
    borderRadius: 4,
    border: "1px solid #2a2720",
  },
  submitBtn: {
    width: "100%",
    padding: "14px",
    background: "#c8b97a",
    color: "#0f0e0c",
    border: "none",
    borderRadius: 4,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: ".02em",
    transition: "opacity .15s",
  },
  successPage: {
    minHeight: "100vh",
    background: "#0f0e0c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  successCard: {
    maxWidth: 520,
    textAlign: "center" as const,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: SERIF,
    fontSize: 32,
    fontWeight: 600,
    color: "#f5f0e8",
    marginBottom: 16,
  },
  successBody: {
    fontSize: 15,
    color: "#9e9890",
    lineHeight: 1.7,
  },
};

const ELIG_QUESTIONS = [
  {
    key: "competitive",
    q: "Was your event selected through a competitive process that considered venues in other states?",
    hint: "e.g. bids were submitted to multiple cities including out-of-state options",
  },
  {
    key: "annual",
    q: "Does this event occur only once per year?",
    hint: "Recurring monthly or weekly events are not eligible",
  },
  {
    key: "solesite",
    q: "Is this city the only location hosting this event (or the only location in this region)?",
    hint: "The event cannot be held at multiple Texas locations simultaneously",
  },
  {
    key: "notelsewhere",
    q: "Is this event NOT being held anywhere else in Texas or a bordering state the same year?",
    hint: "Bordering states: NM, OK, AR, LA — events held in those states same year are ineligible",
  },
];

function IntakeForm() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org") || "";
  const [orgName, setOrgName] = useState("");
  const [orgLogo, setOrgLogo] = useState("");

  useEffect(() => {
    if (orgId) {
      fetch(`/api/orgs?id=${orgId}`)
        .then(r => r.json())
        .then(data => {
          if (data.name) setOrgName(data.name);
          if (data.logoUrl) setOrgLogo(data.logoUrl);
        })
        .catch(() => {});
    }
  }, [orgId]);

  const [form, setForm] = useState({
    orgName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    eventName: "",
    eventType: "",
    firstDay: "",
    lastDay: "",
    venueNeeds: "",
    totalAttendance: "",
    outOfMarketPct: "",
    roomNightsNeeded: "",
    hotelBlockConfirmed: "",
    siteSelectionOrg: "",
    competitiveProcess: "",
    selectionLetterAvailable: "",
    elig: {} as Record<string, boolean | null>,
    estimatedEventBudget: "",
    primaryCosts: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const setElig = (key: string, val: boolean) =>
    setForm((f) => ({ ...f, elig: { ...f.elig, [key]: f.elig[key] === val ? null : val } }));

  const inputStyle = (focused?: boolean) => ({
    ...styles.input,
    borderColor: focused ? "#c8b97a" : "#2a2720",
  });

  const handleSubmit = async () => {
    if (!form.eventName || !form.contactName || !form.contactEmail || !form.firstDay) {
      setError("Please fill in all required fields before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, orgId }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch (e) {
      setError("Something went wrong. Please try again or email us directly.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={styles.successPage}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <div style={styles.successTitle}>Submission received.</div>
          <p style={styles.successBody}>
            Thank you for submitting <strong style={{ color: "#f5f0e8" }}>{form.eventName}</strong>.
            Our team will review your event details and be in touch if we'd like to move forward with an analysis.
          </p>
          <p style={{ ...styles.successBody, marginTop: 16, fontSize: 13, color: "#6b6660" }}>
            Questions? Contact the organization you submitted to directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {orgLogo && (
            <img src={orgLogo} alt={orgName} style={{ height: 36, width: 36, objectFit: "contain", background: "#fff", borderRadius: 4, padding: 3 }} />
          )}
          <div>
            <div style={styles.logo}>{orgName ? `Submit to ${orgName}` : "Texas Events Trust Fund Analysis Tool"}</div>
            <div style={styles.logoSub}>Event Organizer Intake</div>
          </div>
        </div>
        <div style={styles.badge}>Confidential</div>
      </header>

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.eyebrow}>Event Submission Form</div>
        <h1 style={styles.h1}>
          Tell us about <em style={styles.h1Em}>your event.</em>
        </h1>
        <p style={styles.lede}>
          Complete this form so {orgName ? <strong style={{ color: "#f5f0e8" }}>{orgName}</strong> : "we"} can evaluate your event for Texas Events Trust Fund eligibility.
          The more detail you provide, the faster we can complete our analysis.
          All information is kept confidential.
        </p>
      </div>

      {/* Form */}
      <div style={styles.form}>

        {/* Section 1 — Contact */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>01</span>
            <h2 style={styles.sectionTitle}>Your Contact Information</h2>
          </div>
          <div style={styles.fieldGroup}>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Organization Name<span style={styles.required}>*</span></label>
                <input style={inputStyle()} value={form.orgName} onChange={(e) => set("orgName", e.target.value)} placeholder="e.g. USA Volleyball" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Your Name<span style={styles.required}>*</span></label>
                <input style={inputStyle()} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="First and last name" />
              </div>
            </div>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Email<span style={styles.required}>*</span></label>
                <input type="email" style={inputStyle()} value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="you@organization.com" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Phone</label>
                <input style={inputStyle()} value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="(000) 000-0000" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Event Basics */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>02</span>
            <h2 style={styles.sectionTitle}>Event Details</h2>
          </div>
          <div style={styles.fieldGroup}>
            <div style={styles.field}>
              <label style={styles.label}>Event Name<span style={styles.required}>*</span></label>
              <input style={inputStyle()} value={form.eventName} onChange={(e) => set("eventName", e.target.value)} placeholder="Official name of the event" />
            </div>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Event Type</label>
                <select style={styles.select} value={form.eventType} onChange={(e) => set("eventType", e.target.value)}>
                  <option value="">Select a type…</option>
                  <option>Youth Sports Tournament</option>
                  <option>Adult Sports Tournament</option>
                  <option>Professional/Elite Sports</option>
                  <option>Esports / Gaming</option>
                  <option>Trade Show / Convention</option>
                  <option>Music / Entertainment</option>
                  <option>Motorsports</option>
                  <option>Other</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Typical Annual Frequency</label>
                <select style={styles.select} value={form.annualFrequency} onChange={(e) => set("annualFrequency", e.target.value)}>
                  <option value="">Select…</option>
                  <option>Once per year</option>
                  <option>Twice per year</option>
                  <option>More than twice per year</option>
                </select>
              </div>
            </div>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Proposed Start Date<span style={styles.required}>*</span></label>
                <input type="date" style={inputStyle()} value={form.firstDay} onChange={(e) => set("firstDay", e.target.value)} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Proposed End Date</label>
                <input type="date" style={inputStyle()} value={form.lastDay} onChange={(e) => set("lastDay", e.target.value)} />
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Venue / Facility Needs</label>
              <textarea style={styles.textarea} value={form.venueNeeds} onChange={(e) => set("venueNeeds", e.target.value)} placeholder="What type of facility do you need? (e.g. 8 baseball fields, indoor arena with 5,000 seats, convention center with 50,000 sq ft)" />
            </div>
          </div>
        </div>

        {/* Section 3 — Attendance */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>03</span>
            <h2 style={styles.sectionTitle}>Attendance & Economic Impact</h2>
          </div>
          <div style={styles.fieldGroup}>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Total Expected Attendance</label>
                <input style={inputStyle()} value={form.totalAttendance} onChange={(e) => set("totalAttendance", e.target.value)} placeholder="e.g. 3,500" />
                <div style={styles.hint}>Athletes, coaches, family members, spectators combined</div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>% From Outside the Region</label>
                <input style={inputStyle()} value={form.outOfMarketPct} onChange={(e) => set("outOfMarketPct", e.target.value)} placeholder="e.g. 75%" />
                <div style={styles.hint}>Attendees traveling 50+ miles to attend</div>
              </div>
            </div>
            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Estimated Hotel Room Nights</label>
                <input style={inputStyle()} value={form.roomNightsNeeded} onChange={(e) => set("roomNightsNeeded", e.target.value)} placeholder="e.g. 1,200" />
                <div style={styles.hint}>Total room nights across all attendees for the event</div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Hotel Room Block Already Secured?</label>
                <select style={styles.select} value={form.hotelBlockConfirmed} onChange={(e) => set("hotelBlockConfirmed", e.target.value)}>
                  <option value="">Select…</option>
                  <option>Yes — we have a confirmed block</option>
                  <option>In progress — working with hotels</option>
                  <option>No — need help securing rooms</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4 — Site Selection */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>04</span>
            <h2 style={styles.sectionTitle}>Site Selection Process</h2>
          </div>
          <div style={styles.fieldGroup}>
            <div style={styles.field}>
              <label style={styles.label}>Site Selection Organization</label>
              <input style={inputStyle()} value={form.siteSelectionOrg} onChange={(e) => set("siteSelectionOrg", e.target.value)} placeholder="The organization that chooses the host city (may be same as event organizer)" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Was a Competitive Bid Process Used?</label>
              <div style={styles.radioGroup}>
                {[
                  { val: "yes", label: "Yes", hint: "Multiple cities submitted bids and were evaluated" },
                  { val: "no", label: "No", hint: "We select host cities without a formal bid process" },
                  { val: "partial", label: "Informal process", hint: "We reach out to cities but don't require formal bids" },
                ].map((opt) => (
                  <div
                    key={opt.val}
                    style={{ ...styles.radioOption, ...(form.competitiveProcess === opt.val ? styles.radioOptionSelected : {}) }}
                    onClick={() => set("competitiveProcess", opt.val)}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${form.competitiveProcess === opt.val ? "#c8b97a" : "#3a3730"}`, background: form.competitiveProcess === opt.val ? "#c8b97a" : "transparent", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={styles.radioLabel}>{opt.label}</div>
                      <div style={styles.radioHint}>{opt.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Can you provide a signed selection letter on your organization's letterhead?</label>
              <div style={styles.radioGroup}>
                {[
                  { val: "yes", label: "Yes — we can provide a selection letter" },
                  { val: "maybe", label: "Possibly — need to check with leadership" },
                  { val: "no", label: "No — we don't typically provide these" },
                ].map((opt) => (
                  <div
                    key={opt.val}
                    style={{ ...styles.radioOption, ...(form.selectionLetterAvailable === opt.val ? styles.radioOptionSelected : {}) }}
                    onClick={() => set("selectionLetterAvailable", opt.val)}
                  >
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${form.selectionLetterAvailable === opt.val ? "#c8b97a" : "#3a3730"}`, background: form.selectionLetterAvailable === opt.val ? "#c8b97a" : "transparent", flexShrink: 0, marginTop: 1 }} />
                    <div style={styles.radioLabel}>{opt.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 5 — Eligibility */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>05</span>
            <h2 style={styles.sectionTitle}>Eligibility Questions</h2>
          </div>
          <p style={{ fontSize: 13.5, color: "#6b6660", lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
            These questions help us determine if your event qualifies for the Texas Events Trust Fund program.
            Answer to the best of your knowledge — we'll verify details during our review.
          </p>
          <div style={styles.eligBox}>
            {ELIG_QUESTIONS.map((q, i) => (
              <div key={q.key} style={{ ...styles.eligRow, ...(i === ELIG_QUESTIONS.length - 1 ? { borderBottom: "none", paddingBottom: 0 } : {}) }}>
                <div style={{ flex: 1 }}>
                  <div style={styles.eligQ}>{q.q}</div>
                  {q.hint && <div style={{ fontSize: 11.5, color: "#6b6660", marginTop: 4 }}>{q.hint}</div>}
                </div>
                <div style={styles.eligBtns}>
                  <button
                    style={styles.eligBtn(form.elig[q.key] === true, true)}
                    onClick={() => setElig(q.key, true)}
                  >Yes</button>
                  <button
                    style={styles.eligBtn(form.elig[q.key] === false, false)}
                    onClick={() => setElig(q.key, false)}
                  >No</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 6 — Budget */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>06</span>
            <h2 style={styles.sectionTitle}>Event Budget</h2>
          </div>
          <div style={styles.fieldGroup}>
            <div style={styles.field}>
              <label style={styles.label}>Estimated Total Event Budget</label>
              <input style={inputStyle()} value={form.estimatedEventBudget} onChange={(e) => set("estimatedEventBudget", e.target.value)} placeholder="e.g. $250,000" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Primary Cost Categories</label>
              <textarea style={styles.textarea} value={form.primaryCosts} onChange={(e) => set("primaryCosts", e.target.value)} placeholder="e.g. Facility rental ($80K), staffing ($40K), equipment ($30K), marketing ($20K), officials/referees ($15K)" />
              <div style={styles.hint}>Rough breakdown is fine — helps us assess ETF eligibility of specific line items</div>
            </div>
          </div>
        </div>

        {/* Section 7 — Notes */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionNum}>07</span>
            <h2 style={styles.sectionTitle}>Anything Else We Should Know?</h2>
          </div>
          <div style={styles.field}>
            <textarea style={{ ...styles.textarea, minHeight: 120 }} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Other cities you're considering, timeline pressures, special requirements, history of this event, why you're interested in this location…" />
          </div>
        </div>

        {/* Submit */}
        <div style={styles.submitArea}>
          {error && (
            <div style={{ padding: "10px 14px", background: "#f8717118", border: "1px solid #f87171", borderRadius: 4, color: "#f87171", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <div style={styles.disclaimer}>
            By submitting this form, you confirm that the information provided is accurate to the best of your knowledge.
            This form does not constitute a binding agreement or guarantee of funding.
            All information will be kept confidential and used solely for ETF eligibility analysis.
          </div>
          <button
            style={{ ...styles.submitBtn, opacity: submitting ? 0.6 : 1 }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit Event for Analysis →"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0f0e0c" }} />}>
      <IntakeForm />
    </Suspense>
  );
}
