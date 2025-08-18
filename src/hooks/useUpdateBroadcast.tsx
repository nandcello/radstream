import { useMutation } from "@tanstack/react-query";
import { useAccessToken } from "./auth";
import { useBroadcast } from "./useBroadcast";

const baseUrl = "https://www.googleapis.com/youtube/v3";

export const useUpdateBroadcast = () => {
  const { accessToken } = useAccessToken();
  const { id, scheduledStartTime } = useBroadcast();

  const { mutate, isPending } = useMutation({
    mutationFn: async ({
      title,
      description,
    }: {
      title?: string;
      description?: string;
    }) => {
      if (!accessToken) throw new Error("No access token available");
      const snippet: Record<string, string> = {};
      if (title !== undefined) snippet.title = title;
      if (description !== undefined) snippet.description = description;
      if (scheduledStartTime) {
        snippet.scheduledStartTime = new Date(
          Date.now() + 5 * 60 * 1000,
        ).toISOString();
      }

      const args = new URLSearchParams({
        part: "id,snippet,contentDetails",
      });
      const response = await fetch(`${baseUrl}/liveBroadcasts?${args}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id,
          snippet,
          contentDetails: {
            monitorStream: {
              enableMonitorStream: true,
              broadcastStreamDelayMs: 0,
            },
          },
        }),
      });

      const parsedResponse = await response.json();
      if (!response.ok) {
        console.error("Failed to update broadcast", parsedResponse);
        throw new Error(parsedResponse);
      }
    },
  });

  return { updateBroadcast: mutate, isLoading: isPending };
};
