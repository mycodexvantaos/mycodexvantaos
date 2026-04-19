import jwt from "jsonwebtoken";
import type { TokenPayload } from "../types/auth.types";

export class TokenService {
  constructor(
    private secret: string,
    private ttlSeconds: number
  ) {}

  sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.ttlSeconds });
  }

  verify(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, this.secret) as TokenPayload;
    } catch {
      return null;
    }
  }

  getTtl(): number {
    return this.ttlSeconds;
  }
}
