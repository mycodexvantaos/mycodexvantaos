import type { FastifyReply, FastifyRequest } from "fastify";
import { TokenService } from "../services/TokenService";

export function authMiddleware(tokenService: TokenService) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      reply.status(401).send({ error: "Missing authorization header" });
      return;
    }

    const payload = tokenService.verify(auth.slice(7));
    if (!payload) {
      reply.status(401).send({ error: "Invalid token" });
      return;
    }

    (request as unknown as Record<string, unknown>).user = payload;
  };
}
