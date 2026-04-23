"use client";

import { useState, useEffect } from "react";

export default function ETFPlaybook() {
  const [events, setEvents] = useState([]);

  // Load from browser storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("etf_events");
      if (saved) setEvents(JSON.parse(saved));
    } catch {}
  }, []);

  // Save to browser storage
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
      incentive: "",
      adr: "140",
      hotRate: "7",
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
    let color = "#991b1b";

    if (Number(roi) > 3) {
      decision = "STRONG GO";
      color = "#065f46";
    } else if (Number(roi) > 2) {
      decision = "GO";
      color = "#166534";
    } else if (Number(roi) > 1) {
      decision = "MAYBE";
      color = "#92400e";
    }

    return {
      roomNights,
      qualifiedNights,
      hotelRevenue,
      hotRevenue,
      roi,
      decision,
      color,
    };
  }

  // Summary totals
  const totals = events.reduce(
    (acc, e) => {
      const c = calculate(e);
      acc.incentives += Number(e.incentive) || 0;
      acc.hot += c.hotRevenue;
      return acc;
    },
    { incentives: 0, hot: 0 }
  );

  return (
    <div style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>ETF Playbook</h1>

      <button
        onClick={addEvent}
        style={{
          background: "#111",
          color: "#fff",
          padding: "10px 16px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        Add Event
      </button>

      {/* Summary */}
      {events.length > 0 && (
        <div style={{ marginBottom: "20px", fontWeight: "bold" }}>
          Total Incentives: ${totals.incentives.toLocaleString()} | Estimated HOT: ${Math.round(totals.hot).toLocaleString()}
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
                  maxWidth: "720px",
                }}
              >
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                  <input
                    value={event.name}
                    onChange={(e) =>
                      updateEvent(event.id, "name", e.target.value)
                    }
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => deleteEvent(event.id)}>Delete</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <input type="number" placeholder="Attendees" value={event.attendees} onChange={(e)=>updateEvent(event.id,"attendees",e.target.value)} />
                  <input type="number" placeholder="Nights" value={event.nights} onChange={(e)=>updateEvent(event.id,"nights",e.target.value)} />
                  <input type="number" placeholder="% Out of Market" value={event.outOfMarket} onChange={(e)=>updateEvent(event.id,"outOfMarket",e.target.value)} />
                  <input type="number" placeholder="Incentive $" value={event.incentive} onChange={(e)=>updateEvent(event.id,"incentive",e.target.value)} />
                  <input type="number" placeholder="ADR" value={event.adr} onChange={(e)=>updateEvent(event.id,"adr",e.target.value)} />
                  <input type="number" placeholder="HOT %" value={event.hotRate} onChange={(e)=>updateEvent(event.id,"hotRate",e.target.value)} />
                </div>

                <div style={{ marginTop: "10px", lineHeight: "1.8" }}>
                  <div>Room Nights: {Math.round(c.roomNights)}</div>
                  <div>Qualified Nights: {Math.round(c.qualifiedNights)}</div>
                  <div>Hotel Revenue: ${Math.round(c.hotelRevenue).toLocaleString()}</div>
                  <div>HOT Revenue: ${Math.round(c.hotRevenue).toLocaleString()}</div>
                  <div>ROI: {c.roi}x</div>
                </div>

                <div style={{ marginTop: "10px", fontWeight: "bold", color: c.color }}>
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
