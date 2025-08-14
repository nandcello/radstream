export * as Broadcast from "./broadcast";

const baseUrl = "https://www.googleapis.com/youtube/v3";

// https://developers.google.com/youtube/v3/live/docs/liveBroadcasts#resource-representation
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

export const fromID = async ({
  id,
  accessToken,
}: {
  id: string;
  accessToken: string;
}) => {
  const args = new URLSearchParams({
    parts: "id,snippet",
    id,
  });
  const response = await fetch(`${baseUrl}/liveBroadcasts?${args}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error("broadcast-by-id failed");

  const data = await response.json();
  return data.items?.[0] as Pick<LiveBroadcast, "id" | "snippet"> | undefined;
};

export const latestTitleAndDescription = async ({
  accessToken,
}: {
  accessToken: string;
}) => {
  // ?part=id,snippet,contentDetails,status&mine=true&maxResults=50
  const args = new URLSearchParams({
    part: "id,snippet",
    mine: "true",
    maxResults: "1",
  });
  const response = await fetch(`${baseUrl}/liveBroadcasts?${args}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data: { items: LiveBroadcast[] } = await response.json();
  const parsedData = data.items.map((item) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
  }));
  console.log(">>> ", data?.items[0]);
  return parsedData[0];
};

export const updateBroadcastTitleDescription = async ({
  id,
  title,
  description,
  accessToken,
}: {
  id?: string;
  title?: string;
  description?: string;
  accessToken: string;
}) => {
  let currentBroadcast: Pick<LiveBroadcast, "id" | "snippet"> | undefined;
  if (id) {
    currentBroadcast = await fromID({
      accessToken,
      id,
    });
  }

  if (!id || !currentBroadcast) {
    currentBroadcast = await createBroadcast({
      accessToken,
      title: title ?? "my livestream",
      description,
    });

    return currentBroadcast;
  }

  const snippet: Record<string, string> = {};
  if (title !== undefined) snippet.title = title;
  if (description !== undefined) snippet.description = description;
  if (id && currentBroadcast.snippet.scheduledStartTime) {
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

  if (response.ok !== true) {
    throw new Error(await response.json());
  }

  return await response.json();
};

export const createBroadcast = async ({
  title,
  description,
  accessToken,
}: {
  title: string;
  description?: string;
  accessToken: string;
}) => {
  const scheduledStartTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const args = new URLSearchParams({
    part: "id,snippet,contentDetails",
  });
  const response = await fetch(`${baseUrl}/liveBroadcasts?${args}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      snippet: {
        title,
        description,
        scheduledStartTime,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("create-broadcast failed");
  }

  const data = await response.json();
  return data as Pick<LiveBroadcast, "snippet" | "id" | "contentDetails">;
};

export const status = async ({
  id,
  accessToken,
}: {
  id: string;
  accessToken: string;
}) => {
  const args = new URLSearchParams({
    parts: "id,status",
    id,
  });
  const response = await fetch(`${baseUrl}/liveBroadcasts?${args}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error("broadcast-status failed");

  const data = await response.json();
  const latestBroadcast = data.items?.[0] as
    | Pick<LiveBroadcast, "id" | "status">
    | undefined;

  return latestBroadcast?.status?.lifeCycleStatus;
};
