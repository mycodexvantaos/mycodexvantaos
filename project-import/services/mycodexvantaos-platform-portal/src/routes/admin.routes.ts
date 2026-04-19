import type { FastifyInstance } from "fastify";
import { AdminController } from "../controllers/AdminController";
import { authGuard } from "../middleware/authGuard";

export function registerAdminRoutes(app: FastifyInstance): void {
  const controller = new AdminController();

  app.get("/api/admin/status", { preHandler: [authGuard] }, async (_request, reply) => {
    return reply.send(await controller.getStatus());
  });
}
