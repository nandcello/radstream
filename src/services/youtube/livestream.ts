export * as LiveStream from "./livestream";

const baseUrl = "https://www.googleapis.com/youtube/v3";
// https://developers.google.com/youtube/v3/live/docs/liveStreams#resource
export type Livestream = {
  kind: "youtube#liveStream";
  etag: string;
  id: string;
  snippet: {
    publishedAt: string; // ISO datetime
    channelId: string;
    title: string;
    description: string;
    isDefaultStream: boolean;
  };
  cdn: {
    ingestionType: string;
    ingestionInfo: {
      streamName: string;
      ingestionAddress: string;
      backupIngestionAddress: string;
    };
    resolution: string; // e.g. "variable", "1080p"
    frameRate: string; // e.g. "variable", "60fps"
  };
  status: {
    streamStatus: string; // e.g. "active", "created"
    healthStatus: {
      status: string; // e.g. "good", "noData"
      lastUpdateTimeSeconds: number; // unsigned long
      configurationIssues: Array<{
        type: string;
        severity: string;
        reason: string;
        description: string;
      }>;
    };
  };
  contentDetails: {
    closedCaptionsIngestionUrl: string;
    isReusable: boolean;
  };
};

export const streamKey = async ({ accessToken }: { accessToken: string }) => {
  const args = new URLSearchParams({
    parts: "id,cdn",
    mine: "true",
  });
  const response = await fetch(`${baseUrl}/liveStreams?${args}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  console.log(">>> livestream/streamKey", JSON.stringify(data, null, 2));
  if (!response.ok) throw new Error("stream-key failed", data);
  const latestStream = data.items[0] as Livestream;

  const streamKey = latestStream?.cdn?.ingestionInfo?.streamName;
  return streamKey;
};

export const status = async ({ accessToken }: { accessToken: string }) => {
  const args = new URLSearchParams({
    parts: "id,status",
    mine: "true",
  });
  const response = await fetch(`${baseUrl}/liveStreams?${args}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  console.log(">>> livestream/status", JSON.stringify(data, null, 2));
  if (!response.ok) throw new Error("status failed", data);
  const latestStream = data.items[0] as Livestream;

  const status = latestStream?.status.streamStatus;
  return status;
};
