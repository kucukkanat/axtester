import type {
  BrowserToolName,
  BrowserToolResult,
  LLMTool,
} from "../task-types.ts";
import { BrowserController } from "./browser.ts";

export function getBrowserTools(): LLMTool[] {
  return [
    {
      name: "navigate",
      description: "Navigate to a URL",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to navigate to",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "click",
      description:
        "Click on an interactive element by its index from the page snapshot",
      inputSchema: {
        type: "object",
        properties: {
          elementIndex: {
            type: "number",
            description: "Index of the element in the snapshot's interactiveElements list",
          },
          waitForNavigation: {
            type: "boolean",
            description: "Wait for page navigation after clicking (default: false)",
          },
        },
        required: ["elementIndex"],
      },
    },
    {
      name: "type",
      description: "Type text into an input field",
      inputSchema: {
        type: "object",
        properties: {
          elementIndex: {
            type: "number",
            description: "Index of the input element in the snapshot",
          },
          text: {
            type: "string",
            description: "Text to type",
          },
          clearFirst: {
            type: "boolean",
            description: "Clear the field before typing (default: false)",
          },
        },
        required: ["elementIndex", "text"],
      },
    },
    {
      name: "scroll",
      description: "Scroll the page up or down",
      inputSchema: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["up", "down"],
            description: "Scroll direction",
          },
          amount: {
            type: "number",
            description: "Pixels to scroll (default: 500)",
          },
        },
        required: ["direction"],
      },
    },
    {
      name: "select",
      description: "Select an option from a dropdown menu",
      inputSchema: {
        type: "object",
        properties: {
          elementIndex: {
            type: "number",
            description: "Index of the select element in the snapshot",
          },
          optionLabel: {
            type: "string",
            description: "Text label of the option to select",
          },
        },
        required: ["elementIndex", "optionLabel"],
      },
    },
    {
      name: "extract_text",
      description: "Extract text content from the page or a specific element",
      inputSchema: {
        type: "object",
        properties: {
          elementIndex: {
            type: "number",
            description:
              "Optional: index of specific element to extract from. If omitted, extracts all visible text.",
          },
          maxChars: {
            type: "number",
            description: "Maximum characters to extract (default: 2000)",
          },
        },
        required: [],
      },
    },
    {
      name: "find_elements",
      description:
        "Find interactive elements matching a text query and return their indices",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Text to search for in element labels, values, or hrefs",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "screenshot",
      description: "Take a screenshot of the current page state",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "wait",
      description: "Wait for time or for a selector to appear",
      inputSchema: {
        type: "object",
        properties: {
          ms: {
            type: "number",
            description: "Milliseconds to wait (default: 1000)",
          },
          selector: {
            type: "string",
            description: "CSS selector to wait for instead of just time",
          },
        },
        required: [],
      },
    },
    {
      name: "done",
      description: "Complete the task with a final answer",
      inputSchema: {
        type: "object",
        properties: {
          answer: {
            type: "string",
            description: "The answer or information found",
          },
        },
        required: ["answer"],
      },
    },
    {
      name: "fail",
      description: "Abort the task due to a barrier or inability to proceed",
      inputSchema: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Why the task cannot continue",
          },
          barrierType: {
            type: "string",
            enum: [
              "captcha",
              "login-wall",
              "consent-wall",
              "rate-limit",
              "missing-label",
              "no-accessible-element",
              "js-only",
              "navigation-timeout",
              "interaction-timeout",
              "loop-detected",
              "unknown",
            ],
            description: "Type of barrier encountered",
          },
        },
        required: ["reason"],
      },
    },
  ];
}

export type ToolExecutor = (
  browser: BrowserController,
  input: Record<string, unknown>
) => Promise<BrowserToolResult>;

// Re-export for convenience
export type { BrowserToolName } from "../task-types.ts";

