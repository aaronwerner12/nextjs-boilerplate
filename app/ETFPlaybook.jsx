"use client";

import { useState, useEffect } from "react";

export default function ETFPlaybook() {
  const [events, setEvents] = useState([]);

  // Load saved data
  useEffect(() => {
    try {
      const saved = localStorage.getItem("etf_events");
      if (saved) setEvents(JSON.parse(saved));
    } catch {}
  }, []);

  // Save data
  useEffect(() => {
    try {
      localStorage.setItem("etf_events", JSON.stringify(events));
    } catch {}
  }, [events]);

  function addEvent() {
    const newEvent = {
      id: Date.now(),
      name: "New Event",
      attendees: "",
      nights: "",
      outOfMarket: "",
      adr: "140",
      hotRate: "7",
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

    const adr = Number(e.adr) || 0;
    const hotRate = (Number(e.hotRate) || 0) / 100;
    const incentive = Number(e.incentive) || 0;

    const roomNights = attendees * nights;
    const qualifiedNights = roomNights * (outOfMarket / 100);
    const hotelRevenue = qualifiedNights * adr;
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
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>ETF Playbook</h1>

      <button
        onClick={addEvent}
        style={{
          background: "#111",
          color: "#fff",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        Add Event
      </button>

      {events.length === 0 ? (
        <p>No events yet</p>
      ) : (
        events.map((event) => {
          const c = calculate(event);

          return (
            <div
              key={event.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "16px",
                maxWidth: "520px",
              }}
            >
              <input
                value={event.name}
                onChange={(e) =>
                  updateEvent(event.id, "name", e.target.value)
                }
                style={{
                  width: "100%",
                  marginBottom: "10px",
                  padding: "8px",
                }}
              />

              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <input
                  type="number"
                  placeholder="Attendees"
                  value={event.attendees}
                  onChange={(e) =>
                    updateEvent(event.id, "attendees", e.target.value)
                  }
                />
                <input
                  type="number"
                  placeholder="Nights"
                  value={event.nights}
                  onChange={(e) =>
                    updateEvent(event.id, "nights", e.target.value)
                  }
                />
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <input
                  type="number"
                  placeholder="% Out of Market"
                  value={event.outOfMarket}
                  onChange={(e) =>
                    updateEvent(event.id, "outOfMarket", e.target.value)
                  }
                />
                <input
                  type="number"
                  placeholder="Incentive ($)"
                  value={event.incentive}
                  onChange={(e) =>
                    updateEvent(event.id, "incentive", e.target.value)
                  }
                />
              </div>

              <div>
                <div>Room Nights: {Math.round(c.roomNights)}</div>
                <div>Qualified Nights: {Math.round(c.qualifiedNights)}</div>
                <div>
                  Hotel Revenue: ${Math.round(c.hotelRevenue).toLocaleString()}
                </div>
                <div>
                  HOT Revenue: ${Math.round(c.hotRevenue).toLocaleString()}
                </div>
                <div>ROI: {c.roi}x</div>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontWeight: "bold",
                }}
              >
                Decision: {c.decision}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
