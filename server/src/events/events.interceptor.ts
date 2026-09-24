import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";
import { EventsService } from "./events.service";
import { topicsForWrite } from "./topics";

/** After any successful write, tells connected browsers which content changed. */
@Injectable()
export class ContentChangeInterceptor implements NestInterceptor {
  constructor(private readonly events: EventsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const isWrite = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (!isWrite) return next.handle();
    return next.handle().pipe(
      tap(() => {
        this.events.noteWrite();
        this.events.emit(topicsForWrite(request.path));
      })
    );
  }
}
