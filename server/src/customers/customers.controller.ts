import { Body, Controller, Post } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { CustomersService } from "./customers.service";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { LoginCustomerDto } from "./dto/login-customer.dto";

@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService, private readonly jwt: JwtService) {}

  @Post("register")
  async register(@Body() dto: RegisterCustomerDto) {
    const user = await this.customers.register(dto);
    return { user, accessToken: await this.jwt.signAsync({ sub: user.id, role: "CUSTOMER", name: user.name, email: user.email }) };
  }

  @Post("login")
  async login(@Body() dto: LoginCustomerDto) {
    const user = await this.customers.authenticate(dto.email, dto.password);
    return { user, accessToken: await this.jwt.signAsync({ sub: user.id, role: "CUSTOMER", name: user.name, email: user.email }) };
  }
}