import type { FetchResult, FetchOptions, FetchError as FetchErrorType } from "./types.ts";
import { FetchError } from "./types.ts";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; axagent/0.1.0; +https://github.com/yourusername/axagent)";
const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchPage(
  url: string,
  options?: FetchOptions
): Promise<FetchResult> {
  const startTime = performance.now();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
  const followRedirects = options?.followRedirects !== false;

  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    ...options?.headers,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      headers,
      redirect: followRedirects ? "follow" : "manual",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const html = await response.text();
    const fetchDurationMs = performance.now() - startTime;

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    return {
      url: response.url,
      statusCode: response.status,
      headers: responseHeaders,
      html,
      fetchDurationMs,
    };
  } catch (error) {
    const fetchDurationMs = performance.now() - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      throw new FetchError(`Fetch timeout after ${timeoutMs}ms`, url, error);
    }

    if (error instanceof TypeError) {
      throw new FetchError(`Failed to fetch: ${error.message}`, url, error);
    }

    throw new FetchError(`Unexpected error: ${String(error)}`, url, error instanceof Error ? error : undefined);
  }
}
