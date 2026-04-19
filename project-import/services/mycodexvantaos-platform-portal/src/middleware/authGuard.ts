import type { FastifyReply, FastifyRequest } from "fastify";
import { TokenService } from "@mycodexvantaos/auth-service";

const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
const rawTtl = process.env.JWT_EXPIRES_IN;
const ttlSeconds = rawTtl !== undefined ? Number(rawTtl) : 3600;

const tokenService = new TokenService(jwtSecret, Number.isFinite(ttlSeconds) ? ttlSeconds : 3600);

export async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Unauthorized" });
    return;
  }

  const token = auth.slice(7).trim();
  if (!token) {
    reply.status(401).send({ error: "Unauthorized" });
    return;
  }

  const payload = tokenService.verify(token);
  if (!payload) {
    reply.status(401).send({ error: "Invalid token" });
    return;
  }
}
