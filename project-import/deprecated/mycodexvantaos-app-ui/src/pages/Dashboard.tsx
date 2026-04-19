import React from "react";
import { useAuth } from "../hooks/useAuth";

export function Dashboard(): React.ReactElement {
  const { logout } = useAuth();

  return (
    <section>
      <h2>Dashboard</h2>
      <p>Welcome to CodexvantaOS.</p>
      <button onClick={logout}>Logout</button>
    </section>
  );
}
