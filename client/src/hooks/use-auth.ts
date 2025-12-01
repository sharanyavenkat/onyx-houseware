import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  username: string;
  role: string;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const isAdmin = user?.role === "admin";
  const isViewer = user?.role === "viewer";
  const canMutate = isAdmin;

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin,
    isViewer,
    canMutate,
  };
}
