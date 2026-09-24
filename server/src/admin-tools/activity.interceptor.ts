import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, from, mergeMap, of } from "rxjs";
import { describeAction, isLoggable } from "./describe-action";
import { newChangeSet, trackChanges, type ChangeSet } from "../undo/change-tracker";
import { UndoService } from "../undo/undo.service";
import { PrismaService } from "../prisma/prisma.service";

const ADMIN_ROLES = new Set(["OWNER", "MANAGER", "VIEWER", "EMPLOYEE"]);

/** Response headers that tell the admin screen "this can be undone" (read by src/admin/adminApi.ts). */
export const UNDO_ID_HEADER = "X-Undo-Id";
export const UNDO_ACTION_HEADER = "X-Undo-Action";

/**
 * Records every successful admin write in the activity log, together with the
 * database changes it made (see server/src/undo/) so it can be undone.
 *
 * The request runs inside change tracking; once it succeeds, the log entry is
 * written before the response goes out, and its id is returned in a header so
 * the admin screen can offer "Undo" straight away. Logging problems never fail
 * the request itself.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityInterceptor.name);
  private readonly names = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly undo: UndoService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: { sub?: string; role?: string } }>();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next.handle();

    const user = request.user;
    const route = `${request.baseUrl ?? ""}${request.route?.path ?? request.path}`;
    if (!user?.sub || !user.role || !ADMIN_ROLES.has(user.role) || !isLoggable(route)) return next.handle();

    const set = newChangeSet();
    // Subscribing inside the tracking context makes the handler (and everything it awaits) part of it.
    const handled = new Observable<unknown>((subscriber) => trackChanges(set, () => next.handle().subscribe(subscriber)));

    return handled.pipe(
      mergeMap((result) =>
        from(this.record(user.sub!, user.role!, request, route, set, context.switchToHttp().getResponse<Response>())).pipe(
          mergeMap(() => of(result))
        )
      )
    );
  }

  private async record(adminId: string, role: string, request: Request, route: string, set: ChangeSet, response: Response): Promise<void> {
    try {
      let name = this.names.get(adminId);
      if (!name) {
        name = (await this.prisma.adminUser.findUnique({ where: { id: adminId }, select: { name: true } }))?.name ?? "Unknown";
        this.names.set(adminId, name);
      }
      const params = request.params as Record<string, string | undefined>;
      const entry = await this.undo.recordActivity(
        {
          adminId,
          adminName: name,
          role,
          action: describeAction({ method: request.method, route, params, body: request.body as Record<string, unknown> | undefined }),
          route: `${request.method} ${route.replace(/^\/api/, "")}`,
          targetId: params.id ?? null,
        },
        set
      );
      if (entry.undoable && !response.headersSent) {
        response.setHeader(UNDO_ID_HEADER, entry.id);
        response.setHeader(UNDO_ACTION_HEADER, encodeURIComponent(entry.action));
      }
    } catch (error) {
      set.closed = true;
      this.logger.warn(`Could not record activity: ${error instanceof Error ? error.message : error}`);
    }
  }
}
