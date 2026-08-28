import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.hireVehiclesService.findAll(this.parseNumber(page, 1), this.parsePageSize(pageSize, 24));
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

  private parseNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
  }

  private parsePageSize(value: string | undefined, fallback: number): number {
    return Math.min(100, this.parseNumber(value, fallback));
  }
}
