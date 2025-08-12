type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
};

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: "Bearer";
  scope: string;
  error?: string;
  error_description?: string;
};

const GOOGLE_DEVICE_CODE = "https://oauth2.googleapis.com/device/code";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const YT_API = "https://www.googleapis.com/youtube/v3";
const SCOPE = "https://www.googleapis.com/auth/youtube";
export const GOOGLE_OAUTH_SCOPE = SCOPE;

const TOKEN_PATH = Bun.env.YT_TOKEN_PATH ?? "./.yt-oauth-token.json";

// --- tiny logger helpers (avoid leaking secrets) ---
const YT_LOG_PREFIX = "[YouTube]";
function ytLog(...args: unknown[]) {
  console.log(YT_LOG_PREFIX, ...args);
}
function ytError(...args: unknown[]) {
  console.error(YT_LOG_PREFIX, ...args);
}

function validateString(val: string | undefined) {
  if (val === undefined) throw new Error("Expected a string value");
  return val;
}

function getOAuthClient(): { clientId: string; clientSecret: string } {
  const clientId = validateString(Bun.env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret = validateString(Bun.env.GOOGLE_OAUTH_CLIENT_SECRET);
  return { clientId, clientSecret };
}

// ---- tiny helpers ----
async function postForm<T>(
  url: string,
  form: Record<string, string>,
): Promise<T> {
  const body = new URLSearchParams(form);
  const res = await fetch(url, {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} on ${url}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function getJSON<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} on ${url}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function saveTokenFile(obj: unknown) {
  await Bun.write(TOKEN_PATH, JSON.stringify(obj, null, 2));
}

export async function loadTokenFile<T>(): Promise<T | null> {
  try {
    return JSON.parse(await Bun.file(TOKEN_PATH).text()) as T;
  } catch {
    return null;
  }
}

// ---- OAuth: device flow (first run) or refresh (subsequent runs) ----
async function ensureAccessToken(): Promise<{
  access_token: string;
  refresh_token?: string;
}> {
  const { clientId, clientSecret } = getOAuthClient();
  // Try refresh first if we have a saved token
  const saved = await loadTokenFile<TokenResponse>();
  if (saved?.refresh_token) {
    try {
      ytLog("Using refresh token to obtain access token");
      const refreshed = await postForm<TokenResponse>(GOOGLE_TOKEN, {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: saved.refresh_token,
      });
      await saveTokenFile({
        ...saved,
        ...refreshed,
        refresh_token: saved.refresh_token,
      });
      ytLog("Access token refreshed successfully");
      return {
        access_token: refreshed.access_token,
        refresh_token: saved.refresh_token,
      };
    } catch (e) {
      ytError("Refresh failed, falling back to device flow:", e);
    }
  }

  // Start device flow
  const device = await postForm<DeviceCodeResponse>(GOOGLE_DEVICE_CODE, {
    client_id: clientId,
    scope: SCOPE,
  });

  // Show the user code + URL
  console.log("\nAuthorize this app:");
  console.log(`  Visit: ${device.verification_url}`);
  console.log(`  Code : ${device.user_code}\n`);

  // Poll for token
  const pollIntervalMs = Math.max(5, device.interval) * 1000;
  while (true) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    try {
      const tok = await postForm<TokenResponse>(GOOGLE_TOKEN, {
        client_id: clientId,
        client_secret: clientSecret,
        device_code: device.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });

      await saveTokenFile(tok);
      return {
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("authorization_pending") || msg.includes("slow_down")) {
        continue; // keep polling
      }
      // Re-throw unknown errors
      throw error instanceof Error ? error : new Error(msg);
    }
  }
}

// ---- LiveStreams helpers ----
type YouTubeLiveStreamsList = {
  items: Array<{
    id: string;
    cdn?: {
      ingestionInfo?: {
        streamName?: string;
        ingestionAddress?: string;
        rtmpsIngestionAddress?: string;
      };
    };
    status?: { streamStatus?: string };
    contentDetails?: { isReusable?: boolean };
  }>;
};

type YouTubeLiveStream = YouTubeLiveStreamsList["items"][number];

async function listStreams(
  accessToken: string,
): Promise<YouTubeLiveStreamsList> {
  const url = `${YT_API}/liveStreams?part=cdn,contentDetails,status&mine=true&maxResults=50`;
  return getJSON<YouTubeLiveStreamsList>(url, accessToken);
}

export type YouTubeLiveBroadcast = {
  kind: "youtube#liveBroadcast";
  etag: string;
  id: string;
  snippet: {
    publishedAt: string; // ISO date string
    channelId: string;
    title: string;
    description: string;
    scheduledStartTime?: string; // ISO date string
    scheduledEndTime?: string; // ISO date string
    actualStartTime?: string; // ISO date string
    actualEndTime?: string; // ISO date string
    isDefaultBroadcast?: boolean;
    liveChatId?: string;
  };
  status: {
    lifeCycleStatus:
      | "created"
      | "ready"
      | "testing"
      | "live"
      | "complete"
      | "revoked"
      | "canceled";
    privacyStatus: "private" | "public" | "unlisted";
    recordingStatus: "recording" | "recorded" | "notRecording";
    madeForKids: boolean;
    selfDeclaredMadeForKids: boolean;
  };
};

type YouTubeListBroadcast = {
  items: Array<YouTubeLiveBroadcast>;
};

// List broadcasts by status
async function listBroadcasts(accessToken: string) {
  const url = `${YT_API}/liveBroadcasts?part=id,snippet,contentDetails,status&mine=true&maxResults=50`;
  const data = await getJSON<YouTubeListBroadcast>(url, accessToken);
  ytLog("Fetched broadcasts:", data.items?.length ?? 0);
  return data;
}

// Fetch a broadcast by ID (full parts by default)
async function getBroadcastById(
  accessToken: string,
  id: string,
  part: string = "id,snippet,contentDetails,status",
): Promise<YouTubeLiveBroadcast | null> {
  const url = `${YT_API}/liveBroadcasts?part=${encodeURIComponent(part)}&id=${encodeURIComponent(id)}`;
  const res = await getJSON<YouTubeListBroadcast>(url, accessToken);
  return res.items?.[0] ?? null;
}

export type UpdateBroadcastInput = {
  broadcastId: string;
  title?: string;
  description?: string;
};

// Update a broadcast's title and/or description if provided
export async function updateTitleDescription(
  input: UpdateBroadcastInput,
): Promise<void> {
  const { broadcastId, title, description } = input;
  if (!title && !description) return;

  const { access_token } = await ensureAccessToken();

  // Only include provided fields
  const now = new Date();
  const scheduledStartTime = new Date(
    now.getTime() + 5 * 60 * 1000,
  ).toISOString();
  const snippetUpdates: Record<string, string> = {
    scheduledStartTime,
  };
  if (title !== undefined) snippetUpdates.title = title;
  if (description !== undefined) snippetUpdates.description = description;

  const url = `${YT_API}/liveBroadcasts?part=snippet`;
  ytLog("Updating broadcast snippet", {
    broadcastId,
    titleLen: title?.length ?? 0,
    descLen: description?.length ?? 0,
  });
  const res = await fetch(url, {
    body: JSON.stringify({
      id: broadcastId,
      snippet: snippetUpdates,
    }),
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  if (!res.ok) {
    const text = await res.text();
    ytError("Broadcast update failed", { status: res.status, body: text });
    throw new Error(`Update failed (HTTP ${res.status}): ${text}`);
  }
  ytLog("Broadcast updated", { broadcastId });
}

// ---- Broadcast creation & upsert helpers ----
function isActiveStatus(s: YouTubeLiveBroadcast["status"]["lifeCycleStatus"]) {
  // Treat these as active/editable; exclude complete/canceled/revoked
  return s === "live" || s === "testing" || s === "ready" || s === "created";
}

async function insertBroadcast(
  accessToken: string,
  { title, description }: { title?: string; description?: string },
): Promise<YouTubeLiveBroadcast> {
  const url = `${YT_API}/liveBroadcasts?part=snippet,contentDetails,status`;
  ytLog("Creating new private broadcast", {
    titleLen: title?.length ?? 0,
    descLen: description?.length ?? 0,
  });

  const now = new Date();
  const scheduledStartTime = new Date(
    now.getTime() + 5 * 60 * 1000,
  ).toISOString();
  const snippetBody: Record<string, string> = {
    scheduledStartTime,
  };

  if (title) snippetBody.title = title;
  if (description) snippetBody.description = description;

  const res = await fetch(url, {
    body: JSON.stringify({
      snippet: snippetBody,
      // Keep it private and not started; user can activate later
      status: {
        privacyStatus: "private",
      },
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.text();
    ytError("Create broadcast failed", { status: res.status, body });
    throw new Error(`Insert broadcast failed: ${body}`);
  }
  const created = (await res.json()) as YouTubeLiveBroadcast;
  ytLog("Created broadcast", {
    id: created.id,
    status: created.status?.lifeCycleStatus,
  });
  return created;
}

export async function upsertMostRecentActiveBroadcastTitleDescription(input: {
  title?: string;
  description?: string;
}): Promise<ActiveBroadcastInfo> {
  const { access_token } = await ensureAccessToken();
  const list = await listBroadcasts(access_token);
  // pick most recent among active statuses
  const active = (list.items ?? []).filter((b) =>
    isActiveStatus(b.status.lifeCycleStatus),
  );
  ytLog("Active broadcasts count:", active.length);
  const picked = pickMostRecentBroadcast(active);
  ytLog(
    "Picked broadcast:",
    picked ? { id: picked.id, status: picked.status.lifeCycleStatus } : null,
  );

  if (picked) {
    ytLog("Updating existing broadcast", { id: picked.id });
    await updateTitleDescription({
      broadcastId: picked.id,
      title: input.title,
      description: input.description,
    });
    // fetch updated to return fresh values
    const updated = (await getBroadcastById(access_token, picked.id)) ?? picked;
    ytLog("Updated broadcast fetched", {
      id: updated.id,
      status: updated.status.lifeCycleStatus,
    });
    return {
      actualStartTime: updated.snippet.actualStartTime,
      id: updated.id,
      liveChatId: updated.snippet.liveChatId,
      privacyStatus: updated.status.privacyStatus,
      raw: updated,
      status: updated.status.lifeCycleStatus,
      title: updated.snippet.title,
      url: `https://www.youtube.com/watch?v=${updated.id}`,
    };
  }

  // none active: create new private broadcast (not active)
  const created = await insertBroadcast(access_token, input);
  ytLog("Returning newly created broadcast", { id: created.id });
  return {
    actualStartTime: created.snippet.actualStartTime,
    id: created.id,
    liveChatId: created.snippet.liveChatId,
    privacyStatus: created.status.privacyStatus,
    raw: created,
    status: created.status.lifeCycleStatus,
    title: created.snippet.title,
    url: `https://www.youtube.com/watch?v=${created.id}`,
  };
}
// Pick the most recent broadcast by actualStartTime, falling back to publishedAt
export function pickMostRecentBroadcast(
  items: YouTubeLiveBroadcast[] | undefined,
): YouTubeLiveBroadcast | null {
  if (!items || items.length === 0) return null;
  const timeOf = (b: YouTubeLiveBroadcast) => {
    const s = b.snippet;
    const candidate =
      s.actualStartTime ||
      s.scheduledStartTime ||
      s.actualEndTime ||
      s.publishedAt;
    return candidate ? Date.parse(candidate) : 0;
  };
  let newest: YouTubeLiveBroadcast | null = null;
  let newestTs = -Infinity;
  for (const b of items) {
    const t = timeOf(b);
    if (t > newestTs) {
      newest = b;
      newestTs = t;
    }
  }
  return newest;
}

export type ActiveBroadcastInfo = {
  id: string;
  title: string;
  status: YouTubeLiveBroadcast["status"]["lifeCycleStatus"];
  privacyStatus: YouTubeLiveBroadcast["status"]["privacyStatus"];
  actualStartTime?: string;
  liveChatId?: string;
  url: string; // https://www.youtube.com/watch?v=ID
  raw: YouTubeLiveBroadcast; // full object for advanced callers
};

export async function getMostRecentBroadcastAnyStatus(): Promise<ActiveBroadcastInfo | null> {
  const { access_token } = await ensureAccessToken();
  const broadcasts = await listBroadcasts(access_token);

  const picked = pickMostRecentBroadcast(broadcasts.items);
  if (!picked) return null;
  ytLog("Most recent broadcast (any status)", {
    id: picked.id,
    status: picked.status.lifeCycleStatus,
  });
  return {
    actualStartTime: picked.snippet.actualStartTime,
    id: picked.id,
    liveChatId: picked.snippet.liveChatId,
    privacyStatus: picked.status.privacyStatus,
    raw: picked,
    status: picked.status.lifeCycleStatus,
    title: picked.snippet.title,
    url: `https://www.youtube.com/watch?v=${picked.id}`,
  };
}

async function insertReusableStream(accessToken: string): Promise<string> {
  const url = `${YT_API}/liveStreams?part=snippet,cdn,contentDetails`;
  const res = await fetch(url, {
    body: JSON.stringify({
      cdn: { ingestionType: "rtmp" },
      contentDetails: { isReusable: true },
      snippet: { title: "CLI reusable stream" },
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!res.ok) throw new Error(`Insert failed: ${await res.text()}`);
  const data = (await res.json()) as YouTubeLiveStream;
  return data?.cdn?.ingestionInfo?.streamName as string;
}

// ---- Main: get or create a stream key ----
export async function getYouTubeStreamKey(): Promise<{
  streamKey: string;
  ingestUrl?: string;
}> {
  const { access_token } = await ensureAccessToken();
  const list = await listStreams(access_token);

  // Prefer an existing reusable stream
  for (const s of list.items ?? []) {
    const key = s.cdn?.ingestionInfo?.streamName;
    if (key && (s.contentDetails?.isReusable ?? true)) {
      const ingest =
        s.cdn?.ingestionInfo?.rtmpsIngestionAddress ??
        s.cdn?.ingestionInfo?.ingestionAddress;
      return { ingestUrl: ingest, streamKey: key };
    }
  }

  // Otherwise create a new reusable stream
  const streamKey = await insertReusableStream(access_token);
  return { streamKey };
}

// Peek only: return an existing reusable stream key if present, without creating one
export async function peekYouTubeStreamKey(): Promise<{
  streamKey?: string;
  ingestUrl?: string;
}> {
  const { access_token } = await ensureAccessToken();
  const list = await listStreams(access_token);
  for (const s of list.items ?? []) {
    const key = s.cdn?.ingestionInfo?.streamName;
    if (key && (s.contentDetails?.isReusable ?? true)) {
      const ingest =
        s.cdn?.ingestionInfo?.rtmpsIngestionAddress ??
        s.cdn?.ingestionInfo?.ingestionAddress;
      return { ingestUrl: ingest, streamKey: key };
    }
  }
  return {};
}

// Run directly: bun run src/youtube-stream-key.ts
if (import.meta.main) {
  getYouTubeStreamKey()
    .then(({ streamKey, ingestUrl }) => {
      // 🔒 Treat streamKey like a password. Do not print in CI logs.
      console.log("✅ Got stream key.");
      if (ingestUrl) console.log("Ingest URL:", ingestUrl);
      // If you really want to see it locally, uncomment below at your own risk:
      console.log("Stream key:", streamKey);
    })
    .catch((err) => {
      console.error("Failed to get stream key:", err);
      process.exit(1);
    });
}
