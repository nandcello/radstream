import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Loader } from "lucide-react";
import { useState } from "react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { useAuth, useCurrentUser } from "./hooks/auth";
import "./index.css";

export function App() {
  return (
    <main className="px-2">
      <h1>radstream</h1>
      <Card className="px-4 py-2 max-w-xl mb-4">
        <YTAuthButton />
        <TitleDescription />
      </Card>
      <Card className="px-4 py-2 max-w-xl">
        <StreamKey />
      </Card>
    </main>
  );
}

export default App;

const TitleDescription = () => {
  const { user, isLoading: isUserLoading } = useCurrentUser();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["broadcast", "title-description"],
    queryFn: async () => {
      const r = await fetch("/api/broadcast/fields");
      const data = (await r.json()) as {
        id: string;
        title?: string;
        description?: string;
      };
      if (!r.ok) throw new Error("broadcast-fields failed");
      return data;
    },
    enabled: !!user,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async ({
      title,
      description,
    }: {
      title: string;
      description: string;
    }) => {
      await fetch("/api/broadcast/fields", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: data?.id,
          title,
          description,
        }),
      });
      refetch();
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    const formData = new FormData(e.currentTarget);
    mutate({
      title: formData.get("title") as string,
      description: formData.get("description") as string,
    });
  };

  if (isLoading || isUserLoading) return <p>Loading broadcast info...</p>;

  if (!user) return null;

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="title">Title</label>
      <Input
        name="title"
        className="mb-3"
        id="title"
        type="text"
        defaultValue={data?.title ?? ""}
      />
      <label htmlFor="description">Description</label>
      <Textarea
        name="description"
        className="mb-3"
        id="description"
        defaultValue={data?.description ?? ""}
      />
      <Button className="flex justify-self-end" type="submit">
        Save{" "}
        {isPending && (
          <span className="animate-spin">
            <Loader />
          </span>
        )}
      </Button>
    </form>
  );
};

const YTAuthButton = () => {
  const { signIn, signOut, isLoading: isAuthLoading, session } = useAuth();

  const handleClick = () => {
    signIn();
  };

  const handleSignOut = () => {
    signOut();
  };

  if (isAuthLoading) return <p>Loading session...</p>;

  if (session?.data)
    return (
      <div className="flex items-center justify-between">
        <span className="flex gap-2 items-center">
          <p>{session.data.user.name}</p>
          <BroadcastStatus />
        </span>
        <Button variant="ghost" type="button" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    );

  return (
    <Button type="button" onClick={handleClick}>
      Sign in with Google
    </Button>
  );
};

const BroadcastStatus = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["broadcast", "status"],
    queryFn: () => fetch("/api/broadcast/status").then((res) => res.json()),
    refetchInterval: 1000,
  });

  if (isLoading || !data) return null;

  return (
    <span className="flex items-center gap-1">
      <p className="motion-safe:animate-pulse">
        {data.status === "live" ? "🔴" : null}
      </p>
      <p
        className={`text-sm ${data.status === "live" ? "text-red-600 font-bold text-md" : "text-gray-500"} uppercase`}
      >
        {data?.status}
      </p>
    </span>
  );
};

const StreamKey = () => {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data } = useQuery({
    queryKey: ["livestream", "stream-key"],
    queryFn: () =>
      fetch("/api/livestream/stream-key").then((res) => res.json()) as Promise<{
        streamKey: string;
      }>,
  });

  if (!data) return null;

  return (
    <div>
      <span className="flex justify-between items-center">
        <h2>Stream Key</h2>
        <LiveStreamStatus />
      </span>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          disabled
          defaultValue={data.streamKey}
          className="pr-24"
        />
        <div className="absolute top-1/2 -translate-y-1/2 right-1 flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShow((s) => !s)}
            className="h-7 w-7"
          >
            {show ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span className="sr-only">{show ? "Hide" : "Show"} stream key</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(data.streamKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              } catch (e) {
                console.error("Failed to copy stream key", e);
              }
            }}
            className="h-7 w-7"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="sr-only">Copy stream key</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

const LiveStreamStatus = () => {
  const { data } = useQuery({
    queryKey: ["livestream", "status"],
    queryFn: () => fetch("/api/livestream/status").then((res) => res.json()),
    refetchInterval: 1000,
  });

  return (
    <span className="flex items-center gap-1">
      <p
        className={`text-xs ${data?.status !== "streaming" ? "motion-safe:animate-out fade-out-50 repeat-infinite duration-1000 direction-alternate delay-1000 text-gray-500 " : "text-green-600 font-semibold text-md"} uppercase`}
      >
        {data?.status ?? "waiting for connection.."}
      </p>
    </span>
  );
};
