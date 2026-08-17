import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });

    // Same error for "no such user" and "wrong password" — don't reveal
    // which one it was, so a bad actor can't use this to enumerate accounts.
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
