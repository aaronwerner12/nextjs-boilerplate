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

  function calculate(e) {
    const attendees = Number(e.attendees) || 0;
    const nights = Number(e.nights) || 0;
    const outOfMarket = Number(e.outOfMarket) || 0;
    const incentive = Number(e.incentive) || 0;

    const roomNights = attendees * nights;
    const qualifiedNights = roomNights * (outOfMarket / 100);

    const adr = 140;
    const hotelRevenue = qualifiedNights * adr;

    const hotRate = 0.07;
    const hotRevenue = hotelRevenue * hotRate;

    const roi =
      incentive > 0 ? (hotRevenue / incentive).toFixed(2) : "0.00";

    let decision = "NO-GO";
    if (Number(roi) > 3) decision = "STRONG GO";
    else if (Number(roi) > 2) decision = "GO";
    else if (Number(roi) > 1) decision = "MAYBE";

    return {
      roomNights,
      qualifiedNights,
      hotelRevenue,
      hotRevenue,
      roi,
      decision,
    };
  }

  return (
    <div style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>ETF Playbook</h1>

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
                  maxWidth: "620px",
                }}
              >
                <input
                  value={event.name}
                  onChange={(e) =>
                    updateEvent(event.id, "name", e.target.value)
                  }
                  style={{
                    width: "100%",
                    marginBottom: "14px",
                    padding: "10px",
                    fontSize: "18px",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />

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
                </div>

                <div style={{ lineHeight: "1.8" }}>
                  <div>Room Nights: {Math.round(c.roomNights)}</div>
                  <div>Qualified Nights: {Math.round(c.qualifiedNights)}</div>
                  <div>Hotel Revenue: ${Math.round(c.hotelRevenue).toLocaleString()}</div>
                  <div>HOT Revenue: ${Math.round(c.hotRevenue).toLocaleString()}</div>
                  <div>ROI: {c.roi}x</div>
                </div>

                <div style={{ marginTop: "12px", fontWeight: "bold" }}>
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
