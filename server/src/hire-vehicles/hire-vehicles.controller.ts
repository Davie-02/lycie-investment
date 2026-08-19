import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { HireVehiclesService } from "./hire-vehicles.service";
import { CreateHireVehicleDto } from "./dto/create-hire-vehicle.dto";
import { UpdateHireVehicleDto } from "./dto/update-hire-vehicle.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("hire-vehicles")
export class HireVehiclesController {
  constructor(private readonly hireVehiclesService: HireVehiclesService) {}

  @Get()
  findAll() {
    return this.hireVehiclesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Post()
  create(@Body() dto: CreateHireVehicleDto) {
    return this.hireVehiclesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateHireVehicleDto) {
    return this.hireVehiclesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.hireVehiclesService.remove(id);
  }
}
