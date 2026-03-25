/**
 * Stealth Mode: Anti-Bot Detection Techniques
 *
 * Based on extensive research into modern bot protection:
 * - puppeteer-extra-plugin-stealth for fingerprint masking
 * - Chrome launch flags for headless browser detection
 * - Human-like behavior patterns (delays, typing speed, mouse movements)
 * - Realistic header injection and User-Agent rotation
 * - WebDriver property masking and navigator spoofing
 */

import { type Browser, type Page } from "puppeteer";

export interface StealthConfig {
  enabled: boolean;
  randomizeDelay?: boolean;
  minDelay?: number;
  maxDelay?: number;
  randomizeMouse?: boolean;
  spoofGeolocation?: boolean;
  rotateUserAgent?: boolean;
  disableHeadlessIndicators?: boolean;
}

export const DEFAULT_STEALTH_CONFIG: StealthConfig = {
  enabled: false,
  randomizeDelay: true,
  minDelay: 800,
  maxDelay: 3000,
  randomizeMouse: true,
  spoofGeolocation: true,
  rotateUserAgent: true,
  disableHeadlessIndicators: true,
};

/**
 * Realistic user-agent strings for rotation
 * Updated list of common browser user-agents to avoid detection
 */
const REALISTIC_USER_AGENTS = [
  // Chrome on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Chrome on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Chrome on Linux
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Edge
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
  // Firefox on Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  // Safari on macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
];

/**
 * Get Chrome launch arguments for stealth mode
 * Disables detection indicators and mimics real browser behavior
 */
export function getStealthLaunchArgs(userAgent?: string): string[] {
  return [
    // Disable automation indicators
    "--disable-blink-features=AutomationControlled",
    "--disable-web-resources",

    // Disable various detection mechanisms
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-site-isolation-trials",
    "--allow-running-insecure-content",

    // Disable sync and other telemetry
    "--disable-sync",
    "--no-service-autorun",
    "--no-default-browser-check",

    // Performance and detection evasion
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-device-orientation-permission-prompt",
    "--disable-backgrounding-occluded-windows",

    // Disable various plugins and extensions
    "--disable-extensions",
    "--disable-plugins",
    "--disable-component-extensions-with-background-pages",

    // Window size (typical desktop)
    "--window-size=1920,1080",

    // Language settings (US English)
    "--lang=en-US",
  ];
}

/**
 * Get a random User-Agent string
 */
export function getRandomUserAgent(): string {
  return REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)];
}

/**
 * Generate random delay in milliseconds (human-like behavior)
 */
export function getRandomDelay(
  minMs: number = DEFAULT_STEALTH_CONFIG.minDelay!,
  maxMs: number = DEFAULT_STEALTH_CONFIG.maxDelay!
): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
}

/**
 * Apply stealth measures to a page
 * Injects JavaScript to mask automation indicators
 */
export async function applyPageStealth(
  page: Page,
  config: StealthConfig
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  // Mask navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    // Delete webdriver property
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });

    // Hide chrome property
    Object.defineProperty(navigator, "chrome", {
      get: () => ({
        runtime: {},
      }),
    });

    // Override permissions.query
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // Hide plugins array
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Hide languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });

    // Mask headless indicator in user-agent
    Object.defineProperty(navigator, "userAgent", {
      get: function () {
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
      },
    });

    // Override toString to hide Headless
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function () {
      if (this === window.navigator.permissions.query) {
        return `function query() { [native code] }`;
      }
      return originalToString.call(this);
    };

    // Prevent detection via window.chrome
    window.chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
    } as any;
  });
}

/**
 * Apply human-like mouse movement simulation
 */
export async function simulateMouseMovement(page: Page): Promise<void> {
  // Move mouse to random positions to simulate user presence
  const randomX = Math.floor(Math.random() * 1920);
  const randomY = Math.floor(Math.random() * 1080);

  await page.mouse.move(randomX, randomY);

  // Small random delay
  await page.waitForTimeout(getRandomDelay(200, 500));

  // Move to another position
  const randomX2 = Math.floor(Math.random() * 1920);
  const randomY2 = Math.floor(Math.random() * 1080);
  await page.mouse.move(randomX2, randomY2);
}

/**
 * Apply human-like typing behavior with realistic speed
 */
