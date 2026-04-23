"use client";
import { useState } from "react";

export default function ETFPlaybook() {
  const [count, setCount} = useState(0);

return (
  <div>
  <h1>ETF Playbook</h1>h1>
  <button onClick={() => setcount(count +1)}>Add Event</button>button>
  <p>Count: {count}</p>p>
  </div>
  );
}
