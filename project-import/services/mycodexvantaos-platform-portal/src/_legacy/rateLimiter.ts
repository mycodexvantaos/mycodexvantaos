import type { FastifyRequest, FastifyReply } from "fastify";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export async function rateLimiter(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ip = request.ip;
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60000 });
    return;
  }
  entry.count += 1;
  if (entry.count > 100) {
    reply.status(429).send({ error: "Too many requests" });
  }
}
