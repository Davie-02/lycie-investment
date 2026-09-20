import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ForbiddenException, ValidationPipe } from "@nestjs/common";
import { join } from "path";
import compression from "compression";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { hasValidCsrfToken } from "./auth/csrf";
import { readCookie } from "./auth/cookies";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "./auth/session-cookie";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    throw new Error("FRONTEND_URL must be configured in production.");
  }

  // Behind a host's reverse proxy every request appears to come from the
  // proxy's IP, which would make per-IP rate limits (login, forms, Lycie chat)
  // apply to ALL visitors at once. Set TRUST_PROXY to the number of proxy hops
  // in front of the app (usually 1). Leave unset when exposed directly —
  // trusting it there would let clients spoof their IP via X-Forwarded-For.
  const trustProxy = Number(process.env.TRUST_PROXY);
  if (Number.isInteger(trustProxy) && trustProxy > 0) {
    app.set("trust proxy", trustProxy);
  }

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
  });

  // Sets a standard set of protective HTTP response headers (hides which
  // framework is running, prevents the browser from being tricked into
  // rendering responses as a different content type than intended, blocks
  // this API's pages from being embedded in a hidden iframe on another
  // site, forces HTTPS once deployed, etc).
  //
  // Two of helmet's defaults are turned off deliberately, not by oversight:
  //   - contentSecurityPolicy: this server only ever returns JSON and
  //     uploaded images, never HTML pages for a browser to render — CSP is
  //     a browser-side protection against malicious *scripts* running on
  //     a page, which doesn't apply here and could only cause confusing
  //     false positives.
  //   - crossOriginResourcePolicy: helmet's default ("same-origin") would
  //     block the frontend (a different origin) from loading vehicle
  //     photos served from this API's /uploads path via <img> tags —
  //     exactly the image-display bug fixed earlier in this project.
  //     "cross-origin" explicitly allows that, which is required for the
  //     site's own images to display at all.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.setGlobalPrefix("api");
  // Live-update stream must not be compressed/buffered, or events arrive in
  // delayed batches instead of instantly.
  app.use(
    compression({
      filter: (req, res) =>
        req.path === "/api/events" || req.path === "/api/lycie/chat/stream" ? false : compression.filter(req, res),
    })
  );

  app.use((request: Request, response: Response, next: NextFunction) => {
    // Stops reverse proxies (nginx-style, Render) from buffering the live-update stream.
    if (request.path === "/api/events") response.setHeader("X-Accel-Buffering", "no");
    next();
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    // Vehicles, testimonials, FAQ, etc. are read through the *same* endpoint
    // by anonymous visitors and by logged-in admins managing that content
    // (both the admin dashboard's fetch and the public site's fetch send
    // cookies, so there's no other signal to tell them apart at this point
    // in the request). An admin who just created/edited/deleted something
    // needs to see that reflected immediately — caching their own refetch
    // for up to 60s made their own change look like it silently failed.
    // So: public caching only applies to requests that don't identify as a
    // logged-in admin or customer; any authenticated request always gets a
    // fresh, uncached response regardless of which path it's hitting.
    const isAuthenticated =
      Boolean(readCookie(request.headers.cookie, ADMIN_SESSION_COOKIE)) ||
      Boolean(readCookie(request.headers.cookie, CUSTOMER_SESSION_COOKIE)) ||
      Boolean(request.headers.authorization?.startsWith("Bearer "));

    const publicRead = request.method === "GET" && !isAuthenticated && isPublicReadPath(request.path);

    // Public reads: cacheable but ALWAYS revalidated ("no-cache" + the ETag Express adds),
    // so a change published in the admin is visible on the very next request while unchanged
    // data still costs only a tiny 304. Everything else — including every logged-in
    // request, which may contain customer details — is never stored.
    response.setHeader("Cache-Control", publicRead ? "public, no-cache" : "no-store");
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
    // blog-posts/all is admin-only (lists drafts too) — must never be cached
    // as a public response, same reasoning as notices/all below.
    if (path === "/api/blog-posts/all") return false;

    return (
      /^\/api\/(vehicles|hire-vehicles|site-content|testimonials|faq|blog-posts)(\/|$)/.test(path) ||
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
  console.log(`Lycie Investments API listening on http://localhost:${port}/api`);
}

bootstrap();
