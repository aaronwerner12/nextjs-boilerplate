"use client";

import { useState } from "react";

export default function ETFPlaybook() {
  const [events, setEvents] = useState([]);

  function addEvent() {
    const newEvent = {
      id: Date.now(),
      name: "New Event " + (events.length + 1),
    };

    setEvents([newEvent, ...events]);
  }

  function updateEventName(id, value) {
    setEvents(events.map(e => 
      e.id === id ? { ...e, name: value } : e
    ));
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>ETF Playbook</h1>

      <button onClick={addEvent}>Add Event</button>

      {events.length === 0 ? (
        <p>No events yet</p>
      ) : (
        <div style={{ marginTop: "20px" }}>
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "10px",
                maxWidth: "420px",
              }}
            >
              <input
                value={event.name}
                onChange={(e) => updateEventName(event.id, e.target.value)}
                style={{
                  width: "100%",
                  border: "none",
                  fontSize: "16px",
                  outline: "none"
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
