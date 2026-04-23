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

return (
<div style={{ padding: "40px" }}> <h1>ETF Playbook</h1>


  <button onClick={addEvent}>Add Event</button>

  {events.length === 0 ? (
    <p>No events yet</p>
  ) : (
   <div>
  {events.map((event) => (
    <div key={event.id}>{event.name}</div>
  ))}
</div>
  )}
</div>


);
}
