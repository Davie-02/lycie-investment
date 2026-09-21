import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { HireVehiclesService } from "./hire-vehicles.service";

const base = { slug: "corolla", name: "Corolla", dailyRate: 100, transmission: "Automatic", fuelType: "Petrol", seats: 5 };

function makeService() {
  const create = jest.fn(async ({ data }) => data);
  const update = jest.fn(async ({ data }) => data);
  const prisma = {
    hireVehicle: { findUnique: jest.fn(async () => ({ id: "1" })), create, update },
  } as unknown as PrismaService;
  return { service: new HireVehiclesService(prisma), create, update, prisma };
}

describe("HireVehiclesService gallery handling", () => {
  it("uses the first gallery image as the cover", async () => {
    const { service, create } = makeService();
    (service as unknown as { prisma: { hireVehicle: { findUnique: jest.Mock } } }).prisma.hireVehicle.findUnique.mockResolvedValueOnce(null);
    await service.create({ ...base, images: ["a.webp", "b.webp"] });
    expect(create.mock.calls[0][0].data).toMatchObject({ image: "a.webp", images: ["a.webp", "b.webp"] });
  });

  it("turns a single legacy `image` into a one-item gallery", async () => {
    const { service, create } = makeService();
    (service as unknown as { prisma: { hireVehicle: { findUnique: jest.Mock } } }).prisma.hireVehicle.findUnique.mockResolvedValueOnce(null);
    await service.create({ ...base, image: "only.webp" });
    expect(create.mock.calls[0][0].data).toMatchObject({ image: "only.webp", images: ["only.webp"] });
  });

  it("refuses to create a vehicle with no photo at all", async () => {
    const { service } = makeService();
    (service as unknown as { prisma: { hireVehicle: { findUnique: jest.Mock } } }).prisma.hireVehicle.findUnique.mockResolvedValueOnce(null);
    await expect(service.create({ ...base })).rejects.toThrow(BadRequestException);
  });

  it("keeps cover and gallery in step on update", async () => {
    const { service, update } = makeService();
    await service.update("1", { images: ["x.webp", "y.webp"] });
    expect(update.mock.calls[0][0].data).toMatchObject({ image: "x.webp", images: ["x.webp", "y.webp"] });
  });
});
