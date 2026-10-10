import { useEffect, useState } from "react";

import { formatElapsed } from "@/lib/format";

/** Görüşme süresi — saniyede bir tazelenir. */
export function useCallTimer(startedAt: number | undefined): string {
  const [label, setLabel] = useState("00:00");

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setLabel(formatElapsed(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return label;
}
