import { Module } from "@nestjs/common";
import { HireVehiclesController } from "./hire-vehicles.controller";
import { HireVehiclesService } from "./hire-vehicles.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [HireVehiclesController],
  providers: [HireVehiclesService],
})
export class HireVehiclesModule {}
