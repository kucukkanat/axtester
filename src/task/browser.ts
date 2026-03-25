import puppeteer, { type Browser, type Page } from "puppeteer";
import type { PageSnapshot, InteractiveElement } from "../task-types.ts";
import type { StealthConfig } from "../stealth.ts";
import {
  DEFAULT_STEALTH_CONFIG,
  getStealthLaunchArgs,
  createStealthPage,
  navigateWithStealth,
  clickWithStealth,
  scrollWithStealth,
  typeWithDelay,
} from "../stealth.ts";

export interface BrowserConfig {
  viewport?: {
    width: number;
    height: number;
  };
  extraHeaders?: Record<string, string>;
  userAgent?: string;
  stealth?: StealthConfig;
}

export class BrowserController {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;
  private stealthConfig: StealthConfig;

  constructor(config: BrowserConfig = {}) {
    this.config = config;
    this.stealthConfig = config.stealth || DEFAULT_STEALTH_CONFIG;
  }

  async launch(): Promise<void> {
    const launchConfig: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
    };

    // Add stealth launch arguments if enabled
    if (this.stealthConfig.enabled) {
      launchConfig.args = getStealthLaunchArgs(this.config.userAgent);
    }

    this.browser = await puppeteer.launch(launchConfig);
  }

  async createPage(): Promise<void> {
    if (!this.browser) {
      throw new Error("Browser not launched");
    }

    // Create page with or without stealth
    if (this.stealthConfig.enabled) {
      this.page = await createStealthPage(this.browser, this.stealthConfig);
    } else {
      this.page = await this.browser.newPage();

      // Set viewport
      if (this.config.viewport) {
        await this.page.setViewport(this.config.viewport);
      } else {
        await this.page.setViewport({ width: 1280, height: 720 });
      }

      // Set extra headers
      if (this.config.extraHeaders) {
        await this.page.setExtraHTTPHeaders(this.config.extraHeaders);
      }

      // Set user agent
      if (this.config.userAgent) {
        await this.page.setUserAgent(this.config.userAgent);
      }
    }
  }

  async navigate(url: string, timeoutMs: number = 30000): Promise<void> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    try {
      if (this.stealthConfig.enabled) {
        await navigateWithStealth(this.page, url, this.stealthConfig, timeoutMs);
      } else {
        await this.page.goto(url, {
          waitUntil: "networkidle2",
          timeout: timeoutMs,
        });
      }
    } catch (error) {
      // Still return if page loaded but network stayed busy
      const currentUrl = this.page.url();
      if (currentUrl && currentUrl !== "about:blank") {
        return;
      }
      throw error;
    }
  }

  async click(
    selector: string,
    waitForNavigation: boolean = false
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    if (this.stealthConfig.enabled) {
      if (waitForNavigation) {
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {}),
          clickWithStealth(this.page, selector, this.stealthConfig),
        ]);
      } else {
        await clickWithStealth(this.page, selector, this.stealthConfig);
      }
    } else {
      if (waitForNavigation) {
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {}),
          this.page.click(selector),
        ]);
      } else {
        await this.page.click(selector);
      }
    }
  }

  async type(
    selector: string,
    text: string,
    clearFirst: boolean = false
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    if (this.stealthConfig.enabled) {
      await typeWithDelay(this.page, selector, text);
    } else {
      if (clearFirst) {
        await this.page.click(selector);
        await this.page.keyboard.press("Control+A");
        await this.page.keyboard.press("Backspace");
      }

      await this.page.type(selector, text);
    }
  }

  async select(selector: string, optionLabel: string): Promise<void> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    await this.page.select(selector, optionLabel);
  }

  async scroll(direction: "up" | "down", amount: number = 500): Promise<void> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    if (this.stealthConfig.enabled) {
      const scrollAmount = direction === "down" ? amount : -amount;
      await scrollWithStealth(this.page, Math.abs(scrollAmount), this.stealthConfig);
    } else {
      const scrollAmount = direction === "down" ? amount : -amount;
      await this.page.evaluate((amount) => {
        window.scrollBy(0, amount);
      }, scrollAmount);
    }
  }

  async extractText(selector?: string, maxChars: number = 2000): Promise<string> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    if (selector) {
      const text = await this.page.$eval(
        selector,
        (el) => el.textContent || ""
      );
      return text.substring(0, maxChars);
    }

    const text = await this.page.evaluate(() => {
      return document.body.textContent || "";
    });
    return text.substring(0, maxChars);
  }

  async findElements(query: string): Promise<InteractiveElement[]> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    const elements = await this.page.evaluate(
      (searchQuery) => {
        const results: Array<{
          tag: string;
          text: string;
          type?: string;
          value?: string;
          disabled: boolean;
          href?: string;
          xpath: string;
        }> = [];

        const searchLower = searchQuery.toLowerCase();

        // Search through interactive elements
        const interactive = document.querySelectorAll(
          "button, a, input, select, textarea, [role='button'], [role='link']"
        );

        let index = 0;
        for (const el of interactive) {
          const text = el.textContent?.trim() || "";
          const value =
            (el as HTMLInputElement).value || (el as HTMLSelectElement).value || "";
          const href = (el as HTMLAnchorElement).href || "";
          const disabled = (el as HTMLInputElement).disabled || false;
          const type = (el as HTMLInputElement).type || undefined;

          if (
            text.toLowerCase().includes(searchLower) ||
            value.toLowerCase().includes(searchLower) ||
            href.toLowerCase().includes(searchLower)
          ) {
            // Simple XPath-like identifier
            const xpath = generateSimplePath(el);
            results.push({
              tag: el.tagName.toLowerCase(),
              text,
              type,
              value: value || undefined,
              disabled,
              href: href || undefined,
              xpath,
            });
          }
          index++;
        }

        return results;
      },
      query
    );

    // Convert to InteractiveElement format with indices
    return elements.map((el, idx) => ({
      index: idx,
      tag: el.tag,
      text: el.text,
      type: el.type,
      value: el.value,
      disabled: el.disabled,
      href: el.href,
    }));
  }

  async captureSnapshot(): Promise<PageSnapshot> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    const snapshot = await this.page.evaluate(() => {
      const url = window.location.href;
      const title = document.title;

      // Capture interactive elements
      const elements: Array<{
        tag: string;
        text: string;
        type?: string;
        value?: string;
        disabled: boolean;
        href?: string;
      }> = [];

      const interactive = document.querySelectorAll(
        "button, a, input, select, textarea, [role='button'], [role='link']"
      );

      for (const el of interactive) {
        const text = (el.textContent || "").trim().substring(0, 100);
        const value =
          (el as HTMLInputElement).value ||
          (el as HTMLSelectElement).value ||
          "";
        const href = (el as HTMLAnchorElement).href || "";
        const disabled = (el as HTMLInputElement).disabled || false;
        const type = (el as HTMLInputElement).type || undefined;

        elements.push({
          tag: el.tagName.toLowerCase(),
          text,
          type,
          value: value || undefined,
          disabled,
          href: href || undefined,
        });
      }

      // Capture visible text
      const visibleText = (document.body.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 2000);

      return {
        url,
        title,
        elements,
        visibleText,
      };
    });

    // Map to InteractiveElement with indices
    const interactiveElements: InteractiveElement[] = snapshot.elements.map(
      (el, idx) => ({
        index: idx,
        tag: el.tag,
        text: el.text,
        type: el.type,
        value: el.value,
        disabled: el.disabled,
        href: el.href,
      })
    );

    return {
      url: snapshot.url,
      title: snapshot.title,
      interactiveElements,
      visibleText: snapshot.visibleText,
    };
  }

  async takeScreenshot(): Promise<string> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    const buffer = await this.page.screenshot({ encoding: "base64" });
    return buffer as string;
  }

  async waitForSelector(
    selector: string,
    timeoutMs: number = 5000
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    await this.page.waitForSelector(selector, { timeout: timeoutMs });
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async getPageStatus(): Promise<{
    url: string;
    statusCode: number | null;
  }> {
    if (!this.page) {
      throw new Error("Page not created");
    }

    const url = this.page.url();
    let statusCode = null;

    try {
      const response = await this.page.goto(url, { waitUntil: "domcontentloaded" });
      statusCode = response?.status() || null;
    } catch {
      // Status code may not be available
    }

    return { url, statusCode };
  }
}

// Helper: generate simple xpath-like identifier for an element
function generateSimplePath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const index = Array.from(current.parentElement?.children || []).indexOf(current) + 1;
    parts.unshift(`${tag}[${index}]`);
    current = current.parentElement;
  }

  return "/" + parts.join("/");
}
