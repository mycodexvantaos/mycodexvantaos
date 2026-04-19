import type { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/AuthController";

export function registerAuthRoutes(app: FastifyInstance): void {
  const controller = new AuthController();

  app.post("/api/auth/login", async (request, reply) => {
    const body = request.body as { email: string; password: string };
    const result = await controller.login(body.email, body.password);
    if (!result) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }
    return reply.send(result);
  });

  app.post("/api/auth/register", async (request, reply) => {
    try {
      const body = request.body as { email: string; password: string; roles?: string[] };
      const result = await controller.register(body.email, body.password, body.roles);
      return reply.status(201).send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  app.get("/api/auth/verify", async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing token" });
    }
    const payload = await controller.verifyToken(auth.slice(7));
    if (!payload) {
      return reply.status(401).send({ error: "Invalid token" });
    }
    return reply.send({ valid: true, payload });
  });
}
