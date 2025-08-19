import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccessToken } from "./auth";
import { useBroadcast } from "./useBroadcast";
import { useLivestream } from "./useLivestream";

const baseUrl = "https://www.googleapis.com/youtube/v3";

// Minimal shape of what we need from broadcast & livestream
interface StartStreamOptions {
  broadcastId?: string;
  streamId?: string; // livestream id
}

interface StartStreamResult {
  broadcastId: string;
  streamId: string;
  status: string | undefined; // resulting lifecycle status after transition
}

// Creates a new live broadcast copying the previous title/description (if any)
// and scheduling it to start immediately (now + a small buffer)
const createBroadcast = async (
  accessToken: string,
  title?: string,
  description?: string,
) => {
  const now = new Date();
  // Schedule start time slightly in the future to satisfy API (avoid past time)
  const scheduledStartTime = new Date(now.getTime() + 30 * 1000).toISOString();
  const body = {
    snippet: {
      title: title || `New Stream ${now.toLocaleString()}`,
      description: description || "",
      scheduledStartTime,
    },
    status: {
      privacyStatus: "public",
    },
    contentDetails: {
      enableAutoStart: false,
    },
  };
  const params = new URLSearchParams({
    part: "id,snippet,status,contentDetails",
  });
  const res = await fetch(`${baseUrl}/liveBroadcasts?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  // removed noisy log; will add structured logging in mutation flow
  if (!res.ok) {
    const err = data?.error?.message || "Failed to create broadcast";
    throw new Error(err);
  }
  const item = data.items?.[0];
  return {
    id: item?.id as string,
    status: item?.status?.lifeCycleStatus as string | undefined,
  };
};

const bindBroadcastToStream = async (
  accessToken: string,
  broadcastId: string,
  streamId: string,
) => {
  const params = new URLSearchParams({
    part: "id,contentDetails,status",
    id: broadcastId,
    streamId,
  });
  const res = await fetch(
    `${baseUrl}/liveBroadcasts/bind?${params.toString()}`,
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
    const err = data?.error?.message || "Failed to bind broadcast to stream";
    throw new Error(err);
  }
  const item = data.items?.[0];
  return {
    status: item?.status?.lifeCycleStatus as string | undefined,
  };
};

const transitionBroadcast = async (
  accessToken: string,
  broadcastId: string,
  broadcastStatus: "live" | "testing" | "complete",
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
    const err = data?.error?.message || "Failed to transition broadcast";
    throw new Error(err);
  }
  const item = data.items?.[0];
  return {
    status: item?.status?.lifeCycleStatus as string | undefined,
  };
};

export const useStartStream = () => {
  const { accessToken } = useAccessToken();
  const queryClient = useQueryClient();
  const broadcast = useBroadcast();
  // useLivestream returns { id?, status?, isLoading }
  const livestream = useLivestream() as {
    id?: string;
    status?: string;
    isLoading: boolean;
  };

  const mutation = useMutation<StartStreamResult, Error, StartStreamOptions>({
    mutationFn: async (opts) => {
      if (!accessToken) throw new Error("Missing access token");
      console.info(
        "[startStream] mutation begin",
        JSON.stringify({ opts }, null, 0),
      );
      let workingBroadcastId = opts.broadcastId || broadcast.id;

      // If current broadcast isn't ready, create a new one copying title/description
      if (
        !workingBroadcastId ||
        (broadcast.status &&
          !["ready", "created", "testing"].includes(broadcast.status))
      ) {
        console.info(
          "[startStream] creating new broadcast",
          JSON.stringify(
            {
              reason: !workingBroadcastId
                ? "no existing id"
                : `status=${broadcast.status}`,
              copyTitle: broadcast.title,
              copyDescription: !!broadcast.description,
            },
            null,
            0,
          ),
        );
        const created = await createBroadcast(
          accessToken,
          broadcast.title,
          broadcast.description,
        );
        console.info(
          "[startStream] created broadcast",
          JSON.stringify(created, null, 0),
        );
        workingBroadcastId = created.id;
        // Invalidate to refresh broadcast hook data
        await queryClient.invalidateQueries({ queryKey: ["broadcast"] });
        console.info("[startStream] invalidated broadcast after create");
      }
      if (!workingBroadcastId) throw new Error("No broadcast available");

      // If we don't already know a streamId (from options) try livestream hook
      const streamId =
        opts.streamId || broadcast.boundStreamId || livestream.id; // livestream hook returns id via data spreading
      if (!streamId)
        throw new Error("No livestream stream id available to bind");

      // If broadcast is not bound, bind first
      if (!broadcast.boundStreamId) {
        console.info(
          "[startStream] binding broadcast to stream",
          JSON.stringify(
            { broadcastId: workingBroadcastId, streamId },
            null,
            0,
          ),
        );
        await bindBroadcastToStream(accessToken, workingBroadcastId, streamId);
        // Invalidate to refresh boundStreamId
        queryClient.invalidateQueries({ queryKey: ["broadcast"] });
        console.info("[startStream] invalidated broadcast after bind");
      }

      console.info(
        "[startStream] transitioning broadcast",
        JSON.stringify(
          { broadcastId: workingBroadcastId, targetStatus: "live" },
          null,
          0,
        ),
      );
      // Transition to live
      const { status } = await transitionBroadcast(
        accessToken,
        workingBroadcastId,
        "live",
      );
      console.info(
        "[startStream] transition response",
        JSON.stringify({ broadcastId: workingBroadcastId, status }, null, 0),
      );

      // Invalidate caches for status updates
      queryClient.invalidateQueries({ queryKey: ["broadcast"] });
      queryClient.invalidateQueries({ queryKey: ["livestream"] });
      console.info(
        "[startStream] invalidated broadcast & livestream after transition",
      );
      return { broadcastId: workingBroadcastId, streamId, status };
    },
    onError: (error, variables) => {
      console.error(
        "[startStream] error",
        JSON.stringify({ message: error.message, variables }, null, 0),
      );
    },
    onSuccess: (data) => {
      console.info("[startStream] success", JSON.stringify(data, null, 0));
    },
  });

  return {
    startStream: mutation.mutate,
    startStreamAsync: mutation.mutateAsync,
    ...mutation,
  };
};
