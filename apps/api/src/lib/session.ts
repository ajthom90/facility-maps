import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { env } from "./env.js";

export const SESSION_COOKIE_NAME = "facility_maps_session";

/** Session lifetime (7 days). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type Session = {
  userId: string;
  username: string;
};

type SessionPayload = Session & { exp: number };

function sign(data: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(data).digest("base64url");
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("userId" in parsed) ||
      !("username" in parsed) ||
      !("exp" in parsed)
    ) {
      return null;
    }
    const { userId, username, exp } = parsed as Record<string, unknown>;
    if (typeof userId !== "string" || typeof username !== "string" || typeof exp !== "number") {
      return null;
    }
    return { userId, username, exp };
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Build signed cookie value: base64url(json).hmac */
export function createSessionCookieValue(user: Session): string {
  const payload: SessionPayload = {
    userId: user.userId,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const data = encodePayload(payload);
  return `${data}.${sign(data)}`;
}

export function parseSessionCookieValue(value: string): Session | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!data || !sig) return null;

  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  const payload = decodePayload(data);
  if (!payload) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return { userId: payload.userId, username: payload.username };
}

export function setSessionCookie(c: Context, user: Session): void {
  setCookie(c, SESSION_COOKIE_NAME, createSessionCookieValue(user), {
    ...cookieOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, cookieOptions());
}

export function readSession(c: Context): Session | null {
  const value = getCookie(c, SESSION_COOKIE_NAME);
  if (!value) return null;
  return parseSessionCookieValue(value);
}
