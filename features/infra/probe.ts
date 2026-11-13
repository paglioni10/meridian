import "server-only";
import { connect } from "node:tls";
import { parseRdapExpiration, rdapUrl, type ProbeResult } from "./rules";

const TIMEOUT_MS = 8000;
const MAX_BODY = 1_000_000;
const USER_AGENT = "Meridian-Monitor/1.0";

async function readText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  while (text.length < MAX_BODY) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return text;
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      return `Sem resposta em ${TIMEOUT_MS / 1000} s`;
    const cause = (error as Error & { cause?: { code?: string } }).cause?.code;
    return (cause ? `${cause}: ` : "") + error.message.slice(0, 200);
  }
  return "Falha desconhecida";
}

export async function probeHttp(url: string, keyword: string | null): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const latencyMs = Math.round(performance.now() - started);
    let keywordFound: boolean | null = null;
    if (keyword) keywordFound = (await readText(response)).toLowerCase().includes(keyword.toLowerCase());
    else await response.body?.cancel().catch(() => undefined);
    return { ok: true, statusCode: response.status, latencyMs, keywordFound, error: null };
  } catch (error) {
    return { ok: false, statusCode: null, latencyMs: null, keywordFound: null, error: describe(error) };
  }
}

export function probeTlsExpiry(url: string): Promise<string | null> {
  let host: string;
  let port: number;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return Promise.resolve(null);
    host = parsed.hostname;
    port = parsed.port ? Number(parsed.port) : 443;
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const socket = connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: TIMEOUT_MS },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        const date = cert?.valid_to ? new Date(cert.valid_to) : null;
        resolve(date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null);
      },
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
    socket.on("error", () => resolve(null));
  });
}

export async function fetchDomainExpiry(domain: string): Promise<string | null> {
  const url = rdapUrl(domain);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/rdap+json, application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return parseRdapExpiration(await response.json());
  } catch {
    return null;
  }
}
