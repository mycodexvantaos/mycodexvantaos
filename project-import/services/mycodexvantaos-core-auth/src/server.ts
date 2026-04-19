import Fastify from "fastify";
import { errorHandler } from "./middleware/errorHandler";
import { TokenService } from "./services/TokenService";
import { AuthService } from "./services/AuthService";

export function buildServer() {
  const app = Fastify({ 
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined
    }
  });

  app.setErrorHandler(errorHandler);

  const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
  if (jwtSecret === "dev-secret") {
    app.log.warn("JWT_SECRET is using the default dev-secret — set a strong secret in production");
  }

  const rawTtl = process.env.JWT_EXPIRES_IN;
  const ttlSeconds = rawTtl !== undefined ? Number(rawTtl) : 3600;
  const tokenService = new TokenService(jwtSecret, Number.isFinite(ttlSeconds) ? ttlSeconds : 3600);
  const authService = new AuthService(tokenService);

  app.get("/health", async () => ({ status: "ok", service: "auth-service" }));

  // 註冊端點
  app.post<{ Body: { email: string; password: string; roles?: string[] } }>("/api/auth/register", async (request, reply) => {
    try {
      const { email, password, roles } = request.body;
      const user = await authService.register(email, password, roles);
      return reply.status(201).send(user);
    } catch (err: any) {
      app.log.error(err);
      return reply.status(400).send({ error: err.message });
    }
  });

  app.post<{ Body: { email: string; password: string } }>("/api/auth/login", async (request, reply) => {
    const result = await authService.login(request.body.email, request.body.password);
    if (!result) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }
    return reply.send(result);
  });

  app.get("/api/auth/verify", async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing token" });
    }
    const payload = tokenService.verify(auth.slice(7));
    if (!payload) {
      return reply.status(401).send({ error: "Invalid token" });
    }
    return reply.send({ valid: true, payload });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001;
  const app = buildServer();
  app.listen({ port, host: "0.0.0.0" }).then((addr) => {
    console.log(`auth-service listening on ${addr}`);
  });
}
