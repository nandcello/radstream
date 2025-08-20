import { useQuery } from "@tanstack/react-query";
import { useAccessToken } from "./auth";

const baseUrl = "https://www.googleapis.com/youtube/v3";

type IngestionType = "rtmp" | "dash";
type Resolution =
  | "240p"
  | "360p"
  | "480p"
  | "720p"
  | "1080p"
  | "1440p"
  | "2160p";
type FrameRate = "30fps" | "60fps";
type StreamStatus = "created" | "ready" | "active" | "inactive" | "error";
type HealthState = "good" | "ok" | "bad" | "noData" | "revoked";
type IssueType =
  | "videoBitrate"
  | "videoCodec"
  | "audioBitrate"
  | "audioCodec"
  | "audioSampleRate"
  | "audioStereo"
  | "audioChannels";
type IssueSeverity = "error" | "warning" | "info";

// Main resource
export type YouTubeLiveStream = {
  kind: "youtube#liveStream";
  etag: string;
  id: string;

  // Present only if `part=snippet` was requested
  snippet?: {
    publishedAt: string; // ISO datetime
    channelId: string;
    title: string;
    description: string;
    isDefaultStream: boolean;
  };

  // Present only if `part=cdn` was requested
  cdn?: {
    ingestionType: IngestionType;
    ingestionInfo: {
      streamName: string;
      ingestionAddress: string;
      // Only present if a backup ingestion is configured
      backupIngestionAddress?: string;
    };
    resolution: Resolution;
    frameRate: FrameRate;
  };

  // Present only if `part=status` was requested
  status?: {
    streamStatus: StreamStatus;
    healthStatus?: {
      status: HealthState;
      lastUpdateTimeSeconds: number; // unsigned long
      // Only present when there are config/health issues
      configurationIssues?: Array<{
        type: IssueType;
        severity: IssueSeverity;
        reason: string;
        description: string;
      }>;
    };
  };

  // Present only if `part=contentDetails` was requested
  contentDetails?: {
    // Only present if captions ingestion is enabled
    closedCaptionsIngestionUrl?: string;
    isReusable: boolean;
  };
};
const fetchStreams = async (accessToken: string, parts: string) => {
  const args = new URLSearchParams({
    part: parts, // NOTE: correct param name is 'part'
    mine: "true",
  });
  const res = await fetch(`${baseUrl}/liveStreams?${args}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = data?.error?.message || "Failed to fetch liveStreams";
    throw new Error(err);
  }
  return data.items as YouTubeLiveStream[];
};

export const useLivestreamStreamKey = () => {
  const { accessToken } = useAccessToken();
  return useQuery<{ streamKey?: string }>({
    queryKey: ["livestream", "stream-key", accessToken],
    enabled: !!accessToken,
    queryFn: async () => {
      if (!accessToken) return { streamKey: undefined };
      const streams = await fetchStreams(accessToken, "id,cdn");
      const latest = streams[0];
      return { streamKey: latest?.cdn?.ingestionInfo?.streamName };
    },
  });
};

export const useLivestream = () => {
  const { accessToken } = useAccessToken();
  // track previous status for change-diff logging
  let previousStatus: string | undefined;
  const { data, isLoading } = useQuery<{ status: string | undefined }>({
    queryKey: ["livestream", "status", accessToken],
    enabled: !!accessToken,
    refetchInterval: 1000,
    queryFn: async () => {
      if (!accessToken) return { status: undefined };
      const streams = await fetchStreams(accessToken, "id,status");
      const latest = streams[0];
      if (!latest) return { status: undefined };
      const raw = latest?.status?.streamStatus;

      let status: string | undefined = latest?.status?.streamStatus;
      switch (status) {
        case "active":
          status = "receiving data";
          break;
        case "error":
          status = "lost connection";
          break;
        default:
          status = status || "waiting for connection..";
          break;
      }
      if (raw !== previousStatus) {
        console.info(
          "[livestream] status change",
          JSON.stringify(
            {
              streamId: latest?.id,
              previous: previousStatus,
              raw,
              mapped: status,
              health: latest?.status?.healthStatus?.status,
            },
            null,
            0,
          ),
        );
        previousStatus = raw;
      }
      return { status, id: latest?.id };
    },
  });

  return { ...(data ?? {}), isLoading };
};
