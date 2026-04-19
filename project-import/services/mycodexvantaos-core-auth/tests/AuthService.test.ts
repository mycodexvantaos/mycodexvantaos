// jest.mock() calls are hoisted by Jest above all imports.
// This ensures PrismaClient mock is in place before AuthService.ts initialises
// `const prisma = new PrismaClient()` at module level.
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      // Default: return a valid user so login tests can succeed
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        password: 'mock-hashed-password',
        roles: ['user'],
      }),
      create: jest.fn().mockResolvedValue({
        id: 'user-2',
        email: 'new@test.com',
        password: 'mock-hashed-password',
        roles: ['user'],
      }),
    },
  })),
}));

// Mock bcrypt so tests never touch real crypto or need matching hashes
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('mock-hashed-password'),
}));

import { AuthService } from "../src/services/AuthService";
import { TokenService } from "../src/services/TokenService";

describe("AuthService", () => {
  const tokenService = new TokenService("test-secret", 3600);
  const authService = new AuthService(tokenService);

  it("should return null for empty credentials (no DB call)", async () => {
    // AuthService checks `!email || !password` before calling Prisma
    const result = await authService.login("", "");
    expect(result).toBeNull();
  });

  it("should return null when only email provided", async () => {
    const result = await authService.login("user@test.com", "");
    expect(result).toBeNull();
  });

  it("should return token for valid credentials", async () => {
    // Prisma mock returns a user; bcrypt.compare mock returns true
    const result = await authService.login("user@test.com", "password");
    expect(result).not.toBeNull();
    expect(result?.token).toBeDefined();
    expect(result?.expiresIn).toBe(3600);
  });
});
