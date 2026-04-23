"use client";

import { useState } from "react";

export default function ETFPlaybook() {
  const [events, setEvents] = useState([]);

  function addEvent() {
    const newEvent = {
      id: Date.now(),
      name: "New Event",
      attendees: 0,
      nights: 0,
      outOfMarket: 0,
      incentive: 0,
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
    const roomNights = e.attendees * e.nights;
    const qualifiedNights = roomNights * (e.outOfMarket / 100);

    const adr = 140;
    const hotelRevenue = qualifiedNights * adr;

    const hotRate = 0.07;
    const hotRevenue = hotelRevenue * hotRate;

    const roi = e.incentive > 0 ? (hotRevenue / e.incentive).toFixed(2) : 0;

    let decision = "NO-GO";
    if (roi > 3) decision = "STRONG GO";
    else if (roi > 2) decision = "GO";
    else if (roi > 1) decision = "MAYBE";

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
    <div style={{ padding: "40px" }}>
      <h1>ETF Playbook</h1>

      <button onClick={addEvent}>Add Event</button>

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
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "12px",
                  maxWidth: "520px",
                }}
              >
                <input
                  value={event.name}
                  onChange={(e) => updateEvent(event.id, "name", e.target.value)}
                  style={{ width: "100%", marginBottom: "10px" }}
                />

                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  <input
                    type="number"
                    placeholder="Attendees"
                    value={event.attendees}
                    onChange={(e) =>
                      updateEvent(event.id, "attendees", Number(e.target.value))
                    }
                  />
                  <input
                    type="number"
                    placeholder="Nights"
                    value={event.nights}
                    onChange={(e) =>
                      updateEvent(event.id, "nights", Number(e.target.value))
                    }
                  />
                  <input
                    type="number"
                    placeholder="% OOM"
                    value={event.outOfMarket}
                    onChange={(e) =>
                      updateEvent(event.id, "outOfMarket", Number(e.target.value))
                    }
                  />
                </div>

                <input
                  type="number"
                  placeholder="City Incentive ($)"
                  value={event.incentive}
                  onChange={(e) =>
                    updateEvent(event.id, "incentive", Number(e.target.value))
                  }
                  style={{ marginBottom: "10px" }}
                />

                <div>
                  <div>Room Nights: {Math.round(c.roomNights)}</div>
                  <div>Qualified Nights: {Math.round(c.qualifiedNights)}</div>
                  <div>Hotel Revenue: ${Math.round(c.hotelRevenue).toLocaleString()}</div>
                  <div>HOT Revenue: ${Math.round(c.hotRevenue).toLocaleString()}</div>
                  <div>ROI: {c.roi}x</div>
                </div>

                <div style={{ marginTop: "10px", fontWeight: "bold" }}>
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
