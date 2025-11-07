import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@db";
import { users, sessions } from "@db/schema";
import { eq } from "drizzle-orm";

// Environment validation for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a secure value in production environment');
  }
  console.warn('Warning: Using default JWT_SECRET. This is insecure! Set JWT_SECRET environment variable.');
}

const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '24h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async createUser(username: string, password: string, role: 'admin' | 'user' = 'user') {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      throw new Error('Username already exists');
    }

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
      throw new Error('Invalid credentials');
    }

    if (!user.active) {
      throw new Error('Account is disabled');
    }

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        role: user.role,
        username: user.username
      },
      JWT_SECRET || 'your-secret-key',
      { expiresIn: TOKEN_EXPIRY }
    );

    // Create session
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    });

    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    return { token, user: { ...user, password: undefined } };
  }

  static async validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET || 'your-secret-key') as {
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

      // Update last activity
      await db.update(sessions)
        .set({ lastActivity: new Date() })
        .where(eq(sessions.token, token));

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  static async logout(token: string) {
    // Delete session
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  static async checkPermission(userId: number, resource: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || !user.active) {
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
