"use client";

import { useState } from "react";

export default function ETFPlaybook() {
const [events, setEvents] = useState([]);

function addEvent() {
setEvents((prev) => [
{ id: Date.now(), name: `New Event ${prev.length + 1}` },
...prev,
]);
}

return (
<div style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}> <h1>ETF Playbook</h1>

```
  <button
    type="button"
    onClick={addEvent}
    style={{
      background: "#111",
      color: "#fff",
      border: "none",
      padding: "12px 18px",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "16px",
      fontWeight: 600,
      marginBottom: "20px",
    }}
  >
    Add Event
  </button>

  {events.length === 0 ? (
    <p>No events yet.</p>
  ) : (
    <div>
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
          {event.name}
        </div>
      ))}
    </div>
  )}
</div>
```

);
}
