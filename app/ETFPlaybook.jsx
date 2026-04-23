"use client";

import React, { useState, useEffect } from "react";

export default function ETFPlaybook() {
const [events, setEvents] = useState([]);

// Load from localStorage
useEffect(() => {
try {
const stored = localStorage.getItem("vm_etf_events");
if (stored) setEvents(JSON.parse(stored));
} catch (e) {}
}, []);

// Save to localStorage
useEffect(() => {
try {
localStorage.setItem("vm_etf_events", JSON.stringify(events));
} catch (e) {}
}, [events]);

const addEvent = () => {
const newEvent = {
id: Date.now(),
name: "New Event",
attendees: 0,
};
setEvents([newEvent, ...events]);
};

return (
<div style={{ padding: 40, fontFamily: "Arial" }}> <h1>ETF Playbook</h1>

```
  <button onClick={addEvent} style={{ marginBottom: 20 }}>
    Add Event
  </button>

  {events.length === 0 && <p>No events yet</p>}

  {events.map((e) => (
    <div key={e.id} style={{ marginBottom: 10 }}>
      {e.name}
    </div>
  ))}
</div>
```

);
}
