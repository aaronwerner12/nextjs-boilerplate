"use client";

import { useState } from "react";

export default function ETFPlaybook() {
  const [events, setEvents] = useState([]);

  function addEvent() {
    const newEvent = {
      id: Date.now(),
      name: "New Event",
      attendees: "",
      nights: "",
      outOfMarket: "",
      incentive: "",
      adr: "140",
      hotRate: "7",
    };

    setEvents([newEvent, ...events]);
  }

  function updateEvent(id, field, value) {
    setEvents(
      events.map((e) =>
        e.id === id ? { ...e, [field]: value } : e
      )
    );
  }

  function deleteEvent(id) {
    setEvents(events.filter((e) => e.id !== id));
  }

  function calculate(e) {
    const attendees = Number(e.attendees) || 0;
    const nights = Number(e.nights) || 0;
    const outOfMarket = Number(e.outOfMarket) || 0;
    const incentive = Number(e.incentive) || 0;
    const adr = Number(e.adr) || 0;
    const hotRate = (Number(e.hotRate) || 0) / 100;

    const roomNights = attendees * nights;
    const qualifiedNights = roomNights * (outOfMarket / 100);
    const hotelRevenue = qualifiedNights * adr;
    const hotRevenue = hotelRevenue * hotRate;

    const roi =
      incentive > 0 ? (hotRevenue / incentive).toFixed(2) : "0.00";

    let decision = "NO-GO";
    let decisionColor = "#991b1b";

    if (Number(roi) > 3) {
      decision = "STRONG GO";
      decisionColor = "#065f46";
    } else if (Number(roi) > 2) {
      decision = "GO";
      decisionColor = "#166534";
    } else if (Number(roi) > 1) {
      decision = "MAYBE";
      decisionColor = "#92400e";
    }

    return {
      roomNights,
      qualifiedNights,
      hotelRevenue,
      hotRevenue,
      roi,
      decision,
      decisionColor,
    };
  }

  return (
    <div style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginBottom: "12px" }}>ETF Playbook</h1>

      <button
        onClick={addEvent}
        style={{
          background: "#111",
          color: "#fff",
          border: "none",
          padding: "10px 16px",
          borderRadius: "8px",
          cursor: "pointer",
          marginBottom: "20px",
          fontWeight: "600",
        }}
      >
        Add Event
      </button>

      {events.length === 0 ? (
        <p>No events yet</p>
      ) : (
        <div style={{ marginTop: "20px" }}>
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
                  maxWidth: "720px",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "14px",
                    alignItems: "center",
                  }}
                >
                  <input
                    value={event.name}
                    onChange={(e) =>
                      updateEvent(event.id, "name", e.target.value)
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontSize: "18px",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                      boxSizing: "border-box",
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
                      whiteSpace: "nowrap",
                    }}
                  >
                    Delete
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}>
                      Attendees
                    </label>
                    <input
                      type="number"
                      placeholder="Enter attendees"
                      value={event.attendees}
                      onChange={(e) =>
                        updateEvent(event.id, "attendees", e.target.value)
                      }
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
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}>
                      Nights
                    </label>
                    <input
                      type="number"
                      placeholder="Enter nights"
                      value={event.nights}
                      onChange={(e) =>
                        updateEvent(event.id, "nights", e.target.value)
                      }
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
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}>
                      % Out of Market
                    </label>
                    <input
                      type="number"
                      placeholder="Enter %"
                      value={event.outOfMarket}
                      onChange={(e) =>
                        updateEvent(event.id, "outOfMarket", e.target.value)
                      }
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
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}>
                      City Incentive ($)
                    </label>
                    <input
                      type="number"
                      placeholder="Enter incentive"
                      value={event.incentive}
                      onChange={(e) =>
                        updateEvent(event.id, "incentive", e.target.value)
                      }
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
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}>
                      ADR ($)
                    </label>
                    <input
                      type="number"
                      placeholder="Enter ADR"
                      value={event.adr}
                      onChange={(e) =>
                        updateEvent(event.id, "adr", e.target.value)
                      }
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
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}>
                      HOT Rate (%)
                    </label>
                    <input
                      type="number"
                      placeholder="Enter HOT %"
                      value={event.hotRate}
                      onChange={(e) =>
                        updateEvent(event.id, "hotRate", e.target.value)
                      }
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

                <div style={{ lineHeight: "1.8", marginTop: "8px" }}>
                  <div>Room Nights: {Math.round(c.roomNights)}</div>
                  <div>Qualified Nights: {Math.round(c.qualifiedNights)}</div>
                  <div>Hotel Revenue: ${Math.round(c.hotelRevenue).toLocaleString()}</div>
                  <div>HOT Revenue: ${Math.round(c.hotRevenue).toLocaleString()}</div>
                  <div>ROI: {c.roi}x</div>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    fontWeight: "bold",
                    color: c.decisionColor,
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
