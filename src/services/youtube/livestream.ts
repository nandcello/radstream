const baseUrl = "https://www.googleapis.com/youtube/v3";

// https://developers.google.com/youtube/v3/live/docs/liveStreams#resource-representation
export type LiveStream = {
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
    resolution: string;
    frameRate: string;
  };
  status: {
    streamStatus: string;
    healthStatus: {
      status: string; // "good", "ok", "bad", "noData", "revoked"
      lastUpdateTimeSeconds: string;
      configurationIssues: Array<{
        type: string;
        severity: string;
        reason: string;
        description: string;
      }>;
    };
  };
};

export const getHealthStatus = async ({
  accessToken,
}: {
  accessToken: string;
}) => {
  // Get live streams for the authenticated user
  const args = new URLSearchParams({
    part: "status",
    mine: "true",
    maxResults: "1",
  });

  const response = await fetch(`${baseUrl}/liveStreams?${args}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("livestream-health-status failed");
  }

  const data = await response.json();
  const liveStream = data.items?.[0] as Pick<LiveStream, "status"> | undefined;

  return {
    healthStatus: liveStream?.status?.healthStatus?.status || "noData",
  };
};
