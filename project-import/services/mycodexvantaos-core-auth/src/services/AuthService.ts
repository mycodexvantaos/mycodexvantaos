import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { TokenService } from "./TokenService";
import type { LoginResult, User } from "../types/auth.types";

const prisma = new PrismaClient();

export class AuthService {
  constructor(private tokenService: TokenService) {}

  async login(email: string, password: string): Promise<LoginResult | null> {
    if (!email || !password) {
      return null;
    }

    // 1. 尋找使用者
    const dbUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!dbUser) {
      return null;
    }

    // 2. 驗證密碼
    const isPasswordValid = await bcrypt.compare(password, dbUser.password);
    if (!isPasswordValid) {
      return null;
    }

    // 3. 簽發 Token
    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      roles: dbUser.roles
    };

    return {
      token: this.tokenService.sign({
        sub: user.id,
        email: user.email,
        roles: user.roles
      }),
      expiresIn: this.tokenService.getTtl()
    };
  }

  async register(email: string, password: string, roles: string[] = ["user"]): Promise<User | null> {
    // 檢查是否已存在
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error("User already exists");
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10);

    // 創建使用者
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        roles
      }
    });

    return {
      id: newUser.id,
      email: newUser.email,
      roles: newUser.roles
    };
  }
}
