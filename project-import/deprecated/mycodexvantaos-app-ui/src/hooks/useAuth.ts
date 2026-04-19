import { useCallback, useState } from "react";

interface AuthState {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  );

  const login = useCallback((value: string) => {
    localStorage.setItem("auth_token", value);
    setToken(value);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setToken(null);
  }, []);

  return { token, login, logout };
}
