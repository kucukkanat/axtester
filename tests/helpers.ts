import { parsePage } from "../src/parser.ts";
import type { ParsedPage, FetchResult } from "../src/types.ts";

export function makeParsedPage(
  html: string,
  headers: Record<string, string> = {}
): ParsedPage {
  const fetchResult: FetchResult = {
    url: "https://test.example.com",
    statusCode: 200,
    headers,
    html,
    fetchDurationMs: 0,
  };

  return parsePage(fetchResult);
}

export function makeFixturePath(filename: string): string {
  return new URL(`./fixtures/${filename}`, import.meta.url).pathname;
}
