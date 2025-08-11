type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
};

type TokenResponse = {
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

const TOKEN_PATH = Bun.env.YT_TOKEN_PATH ?? "./.yt-oauth-token.json";

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
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
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

async function saveTokenFile(obj: unknown) {
  await Bun.write(TOKEN_PATH, JSON.stringify(obj, null, 2));
}

async function loadTokenFile<T>(): Promise<T | null> {
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
      return {
        access_token: refreshed.access_token,
        refresh_token: saved.refresh_token,
      };
    } catch (e) {
      console.warn("Refresh failed, falling back to device flow:", e);
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

// Active broadcasts: currently live/testing/ready under the authenticated channel
async function listActiveBroadcasts(accessToken: string) {
  const url = `${YT_API}/liveBroadcasts?part=id,snippet,contentDetails,status&mine=true&broadcastStatus=active&maxResults=50`;
  return getJSON<YouTubeListBroadcast>(url, accessToken);
}

// Fetch a broadcast by ID (snippet only by default)
async function getBroadcastById(
  accessToken: string,
  id: string,
  part: string = "id,snippet,contentDetails,status",
): Promise<YouTubeLiveBroadcast | null> {
  const url = `${YT_API}/liveBroadcasts?part=${encodeURIComponent(
    part,
  )}&id=${encodeURIComponent(id)}`;
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
  const snippetUpdates: Record<string, string> = {};
  if (title !== undefined) snippetUpdates.title = title;
  if (description !== undefined) snippetUpdates.description = description;

  const url = `${YT_API}/liveBroadcasts?part=snippet`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: broadcastId,
      snippet: snippetUpdates,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update failed (HTTP ${res.status}): ${text}`);
  }
}

// Pick the most recent broadcast by actualStartTime, falling back to publishedAt
export function pickMostRecentBroadcast(
  items: YouTubeLiveBroadcast[] | undefined,
): YouTubeLiveBroadcast | null {
  if (!items || items.length === 0) return null;
  const copy = items.slice();
  copy.sort((a, b) => {
    const aStr = a.snippet.actualStartTime ?? a.snippet.publishedAt;
    const bStr = b.snippet.actualStartTime ?? b.snippet.publishedAt;
    const ta = aStr ? Date.parse(aStr) : 0;
    const tb = bStr ? Date.parse(bStr) : 0;
    return tb - ta; // newest first
  });
  return copy[0] ?? null;
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

// Retrieve the most recent active broadcast for the authenticated channel
export async function getMostRecentActiveBroadcast(): Promise<ActiveBroadcastInfo | null> {
  const { access_token } = await ensureAccessToken();
  const list = await listActiveBroadcasts(access_token);
  const picked = pickMostRecentBroadcast(list.items);
  if (!picked) return null;

  return {
    id: picked.id,
    title: picked.snippet.title,
    status: picked.status.lifeCycleStatus,
    privacyStatus: picked.status.privacyStatus,
    actualStartTime: picked.snippet.actualStartTime,
    liveChatId: picked.snippet.liveChatId,
    url: `https://www.youtube.com/watch?v=${picked.id}`,
    raw: picked,
  };
}

async function insertReusableStream(accessToken: string): Promise<string> {
  const url = `${YT_API}/liveStreams?part=snippet,cdn,contentDetails`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: { title: "CLI reusable stream" },
      cdn: { ingestionType: "rtmp" },
      contentDetails: { isReusable: true },
    }),
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
      return { streamKey: key, ingestUrl: ingest };
    }
  }

  // Otherwise create a new reusable stream
  const streamKey = await insertReusableStream(access_token);
  return { streamKey };
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
