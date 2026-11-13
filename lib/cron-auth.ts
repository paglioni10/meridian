import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

const digest = (value: string) => createHash("sha256").update(value).digest();

export function isCronRequest(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!secret || !token) return false;
  return timingSafeEqual(digest(token), digest(secret));
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
}
