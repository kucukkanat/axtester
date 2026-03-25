import { parse, HTMLElement } from "node-html-parser";
import type { FetchResult, ParsedPage } from "./types.ts";

export function parsePage(fetch: FetchResult): ParsedPage {
  // Parse with script/style content preserved for data extraction
  const root = parse(fetch.html, {
    comment: false,
  });

  const textContent = extractTextContent(root);
  const markdownEstimate = generateMarkdownEstimate(root);

  return {
    fetch,
    root,
    textContent,
    markdownEstimate,
  };
}

function extractTextContent(node: HTMLElement | string): string {
  if (typeof node === "string") {
    return node.trim();
  }

  if (!node.childNodes) {
    return "";
  }

  let text = "";

  for (const child of node.childNodes) {
    if (typeof child === "string") {
      const trimmed = child.trim();
      if (trimmed) {
        text += trimmed + " ";
      }
    } else if (child instanceof HTMLElement) {
      const tagName = child.tagName?.toLowerCase();

      // Skip script and style
      if (tagName === "script" || tagName === "style") {
        continue;
      }

      // Add space for block elements
      if (
        tagName === "p" ||
        tagName === "div" ||
        tagName === "h1" ||
        tagName === "h2" ||
        tagName === "h3" ||
        tagName === "h4" ||
        tagName === "h5" ||
        tagName === "h6" ||
        tagName === "li" ||
        tagName === "blockquote"
      ) {
        text += "\n";
      }

      text += extractTextContent(child);
    }
  }

  return text;
}

function generateMarkdownEstimate(node: HTMLElement | string, depth = 0): string {
  if (typeof node === "string") {
    return node.trim();
  }

  if (!node.childNodes) {
    return "";
  }

  let markdown = "";

  for (const child of node.childNodes) {
    if (typeof child === "string") {
      const trimmed = child.trim();
      if (trimmed) {
        markdown += trimmed + " ";
      }
    } else if (child instanceof HTMLElement) {
      const tagName = child.tagName?.toLowerCase();

      // Skip script and style
      if (tagName === "script" || tagName === "style") {
        continue;
      }

      // Handle specific tags
      if (tagName === "h1") {
        markdown += "\n# " + extractTextContent(child).trim() + "\n";
      } else if (tagName === "h2") {
        markdown += "\n## " + extractTextContent(child).trim() + "\n";
      } else if (tagName === "h3") {
        markdown += "\n### " + extractTextContent(child).trim() + "\n";
      } else if (tagName === "h4") {
        markdown += "\n#### " + extractTextContent(child).trim() + "\n";
      } else if (tagName === "h5") {
        markdown += "\n##### " + extractTextContent(child).trim() + "\n";
      } else if (tagName === "h6") {
        markdown += "\n###### " + extractTextContent(child).trim() + "\n";
      } else if (tagName === "p") {
        markdown += extractTextContent(child).trim() + "\n\n";
      } else if (tagName === "a") {
        const text = extractTextContent(child).trim();
        const href = child.getAttribute("href") || "#";
        markdown += `[${text}](${href})`;
      } else if (tagName === "br") {
        markdown += "\n";
      } else if (tagName === "li") {
        markdown += "- " + extractTextContent(child).trim() + "\n";
      } else if (tagName === "blockquote") {
        markdown += "> " + extractTextContent(child).trim() + "\n";
      } else if (tagName === "code") {
        markdown += "`" + extractTextContent(child).trim() + "`";
      } else if (tagName === "pre") {
        markdown += "```\n" + extractTextContent(child).trim() + "\n```\n";
      } else {
        // Recursively process other elements
        markdown += generateMarkdownEstimate(child, depth + 1);
      }
    }
  }

  return markdown;
}
