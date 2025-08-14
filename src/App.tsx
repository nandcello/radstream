import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader } from "lucide-react";
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
      <Card className="px-4 py-2 max-w-xl">
        <YTAuthButton />
        <TitleDescription />
      </Card>
    </main>
  );
}

export default App;

const TitleDescription = () => {
  const { user, isLoading: isUserLoading } = useCurrentUser();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["yt-latest-broadcast"],
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
  });

  if (isLoading || !data) return null;

  return (
    <span className="flex items-center gap-1">
      <p className="animate-pulse">{data.status === "live" ? "🔴" : null}</p>
      <p
        className={`text-sm ${data.status === "live" ? "text-red-600 font-bold text-md" : "text-gray-500"} uppercase`}
      >
        {data?.status}
      </p>
    </span>
  );
};
