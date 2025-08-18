import { useQuery } from "@tanstack/react-query";
import { useAccessToken } from "./auth";

const baseUrl = "https://www.googleapis.com/youtube/v3";

// Type for a YouTube livestream (subset we need)
export type Livestream = {
  kind: "youtube#liveStream";
  id: string;
  cdn?: {
    ingestionInfo?: {
      streamName?: string;
    };
  };
  status?: {
    streamStatus?: string; // active | created | ready | testing | live | complete | revoked | error
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
  return data.items as Livestream[];
};

export const useLivestreamStreamKey = () => {
  const { accessToken } = useAccessToken();
  return useQuery<{ streamKey?: string }>({
    queryKey: ["livestream", "stream-key"],
    enabled: !!accessToken,
    queryFn: async () => {
      if (!accessToken) return { streamKey: undefined };
      const streams = await fetchStreams(accessToken, "id,cdn");
      const latest = streams[0];
      return { streamKey: latest?.cdn?.ingestionInfo?.streamName };
    },
  });
};

export const useLivestreamStatus = () => {
  const { accessToken } = useAccessToken();
  return useQuery<{ status: string | undefined }>({
    queryKey: ["livestream", "status"],
    enabled: !!accessToken,
    // refetchInterval: 1000,
    queryFn: async () => {
      if (!accessToken) return { status: undefined };
      const streams = await fetchStreams(accessToken, "id,status");
      const latest = streams[0];
      let status = latest?.status?.streamStatus;
      switch (status) {
        case "active":
          status = "streaming";
          break;
        case "error":
          status = "lost connection";
          break;
        default:
          status = status || "waiting for connection..";
          break;
      }
      return { status };
    },
  });
};
