import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ForbiddenException, ValidationPipe } from "@nestjs/common";
import { join } from "path";
import compression from "compression";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { hasValidCsrfToken } from "./auth/csrf";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    throw new Error("FRONTEND_URL must be configured in production.");
  }

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
  });

  app.setGlobalPrefix("api");
  app.use(compression());

  app.use((request: Request, response: Response, next: NextFunction) => {
    const publicRead = request.method === "GET" && isPublicReadPath(request.path);

    response.setHeader(
      "Cache-Control",
      publicRead ? "public, max-age=60, stale-while-revalidate=300" : "no-store"
    );
    next();
  });

  app.use((request: Request, _response: Response, next: NextFunction) => {
    const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    const usesBearerToken = request.headers.authorization?.startsWith("Bearer ");
    const isCsrfEndpoint = request.path === "/api/auth/csrf";

    if (isStateChanging && !usesBearerToken && !isCsrfEndpoint && !hasValidCsrfToken(request)) {
      throw new ForbiddenException("A valid CSRF token is required.");
    }
    next();
  });

  function isPublicReadPath(path: string): boolean {
    return (
      /^\/api\/(vehicles|hire-vehicles|site-content)(\/|$)/.test(path) ||
      path === "/api/notices"
    );
  }

  // Serves uploaded vehicle images. Local disk storage is intentional for
  // now — see server/README.md for why, and what it takes to swap in
  // S3/MinIO later without touching the admin UI.
  app.useStaticAssets(join(process.cwd(), "uploads"), {
    prefix: "/uploads",
    maxAge: "1d",
  });

  // Reject unknown fields and coerce query/body values (e.g. string -> number
  // for @Type(() => Number) DTO fields) so DTOs stay the single source of
  // truth for what a request is allowed to contain.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Lycie Investment API listening on http://localhost:${port}/api`);
}

bootstrap();
