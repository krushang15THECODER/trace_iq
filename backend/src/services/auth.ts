import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getCollections } from '../db/mongo.js';
import { UserRecord } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'traceiq_secure_auth_secret_key_2025';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const derived = crypto.scryptSync(password, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
  } catch {
    return false;
  }
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf-8');
}

export function generateToken(user: UserRecord): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user._id,
      email: user.email,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 // 7 days
    })
  );

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): { userId: string; email: string; name: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSig) return null;

    const decoded = JSON.parse(base64UrlDecode(payload));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return {
      userId: decoded.sub,
      email: decoded.email,
      name: decoded.name
    };
  } catch {
    return null;
  }
}

export class AuthService {
  static async seedDefaultUsers(): Promise<void> {
    try {
      const { users } = getCollections();
      const count = await users.countDocuments();
      if (count === 0) {
        const defaultUser: UserRecord = {
          _id: 'usr_admin',
          email: 'engineer@traceiq.io',
          name: 'Incident Commander',
          passwordHash: hashPassword('traceiq123'),
          createdAt: new Date().toISOString()
        };
        await users.insertOne(defaultUser);
        console.log('👤 Seeded default TraceIQ user: engineer@traceiq.io / traceiq123');
      }
    } catch {
      // ignore
    }
  }

  static async register(email: string, password: string, name?: string): Promise<{ user: Omit<UserRecord, 'passwordHash'>; token: string }> {
    const { users } = getCollections();
    const cleanEmail = email.trim().toLowerCase();

    const existing = await users.findOne({ email: cleanEmail });
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const userId = `usr_${uuidv4().slice(0, 8)}`;
    const userDoc: UserRecord = {
      _id: userId,
      email: cleanEmail,
      name: name?.trim() || cleanEmail.split('@')[0],
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    await users.insertOne(userDoc);
    const token = generateToken(userDoc);

    const { passwordHash: _, ...userSafe } = userDoc;
    return { user: userSafe, token };
  }

  static async login(email: string, password: string): Promise<{ user: Omit<UserRecord, 'passwordHash'>; token: string }> {
    const { users } = getCollections();
    const cleanEmail = email.trim().toLowerCase();

    // Ensure default user exists if db is fresh
    await this.seedDefaultUsers();

    const user = await users.findOne({ email: cleanEmail });
    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password.');
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password.');
    }

    const token = generateToken(user);
    const { passwordHash: _, ...userSafe } = user;
    return { user: userSafe, token };
  }

  static async getUserById(userId: string): Promise<Omit<UserRecord, 'passwordHash'> | null> {
    const { users } = getCollections();
    const user = await users.findOne({ _id: userId });
    if (!user) return null;
    const { passwordHash: _, ...userSafe } = user;
    return userSafe;
  }
}
