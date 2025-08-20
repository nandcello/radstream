import { useQuery } from "@tanstack/react-query";
import { useAccessToken } from "./auth";

const baseUrl = "https://www.googleapis.com/youtube/v3";

export type LiveBroadcast = {
  kind: "youtube#liveBroadcast";
  etag: string;
  id: string;
  snippet: {
    publishedAt: string; // ISO datetime
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      [key: string]: {
        url: string;
        width: number; // unsigned integer
        height: number; // unsigned integer
      };
    };
    scheduledStartTime: string | undefined; // ISO datetime
    scheduledEndTime: string; // ISO datetime
    actualStartTime: string; // ISO datetime
    actualEndTime: string; // ISO datetime
    isDefaultBroadcast: boolean;
    liveChatId: string;
  };
  status?: {
    lifeCycleStatus: string;
    privacyStatus: string;
    recordingStatus: string;
    madeForKids: string;
    selfDeclaredMadeForKids: string;
  };
  contentDetails?: {
    boundStreamId: string;
    boundStreamLastUpdateTimeMs: string; // ISO datetime
    monitorStream: {
      enableMonitorStream: boolean;
      broadcastStreamDelayMs: number; // unsigned integer
      embedHtml: string;
    };
    enableEmbed: boolean;
    enableDvr: boolean;
    recordFromStart: boolean;
    enableClosedCaptions: boolean;
    closedCaptionsType: string;
    projection: string;
    enableLowLatency: boolean;
    latencyPreference: boolean;
    enableAutoStart: boolean;
    enableAutoStop: boolean;
  };
  statistics?: {
    totalChatCount: number; // unsigned long
  };
  monetizationDetails?: {
    cuepointSchedule: {
      enabled: boolean;
      pauseAdsUntil: string; // ISO datetime
      scheduleStrategy: string;
      repeatIntervalSecs: number; // unsigned integer
    };
  };
};
export const useBroadcast = () => {
  const { accessToken } = useAccessToken();
  const { data, isLoading } = useQuery({
    queryKey: ["broadcast", "info", accessToken],
    queryFn: async () => {
      const args = new URLSearchParams({
        part: "id,snippet,status,contentDetails",
        mine: "true",
      });
      const response = await fetch(`${baseUrl}/liveBroadcasts?${args}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error(
          "[broadcast] fetch error",
          response.status,
          response.statusText,
        );
        throw new Error("Failed to fetch broadcasts");
      }

      const parsedResponse = await response.json();
      const latestBroadcast = parsedResponse.items[0] as LiveBroadcast;
      if (latestBroadcast) {
        console.info(
          "[broadcast] fetched",
          JSON.stringify(
            {
              id: latestBroadcast.id,
              status: latestBroadcast.status?.lifeCycleStatus,
              boundStreamId: latestBroadcast.contentDetails?.boundStreamId,
              scheduledStart: latestBroadcast.snippet?.scheduledStartTime,
            },
            null,
            0,
          ),
        );
      } else {
        console.info("[broadcast] no broadcasts returned");
      }

      return {
        id: latestBroadcast.id,
        status: latestBroadcast.status?.lifeCycleStatus,
        title: latestBroadcast.snippet.title,
        description: latestBroadcast.snippet.description,
        scheduledStartTime: latestBroadcast.snippet.scheduledStartTime,
        boundStreamId: latestBroadcast.contentDetails?.boundStreamId,
      };
    },
    refetchInterval: 1000,
    enabled: !!accessToken,
  });

  return { ...data, isLoading };
};
