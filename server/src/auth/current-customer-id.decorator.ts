import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/** Pairs with OptionalCustomerGuard — undefined when the request wasn't made by a logged-in customer. */
export const CurrentCustomerId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { customerId?: string }>();
    return request.customerId;
  }
);
