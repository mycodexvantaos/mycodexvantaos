import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

vi.mock("../src/services/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ token: "mock-token" })
}));

describe("App", () => {
  it("should render login screen when unauthenticated", () => {
    localStorage.removeItem("auth_token");
    render(<App />);
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("should submit login form", async () => {
    localStorage.removeItem("auth_token");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(screen.getByText("Login")).toBeInTheDocument();
  });
});
