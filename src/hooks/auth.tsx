import { useMutation, useQuery } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";
import { queryClient } from "@/frontend";

export const authClient = createAuthClient();
export const useAuth = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => authClient.getSession(),
  });
  const { mutate: signIn } = useMutation({
    mutationFn: async () => {
      await authClient.signIn.social({ provider: "google" });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const { mutate: signOut } = useMutation({
    mutationFn: async () => {
      await authClient.signOut();
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  return {
    session: data,
    isLoading,
    signIn,
    signOut,
  };
};

export const useCurrentUser = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const response = await authClient.getSession();

      return response.data?.user;
    },
  });

  return {
    user: data,
    isLoading,
  };
};
