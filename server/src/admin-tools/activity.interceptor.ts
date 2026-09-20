import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { describeAction, isLoggable } from "./describe-action";

const ADMIN_ROLES = new Set(["OWNER", "MANAGER", "VIEWER"]);

/** Records every successful admin write in the activity log. Never blocks or fails the request. */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityInterceptor.name);
  private readonly names = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { sub?: string; role?: string } }>();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const user = request.user;
        const route = `${request.baseUrl ?? ""}${request.route?.path ?? request.path}`;
        if (!user?.sub || !user.role || !ADMIN_ROLES.has(user.role) || !isLoggable(route)) return;
        void this.record(user.sub, user.role, request, route).catch((error) =>
          this.logger.warn(`Could not record activity: ${error instanceof Error ? error.message : error}`)
        );
      })
    );
  }

  private async record(adminId: string, role: string, request: Request, route: string): Promise<void> {
    let name = this.names.get(adminId);
    if (!name) {
      name = (await this.prisma.adminUser.findUnique({ where: { id: adminId }, select: { name: true } }))?.name ?? "Unknown";
      this.names.set(adminId, name);
    }
    const params = request.params as Record<string, string | undefined>;
    await this.prisma.adminActivity.create({
      data: {
        adminId,
        adminName: name,
        role,
        action: describeAction({ method: request.method, route, params, body: request.body as Record<string, unknown> | undefined }),
        route: `${request.method} ${route.replace(/^\/api/, "")}`,
        targetId: params.id ?? null,
      },
    });
  }
}
