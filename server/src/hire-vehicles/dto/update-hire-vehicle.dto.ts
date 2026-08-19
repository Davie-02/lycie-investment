import { PartialType } from "@nestjs/mapped-types";
import { CreateHireVehicleDto } from "./create-hire-vehicle.dto";

export class UpdateHireVehicleDto extends PartialType(CreateHireVehicleDto) {}
