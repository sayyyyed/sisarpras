import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
type UserRole = "admin" | "operator" | "viewer";

export interface SessionUser { id: string; name: string; role: UserRole; }
interface TokenClaims extends SessionUser { exp: number; }

if (process.env.NODE_ENV === "production" && !process.env.AUTH_TOKEN_SECRET) {
  throw new Error("AUTH_TOKEN_SECRET wajib diatur untuk menjalankan API di production.");
}

const secret = process.env.AUTH_TOKEN_SECRET ?? randomBytes(32).toString("hex");

function signature(value: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

export function createToken(user: SessionUser): string {
  const claims: TokenClaims = { ...user, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function readToken(token: string): SessionUser | null {
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return null;
  const expected = signature(payload);
  const actual = Buffer.from(supplied, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenClaims;
    if (claims.exp <= Math.floor(Date.now() / 1000) || !claims.id || !claims.name) return null;
    if (!["admin", "operator", "viewer"].includes(claims.role)) return null;
    return { id: claims.id, name: claims.name, role: claims.role };
  } catch {
    return null;
  }
}
