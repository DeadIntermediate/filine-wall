import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  user: {
    id: number;
    username: string;
    role: string;
  } | null;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => {
        set({ token: null, user: null });
        window.location.href = "/auth/login";
      },
    }),
    {
      name: "auth-storage",
    }
  )
);

export function useAuth() {
  const { token, user, setAuth, logout } = useAuthStore();

  const { isLoading } = useQuery({
    queryKey: ["/api/auth/validate"],
    queryFn: async () => {
      if (!token) return null;

      try {
        const response = await fetch("/api/auth/validate", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Invalid token");
        }

        return response.json();
      } catch (error) {
        logout();
        return null;
      }
    },
    enabled: !!token,
  });

  return {
    user,
    token,
    setAuth,
    logout,
    isLoading: isLoading && !!token,
  };
}
