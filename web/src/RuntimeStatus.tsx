import { useEffect, useState } from "react";
import { getHealth, type HealthStatus } from "./api.js";

/** Setup information stays outside the clinician's case workflow. */
export function RuntimeStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  async function refresh() {
    try {
      setHealth(await getHealth());
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <div className="runtime-status" role="status">
      <strong>Claude workspace</strong>
      {unavailable ? (
        <span> Live server unavailable. The guided tour works without a server or API key.</span>
      ) : health ? (
        <>
          <span>{health.configured ? " Live reasoning is configured." : " Add ANTHROPIC_API_KEY to the server’s .env and restart it to enable live reasoning. The guided tour is available now."}</span>
          {health.experts?.temporary && <span> Web research and coding use temporary integrations while the team modules are built.</span>}
        </>
      ) : <span> Checking live setup… The guided tour is always available.</span>}
      <button className="ghost" onClick={() => void refresh()}>Refresh setup</button>
    </div>
  );
}