export async function typeWithDelay(
  page: Page,
  selector: string,
  text: string,
  minDelay: number = 50,
  maxDelay: number = 150
): Promise<void> {
  await page.click(selector);

  // Clear field if it has content
  await page.evaluate(() => {
    (document.activeElement as HTMLInputElement).value = "";
  });

  // Type with human-like delays between characters
  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(getRandomDelay(minDelay, maxDelay));
  }
}

/**
 * Set realistic HTTP headers for stealth
 */
export async function setBrowserHeaders(
  page: Page,
  userAgent?: string
): Promise<void> {
  const ua = userAgent || getRandomUserAgent();

  await page.setUserAgent(ua);

  // Set realistic request headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "max-age=0",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua":
      '"Not_A Brand";v="8", "Chromium";v="125", "Google Chrome";v="125"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
  });
}

/**
 * Simulate geolocation for stealth
 * Returns coordinates for common locations to avoid detection patterns
 */
export async function spoofGeolocation(
  page: Page,
  latitude: number = 40.7128,
  longitude: number = -74.006,
  accuracy: number = 100
): Promise<void> {
  const cdpSession = await page.createCDPSession();

  await cdpSession.send("Emulation.setGeolocationOverride", {
    latitude,
    longitude,
    accuracy,
  });
}

/**
 * Disable JavaScript execution detection
 */
export async function disableJavaScriptDetection(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    // Hide execution context detection
    (window as any).noWebDriver = true;

    // Hide automation traces in Function toString
    const originalFunctionToString = Function.prototype.toString;
    Function.prototype.toString = function () {
      if (this === navigator.permissions.query) {
        return "function query() { [native code] }";
      }
      return originalFunctionToString.call(this);
    };
  });
}

/**
 * Create a stealth-enabled page with all evasion techniques
 */
export async function createStealthPage(
  browser: Browser,
  config: StealthConfig = DEFAULT_STEALTH_CONFIG
): Promise<Page> {
  const page = await browser.newPage();

  if (!config.enabled) {
    return page;
  }

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set headers and user-agent
  if (config.rotateUserAgent) {
    await setBrowserHeaders(page, getRandomUserAgent());
  } else {
    await setBrowserHeaders(page);
  }

  // Apply JavaScript-level stealth measures
  await applyPageStealth(page, config);
  await disableJavaScriptDetection(page);

  // Spoof geolocation if enabled
  if (config.spoofGeolocation) {
    await spoofGeolocation(page);
  }

  return page;
}

/**
 * Navigate with stealth (human-like delays and behavior)
 */
export async function navigateWithStealth(
  page: Page,
  url: string,
  config: StealthConfig = DEFAULT_STEALTH_CONFIG,
  timeoutMs: number = 30000
): Promise<void> {
  // Simulate mouse movement before navigation
  if (config.randomizeMouse) {
    await simulateMouseMovement(page);
  }

  // Add delay before navigation
  if (config.randomizeDelay) {
    await page.waitForTimeout(
      getRandomDelay(config.minDelay, config.maxDelay)
    );
  }

  // Navigate to page
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: timeoutMs,
  });

  // Simulate page interaction
  if (config.randomizeMouse) {
    await simulateMouseMovement(page);
  }
}

/**
 * Click with human-like delay and behavior
 */
export async function clickWithStealth(
  page: Page,
  selector: string,
  config: StealthConfig = DEFAULT_STEALTH_CONFIG
): Promise<void> {
  if (config.randomizeMouse) {
    // Move mouse to element before clicking
    const element = await page.$(selector);
    if (element) {
      const box = await element.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      }
    }
  }

  if (config.randomizeDelay) {
    await page.waitForTimeout(
      getRandomDelay(config.minDelay, config.maxDelay)
    );
  }

  await page.click(selector);

  if (config.randomizeDelay) {
    await page.waitForTimeout(
      getRandomDelay(config.minDelay, config.maxDelay)
    );
  }
}

/**
 * Scroll page with human-like behavior
 */
export async function scrollWithStealth(
  page: Page,
  distance: number = 500,
  config: StealthConfig = DEFAULT_STEALTH_CONFIG
): Promise<void> {
  if (config.randomizeDelay) {
    await page.waitForTimeout(
      getRandomDelay(config.minDelay, config.maxDelay)
    );
  }

  // Simulate multiple small scrolls instead of one large scroll
  const scrolls = Math.ceil(distance / 100);
  for (let i = 0; i < scrolls; i++) {
    await page.evaluate((dist) => {
      window.scrollBy(0, dist);
    }, 100);

    if (config.randomizeDelay) {
      await page.waitForTimeout(getRandomDelay(200, 500));
    }
  }
}
