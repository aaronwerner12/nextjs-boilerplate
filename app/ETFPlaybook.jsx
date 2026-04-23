"use client";
import { useState } from "react";

export default function ETFPlaybook() {
const [count, setCount] = useState(0);

return (
<div style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}> <h1>ETF Playbook</h1>

```
  <button
    type="button"
    onClick={() => setCount(count + 1)}
    style={{
      backgroundColor: "#111",
      color: "#fff",
      border: "none",
      padding: "12px 18px",
      borderRadius: "8px",
      cursor: "pointer"
    }}
  >
    Add Event
  </button>

  <p>Count: {count}</p>
</div>
```

);
}