export const toolExecutors: Record<BrowserToolName, ToolExecutor> = {
  navigate: async (browser, input) => {
    const url = input.url as string;
    if (!url) {
      return {
        success: false,
        error: "URL is required",
      };
    }

    try {
      await browser.navigate(url);
      return {
        success: true,
        data: { url },
      };
    } catch (error) {
      return {
        success: false,
        error: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  click: async (browser, input) => {
    const elementIndex = input.elementIndex as number;
    const waitForNavigation = (input.waitForNavigation as boolean) || false;

    if (elementIndex === undefined || elementIndex === null) {
      return {
        success: false,
        error: "elementIndex is required",
      };
    }

    try {
      const snapshot = await browser.captureSnapshot();
      const element = snapshot.interactiveElements[elementIndex];

      if (!element) {
        return {
          success: false,
          error: `Element at index ${elementIndex} not found`,
        };
      }

      // Build selector based on element properties
      let selector = buildSelector(element, snapshot);

      await browser.click(selector, waitForNavigation);

      return {
        success: true,
        data: { clicked: element.text || element.tag },
      };
    } catch (error) {
      return {
        success: false,
        error: `Click failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  type: async (browser, input) => {
    const elementIndex = input.elementIndex as number;
    const text = input.text as string;
    const clearFirst = (input.clearFirst as boolean) || false;

    if (elementIndex === undefined || text === undefined) {
      return {
        success: false,
        error: "elementIndex and text are required",
      };
    }

    try {
      const snapshot = await browser.captureSnapshot();
      const element = snapshot.interactiveElements[elementIndex];

      if (!element) {
        return {
          success: false,
          error: `Element at index ${elementIndex} not found`,
        };
      }

      const selector = buildSelector(element, snapshot);
      await browser.type(selector, text, clearFirst);

      return {
        success: true,
        data: { typed: text },
      };
    } catch (error) {
      return {
        success: false,
        error: `Type failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  scroll: async (browser, input) => {
    const direction = input.direction as "up" | "down";
    const amount = (input.amount as number) || 500;

    if (!direction) {
      return {
        success: false,
        error: "direction (up/down) is required",
      };
    }

    try {
      await browser.scroll(direction, amount);
      return {
        success: true,
        data: { direction, amount },
      };
    } catch (error) {
      return {
        success: false,
        error: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  select: async (browser, input) => {
    const elementIndex = input.elementIndex as number;
    const optionLabel = input.optionLabel as string;

    if (elementIndex === undefined || !optionLabel) {
      return {
        success: false,
        error: "elementIndex and optionLabel are required",
      };
    }

    try {
      const snapshot = await browser.captureSnapshot();
      const element = snapshot.interactiveElements[elementIndex];

      if (!element) {
        return {
          success: false,
          error: `Element at index ${elementIndex} not found`,
        };
      }

      const selector = buildSelector(element, snapshot);
      await browser.select(selector, optionLabel);

      return {
        success: true,
        data: { selected: optionLabel },
      };
    } catch (error) {
      return {
        success: false,
        error: `Select failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  extract_text: async (browser, input) => {
    const elementIndex = input.elementIndex as number | undefined;
    const maxChars = (input.maxChars as number) || 2000;

    try {
      let selector: string | undefined;
      if (elementIndex !== undefined) {
        const snapshot = await browser.captureSnapshot();
        const element = snapshot.interactiveElements[elementIndex];
        if (!element) {
          return {
            success: false,
            error: `Element at index ${elementIndex} not found`,
          };
        }
        selector = buildSelector(element, snapshot);
      }

      const text = await browser.extractText(selector, maxChars);
      return {
        success: true,
        data: { text },
      };
    } catch (error) {
      return {
        success: false,
        error: `Extract text failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  find_elements: async (browser, input) => {
    const query = input.query as string;

    if (!query) {
      return {
        success: false,
        error: "query is required",
      };
    }

    try {
      const elements = await browser.findElements(query);
      return {
        success: true,
        data: {
          found: elements.length,
          elements: elements.map((el) => ({
            index: el.index,
            tag: el.tag,
            text: el.text,
            type: el.type,
            disabled: el.disabled,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Find elements failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  screenshot: async (browser) => {
    try {
      const screenshotBase64 = await browser.takeScreenshot();
      return {
        success: true,
        screenshotBase64,
      };
    } catch (error) {
      return {
        success: false,
        error: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  wait: async (browser, input) => {
    const ms = (input.ms as number) || 1000;
    const selector = input.selector as string | undefined;

    try {
      if (selector) {
        await browser.waitForSelector(selector, ms);
      } else {
        await new Promise((resolve) => setTimeout(resolve, ms));
      }

      return {
        success: true,
        data: { waited: ms, selector },
      };
    } catch (error) {
      return {
        success: false,
        error: `Wait failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  done: async (_, input) => {
    const answer = input.answer as string;

    return {
      success: true,
      data: { answer },
    };
  },

  fail: async (_, input) => {
    const reason = input.reason as string;
    const barrierType = input.barrierType as string | undefined;

    return {
      success: false,
      error: reason,
      data: { barrierType },
    };
  },
};

// Helper: build CSS selector from element
function buildSelector(
  element: { tag: string; text: string; href?: string; type?: string },
  snapshot: { interactiveElements: typeof element[] }
): string {
  // For elements with specific attributes, use more specific selectors
  if (element.href) {
    return `a[href="${escapeCss(element.href)}"]`;
  }

  if (element.type) {
    return `${element.tag}[type="${escapeCss(element.type)}"]`;
  }

  // For buttons/links with text, use text content selector if available
  if (element.text && element.tag !== "input") {
    // Use a combination of tag and text content
    return `${element.tag}:has-text("${escapeCss(element.text)}")`;
  }

  // Fallback to tag with position in snapshot
  const sameTagElements = snapshot.interactiveElements.filter(
    (el) => el.tag === element.tag
  );
  const index = sameTagElements.indexOf(element);

  return `${element.tag}:nth-of-type(${index + 1})`;
}

// Helper: escape special characters in CSS selectors
function escapeCss(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
