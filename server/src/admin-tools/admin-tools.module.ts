import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";
import { UploadsModule } from "../uploads/uploads.module";
import { GeminiClient } from "../lycie/gemini.client";
import { AdminToolsController } from "./admin-tools.controller";
import { AdminToolsService } from "./admin-tools.service";
import { AdminToolsCron } from "./admin-tools.cron";
import { ActivityInterceptor } from "./activity.interceptor";
import { UndoService } from "../undo/undo.service";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceService } from "./workspace.service";

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [AdminToolsController, WorkspaceController],
  providers: [AdminToolsService, UndoService, WorkspaceService, AdminToolsCron, GeminiClient, { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor }],
})
export class AdminToolsModule {}
