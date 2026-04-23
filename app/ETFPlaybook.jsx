"use client";

import { useState, useEffect } from "react";

export default function ETFPlaybook() {
  const [events, setEvents] = useState([]);

  // Load saved data
  useEffect(() => {
    try {
      const saved = localStorage.getItem("etf_events_full");
      if (saved) setEvents(JSON.parse(saved));
    } catch {}
  }, []);

  // Save data
  useEffect(() => {
    try {
      localStorage.setItem("etf_events_full", JSON.stringify(events));
    } catch {}
  }, [events]);

  function addEvent() {
    const newEvent = {
      id: Date.now(),
      name: "New Event",
      type: "Sports",

      attendees: "",
      nights: "",
      outOfMarket: "",

      adr: "140",
      hotRate: "7",

      incentive: "",
      venueCost: "",
      notes: "",

      confidence: "Medium",
    };

    setEvents([newEvent, ...events]);
  }

  function deleteEvent(id) {
    setEvents(events.filter((e) => e.id !== id));
  }

  function updateEvent(id, field, value) {
    setEvents(
      events.map((e) =>
        e.id === id ? { ...e, [field]: value } : e
      )
    );
  }

  function calculate(e) {
    const attendees = Number(e.attendees) || 0;
    const nights = Number(e.nights) || 0;
    const outOfMarket = Number(e.outOfMarket) || 0;

    const adr = Number(e.adr) || 0;
    const hotRate = (Number(e.hotRate) || 0) / 100;

    const incentive = Number(e.incentive) || 0;
    const venueCost = Number(e.venueCost) || 0;

    const roomNights = attendees * nights;
    const qualifiedNights = roomNights * (outOfMarket / 100);

    const hotelRevenue = qualifiedNights * adr;
    const hotRevenue = hotelRevenue * hotRate;

    const totalCost = incentive + venueCost;

    const roi =
      totalCost > 0 ? (hotRevenue / totalCost).toFixed(2) : "0.00";

    let decision = "NO-GO";
    let color = "#991b1b";

    if (Number(roi) > 4) {
      decision = "STRONG GO";
      color = "#065f46";
    } else if (Number(roi) > 2.5) {
      decision = "GO";
      color = "#166534";
    } else if (Number(roi) > 1.25) {
      decision = "MAYBE";
      color = "#92400e";
    }

    return {
      roomNights,
      qualifiedNights,
      hotelRevenue,
      hotRevenue,
      totalCost,
      roi,
      decision,
      color,
    };
  }
  const totals = events.reduce(
    (acc, e) => {
      const c = calculate(e);
      acc.cost += c.totalCost;
      acc.hot += c.hotRevenue;
      acc.count += 1;
      if (c.decision === "GO" || c.decision === "STRONG GO") {
        acc.goCount += 1;
      }
      return acc;
    },
    { cost: 0, hot: 0, count: 0, goCount: 0 }
  );

  return (
    <div style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginBottom: "12px" }}>ETF Playbook</h1>

      <div style={{ marginBottom: "18px" }}>
        <button
          onClick={addEvent}
          style={{
            background: "#111",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Add Event
        </button>
      </div>

      {events.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
            maxWidth: "900px",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "14px",
              background: "#fafafa",
            }}
          >
            <div style={{ fontSize: "12px", color: "#666" }}>Events</div>
            <div style={{ fontSize: "24px", fontWeight: "700" }}>
              {totals.count}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "14px",
              background: "#fafafa",
            }}
          >
            <div style={{ fontSize: "12px", color: "#666" }}>GO Events</div>
            <div style={{ fontSize: "24px", fontWeight: "700" }}>
              {totals.goCount}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "14px",
              background: "#fafafa",
            }}
          >
            <div style={{ fontSize: "12px", color: "#666" }}>
              Total City Cost
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700" }}>
              ${Math.round(totals.cost).toLocaleString()}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "14px",
              background: "#fafafa",
            }}
          >
            <div style={{ fontSize: "12px", color: "#666" }}>
              Estimated HOT
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700" }}>
              ${Math.round(totals.hot).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <p>No events yet</p>
      ) : (
        <div>
          {events.map((event) => {
            const c = calculate(event);

            return (
              <div
                key={event.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "16px",
                  marginBottom: "14px",
                  maxWidth: "880px",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <input
                    value={event.name}
                    onChange={(e) =>
                      updateEvent(event.id, "name", e.target.value)
                    }
                    style={{
                      flex: 1,
                      padding: "10px",
                      fontSize: "18px",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                    }}
                  />

                  <button
                    onClick={() => deleteEvent(event.id)}
                    style={{
                      background: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      padding: "10px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      Event Type
                    </label>
                    <select
                      value={event.type}
                      onChange={(e) =>
                        updateEvent(event.id, "type", e.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                      }}
                    >
                      <option>Sports</option>
                      <option>Meetings</option>
                      <option>Leisure</option>
                      <option>Festival</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      Confidence
                    </label>
                    <select
                      value={event.confidence}
                      onChange={(e) =>
                        updateEvent(event.id, "confidence", e.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                      }}
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      Notes
                    </label>
                    <input
                      value={event.notes}
                      onChange={(e) =>
                        updateEvent(event.id, "notes", e.target.value)
                      }
                      placeholder="Quick notes"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      Attendees
                    </label>
                    <input
                      type="number"
                      value={event.attendees}
                      onChange={(e) =>
                        updateEvent(event.id, "attendees", e.target.value)
                      }
                      placeholder="Enter attendees"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      Nights
                    </label>
                    <input
                      type="number"
                      value={event.nights}
                      onChange={(e) =>
                        updateEvent(event.id, "nights", e.target.value)
                      }
                      placeholder="Enter nights"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      % Out of Market
                    </label>
                    <input
                      type="number"
                      value={event.outOfMarket}
                      onChange={(e) =>
                        updateEvent(event.id, "outOfMarket", e.target.value)
                      }
                      placeholder="Enter %"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      ADR ($)
                    </label>
                    <input
                      type="number"
                      value={event.adr}
                      onChange={(e) =>
                        updateEvent(event.id, "adr", e.target.value)
                      }
                      placeholder="Enter ADR"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      HOT Rate (%)
                    </label>
                    <input
                      type="number"
                      value={event.hotRate}
                      onChange={(e) =>
                        updateEvent(event.id, "hotRate", e.target.value)
                      }
                      placeholder="Enter HOT %"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      City Incentive ($)
                    </label>
                    <input
                      type="number"
                      value={event.incentive}
                      onChange={(e) =>
                        updateEvent(event.id, "incentive", e.target.value)
                      }
                      placeholder="Enter incentive"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      Venue / City Cost ($)
                    </label>
                    <input
                      type="number"
                      value={event.venueCost}
                      onChange={(e) =>
                        updateEvent(event.id, "venueCost", e.target.value)
                      }
                      placeholder="Enter venue cost"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
                    gap: "10px",
                    marginTop: "14px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px solid #eee",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      Room Nights
                    </div>
                    <div style={{ fontWeight: "700" }}>
                      {Math.round(c.roomNights).toLocaleString()}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px solid #eee",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      Qualified Nights
                    </div>
                    <div style={{ fontWeight: "700" }}>
                      {Math.round(c.qualifiedNights).toLocaleString()}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px solid #eee",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      Hotel Revenue
                    </div>
                    <div style={{ fontWeight: "700" }}>
                      ${Math.round(c.hotelRevenue).toLocaleString()}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px solid #eee",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      HOT Revenue
                    </div>
                    <div style={{ fontWeight: "700" }}>
                      ${Math.round(c.hotRevenue).toLocaleString()}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px solid #eee",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      Total City Cost
                    </div>
                    <div style={{ fontWeight: "700" }}>
                      ${Math.round(c.totalCost).toLocaleString()}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#fafafa",
                      border: "1px solid #eee",
                      borderRadius: "8px",
                      padding: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#666" }}>ROI</div>
                    <div style={{ fontWeight: "700" }}>{c.roi}x</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    fontWeight: "bold",
                    color: c.color,
                    fontSize: "16px",
                  }}
                >
                  Decision: {c.decision}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
