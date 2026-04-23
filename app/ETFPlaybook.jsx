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
outOfMarket: 0
};

```
setEvents([newEvent, ...events]);
```

}

function updateEvent(id, field, value) {
setEvents(events.map(e =>
e.id === id ? { ...e, [field]: value } : e
));
}

function calculateScore(e) {
const roomNights = e.attendees * e.nights;
const weighted = roomNights * (e.outOfMarket / 100);

```
if (weighted > 5000) return "STRONG GO";
if (weighted > 2000) return "GO";
if (weighted > 500) return "MAYBE";
return "NO-GO";
```

}

return (
<div style={{ padding: "40px" }}> <h1>ETF Playbook</h1>

```
  <button onClick={addEvent}>Add Event</button>

  {events.length === 0 ? (
    <p>No events yet</p>
  ) : (
    <div style={{ marginTop: "20px" }}>
      {events.map((event) => {
        const score = calculateScore(event);

        return (
          <div
            key={event.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "12px",
              maxWidth: "500px"
            }}
          >
            {/* Event Name */}
            <input
              value={event.name}
              onChange={(e) => updateEvent(event.id, "name", e.target.value)}
              style={{ width: "100%", marginBottom: "10px", fontSize: "16px" }}
            />

            {/* Attendees */}
            <input
              type="number"
              placeholder="Attendees"
              value={event.attendees}
              onChange={(e) => updateEvent(event.id, "attendees", Number(e.target.value))}
              style={{ marginRight: "8px" }}
            />

            {/* Nights */}
            <input
              type="number"
              placeholder="Nights"
              value={event.nights}
              onChange={(e) => updateEvent(event.id, "nights", Number(e.target.value))}
              style={{ marginRight: "8px" }}
            />

            {/* Out of Market % */}
            <input
              type="number"
              placeholder="% Out of Market"
              value={event.outOfMarket}
              onChange={(e) => updateEvent(event.id, "outOfMarket", Number(e.target.value))}
            />

            {/* Result */}
            <div style={{ marginTop: "10px", fontWeight: "bold" }}>
              Decision: {score}
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
```

);
}
