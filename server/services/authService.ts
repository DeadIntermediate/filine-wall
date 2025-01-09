import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@db";
import { users, sessions } from "@db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TOKEN_EXPIRY = '24h';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async createUser(username: string, password: string, role: 'admin' | 'user' = 'user') {
    const hashedPassword = await this.hashPassword(password);
    const [user] = await db.insert(users)
      .values({
        username,
        password: hashedPassword,
        role,
      })
      .returning();
    return user;
  }

  static async login(username: string, password: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        role: user.role,
        username: user.username
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Create session
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    });

    return { token, user: { ...user, password: undefined } };
  }

  static async validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        role: string;
        username: string;
      };

      const session = await db.query.sessions.findFirst({
        where: eq(sessions.token, token),
      });

      if (!session || new Date() > new Date(session.expiresAt)) {
        throw new Error('Session expired');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static async checkPermission(userId: number, resource: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return false;
    }

    // Admin has access to everything
    if (user.role === 'admin') {
      return true;
    }

    // Check specific permissions for users
    const permission = await db.query.accessControl.findFirst({
      where: eq(accessControl.resource, resource),
    });

    if (!permission) {
      return false;
    }

    return permission.permissions[user.role] === true;
  }
}
