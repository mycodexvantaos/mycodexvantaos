import type { FastifyInstance } from "fastify";
import { DashboardController } from "../controllers/DashboardController";

export function registerDashboardRoutes(app: FastifyInstance): void {
  const controller = new DashboardController();

  app.get("/api/dashboard/summary", async (_request, reply) => {
    return reply.send(await controller.summary());
  });
}
