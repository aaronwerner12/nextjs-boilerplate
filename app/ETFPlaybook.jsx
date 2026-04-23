"use client";

import { useState } from "react";

export default function ETFPlaybook() {
const [events, setEvents] = useState([]);

function addEvent() {
const newEvent = {
id: Date.now(),
name: "New Event " + (events.length + 1),
};

```
setEvents((prev) => [newEvent, ...prev]);
```

}

return (
<div style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}> <h1>ETF Playbook</h1>

```
  <button
    type="button"
    onClick={addEvent}
    style={{
      backgroundColor: "#111",
      color: "#fff",
      border: "none",
      padding: "12px 18px",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "16px",
      fontWeight: "600",
      marginTop: "12px",
      marginBottom: "24px",
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
            padding: "12px 16px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            marginBottom: "10px",
            maxWidth: "400px",
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
