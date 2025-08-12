import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import "./index.css";

export function App() {
  const qc = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: auth, isLoading: authLoading } = useQuery({
    queryFn: async () => {
      const r = await fetch("/api/youtube/auth-status");
      if (!r.ok) throw new Error("auth-status failed");
      return (await r.json()) as { authorized: boolean };
    },
    queryKey: ["yt-auth"],
  });

  const streamKeyMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/youtube/stream-key");
      if (!r.ok) throw new Error("stream-key failed");
      return (await r.json()) as {
        streamKey?: string;
        ingestUrl?: string;
        streamStatus?: string;
        healthStatus?: string;
      };
    },
    mutationKey: ["yt-stream-key"],
  });

  // Always peek for an existing stream key when authorized
  const { data: peek, isLoading: peekLoading } = useQuery({
    enabled: !!auth?.authorized,
    queryFn: async () => {
      const r = await fetch("/api/youtube/stream-key/peek");
      if (!r.ok) throw new Error("stream-key-peek failed");
      return (await r.json()) as {
        streamKey?: string;
        ingestUrl?: string;
        streamStatus?: string;
        healthStatus?: string;
      };
    },
    queryKey: ["yt-stream-key-peek"],
  });

  const connectYouTube = () => {
    location.href = "/api/oauth/google/login";
  };

  // Latest broadcast info
  const { data: latest, isLoading: latestLoading } = useQuery({
    enabled: !!auth?.authorized,
    queryFn: async () => {
      const r = await fetch("/api/youtube/latest-broadcast");
      if (!r.ok) throw new Error("latest-broadcast failed");
      return (await r.json()) as {
        broadcast: null | {
          id: string;
          title: string;
          description: string;
          url: string;
          status: string;
          streamStatus?: string;
          healthStatus?: string;
        };
      };
    },
    queryKey: ["yt-latest-broadcast"],
  });

  // Local edit form state (prefill when latest loads)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (latest?.broadcast) {
      setTitle(latest.broadcast.title ?? "");
      setDescription(latest.broadcast.description ?? "");
    } else {
      setTitle("");
      setDescription("");
    }
  }, [latest?.broadcast?.id]);

  const saveBroadcast = useMutation({
    mutationFn: async (body: { title?: string; description?: string }) => {
      const r = await fetch("/api/youtube/broadcast/save", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!r.ok) throw new Error("save-broadcast failed");
      return (await r.json()) as {
        broadcast: null | {
          id: string;
          title: string;
          description: string;
          url: string;
          status: string;
          streamStatus?: string;
          healthStatus?: string;
        };
      };
    },
    mutationKey: ["yt-broadcast-save"],
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["yt-latest-broadcast"] });
    },
  });

  const resolvedKey = peekLoading
    ? ""
    : (peek?.streamKey ?? streamKeyMutation.data?.streamKey ?? "");

  const displayKey = resolvedKey
    ? showKey
      ? resolvedKey
      : "••••••••••" // don't leak exact length
    : "";

  // Prefer peek (non-creating) statuses, fall back to mutation response
  const resolvedStreamStatus = peekLoading
    ? undefined
    : (peek?.streamStatus ?? streamKeyMutation.data?.streamStatus);
  const resolvedHealthStatus = peekLoading
    ? undefined
    : (peek?.healthStatus ?? streamKeyMutation.data?.healthStatus);

  const copyKey = async () => {
    if (!resolvedKey) return;
    try {
      await navigator.clipboard.writeText(resolvedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  };

  return (
    <>
      <h1>Radstream</h1>
      {authLoading && <p>Checking YouTube authorization…</p>}
      {auth && !auth.authorized && (
        <div style={{ marginBottom: 16 }}>
          <p>Not connected to YouTube.</p>
          <button onClick={connectYouTube} type="button">
            Connect YouTube
          </button>
        </div>
      )}
      {auth?.authorized && (
        <div style={{ marginBottom: 16 }}>
          <button
            disabled={streamKeyMutation.isPending}
            onClick={() => streamKeyMutation.mutate()}
            type="button"
          >
            {streamKeyMutation.isPending ? "Fetching…" : "Get Stream Key"}
          </button>
          {streamKeyMutation.error && (
            <p style={{ color: "tomato" }}>Failed to fetch stream key.</p>
          )}
        </div>
      )}
      <h2>YouTube Stream Key:</h2>
      <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{displayKey}</h3>
        {resolvedKey && (
          <>
            <button
              aria-pressed={showKey}
              onClick={() => setShowKey((s) => !s)}
              type="button"
            >
              {showKey ? "Hide" : "Show"}
            </button>
            <button disabled={!resolvedKey} onClick={copyKey} type="button">
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        )}
      </div>
      {auth?.authorized && (
        <LivestreamStatuses
          streamStatus={resolvedStreamStatus}
          healthStatus={resolvedHealthStatus}
        />
      )}

      {auth?.authorized && (
        <div style={{ marginTop: 24 }}>
          <h2>Latest Broadcast</h2>
          {latestLoading && <p>Loading broadcast…</p>}
          {!latestLoading && latest?.broadcast && (
            <div>
              <BroadcastStatus status={latest.broadcast.status} />
              <LivestreamStatuses
                streamStatus={latest.broadcast.streamStatus}
                healthStatus={latest.broadcast.healthStatus}
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveBroadcast.mutate({ title, description });
                }}
                style={{ display: "grid", gap: 8, maxWidth: 640 }}
              >
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Broadcast title"
                    type="text"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Broadcast description"
                    rows={6}
                  />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={saveBroadcast.isPending} type="submit">
                    {saveBroadcast.isPending ? "Saving…" : "Save"}
                  </button>
                  {saveBroadcast.error && (
                    <span style={{ color: "tomato" }}>Save failed.</span>
                  )}
                </div>
              </form>
            </div>
          )}
          {!latestLoading && latest && latest.broadcast === null && (
            <div>
              <p>No active broadcast found. Create one:</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveBroadcast.mutate({ title, description });
                }}
                style={{ display: "grid", gap: 8, maxWidth: 640 }}
              >
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Broadcast title"
                    type="text"
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Broadcast description"
                    rows={6}
                  />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={saveBroadcast.isPending} type="submit">
                    {saveBroadcast.isPending ? "Creating…" : "Create"}
                  </button>
                  {saveBroadcast.error && (
                    <span style={{ color: "tomato" }}>Action failed.</span>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default App;

// --- Helpers (could move to separate file later) ---
type LifeCycleStatus =
  | "created"
  | "ready"
  | "testing"
  | "live"
  | "complete"
  | "revoked"
  | "canceled";

function humanizeStatus(s: LifeCycleStatus): { label: string; color: string } {
  switch (s) {
    case "live":
      return { label: "Live", color: "#dc2626" }; // red-600
    case "created":
    case "ready":
    case "testing":
      return { label: "Starting Soon", color: "#f59e0b" }; // amber-500
    case "complete":
      return { label: "Ended", color: "#16a34a" }; // green-600
    case "canceled":
    case "revoked":
      return {
        label: s === "canceled" ? "Canceled" : "Revoked",
        color: "#6b7280",
      }; // gray-500
    default:
      return { label: s, color: "#6b7280" };
  }
}

function BroadcastStatus({ status }: { status: string }) {
  const { label, color } = humanizeStatus(status as LifeCycleStatus);
  return (
    <p style={{ margin: "2px 0 8px", fontWeight: 500 }}>
      Status: <span style={{ color }}>{label}</span>
    </p>
  );
}

function LivestreamStatuses(props: {
  streamStatus?: string;
  healthStatus?: string;
}) {
  const { streamStatus, healthStatus } = props;
  if (!streamStatus && !healthStatus) return null;
  return (
    <div style={{ display: "flex", gap: 12, margin: "0 0 8px" }}>
      {typeof streamStatus === "string" && (
        <span>
          Stream: <strong>{streamStatus}</strong>
        </span>
      )}
      {typeof healthStatus === "string" && (
        <span>
          Health: <strong>{healthStatus}</strong>
        </span>
      )}
    </div>
  );
}
