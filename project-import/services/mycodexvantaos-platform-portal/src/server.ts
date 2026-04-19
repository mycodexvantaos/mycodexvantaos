import Fastify from "fastify";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerDashboardRoutes } from "./routes/dashboard.routes";

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: "app-portal" }));

  registerAuthRoutes(app);
  registerDashboardRoutes(app);
  registerAdminRoutes(app);

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3002;
  buildServer().then((app) => {
    app.listen({ port, host: "0.0.0.0" }).then((addr) => {
      console.log(`app-portal listening on ${addr}`);
    });
  });
}
