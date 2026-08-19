import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  });

  app.setGlobalPrefix("api");

  // Serves uploaded vehicle images. Local disk storage is intentional for
  // now — see server/README.md for why, and what it takes to swap in
  // S3/MinIO later without touching the admin UI.
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });

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
