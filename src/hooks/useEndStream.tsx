import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccessToken } from "./auth";
import { useBroadcast } from "./useBroadcast";

const baseUrl = "https://www.googleapis.com/youtube/v3";

// Reuse transition logic specific for ending a broadcast (live -> complete)
const transitionBroadcast = async (
  accessToken: string,
  broadcastId: string,
  broadcastStatus: "complete",
) => {
  const params = new URLSearchParams({
    id: broadcastId,
    broadcastStatus,
    part: "status",
  });
  const res = await fetch(
    `${baseUrl}/liveBroadcasts/transition?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  const data = await res.json();
  if (!res.ok) {
    const err = data?.error?.message || "Failed to end broadcast";
    throw new Error(err);
  }
  const item = data.items?.[0];
  return {
    status: item?.status?.lifeCycleStatus as string | undefined,
  };
};

export const useEndStream = () => {
  const { accessToken } = useAccessToken();
  const { id: broadcastId, status: broadcastStatus } = useBroadcast();
  const queryClient = useQueryClient();

  const mutation = useMutation<{ status: string | undefined }, Error, void>({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Missing access token");
      if (!broadcastId) throw new Error("No active broadcast id");
      if (broadcastStatus !== "live")
        throw new Error("Broadcast not live – cannot end");

      console.info(
        "[endStream] transitioning broadcast to complete",
        JSON.stringify({ broadcastId }, null, 0),
      );
      const { status } = await transitionBroadcast(
        accessToken,
        broadcastId,
        "complete",
      );
      console.info(
        "[endStream] transition response",
        JSON.stringify({ broadcastId, status }, null, 0),
      );

      // invalidate queries so UI updates promptly
      queryClient.invalidateQueries({ queryKey: ["broadcast"] });
      queryClient.invalidateQueries({ queryKey: ["livestream"] });

      return { status };
    },
    onError: (error) => {
      console.error(
        "[endStream] error",
        JSON.stringify({ message: error.message }, null, 0),
      );
    },
    onSuccess: (data) => {
      console.info("[endStream] success", JSON.stringify(data, null, 0));
    },
  });

  return {
    endStream: mutation.mutate,
    endStreamAsync: mutation.mutateAsync,
    ...mutation,
  };
};
