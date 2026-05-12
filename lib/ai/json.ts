/**
 * Parses JSON returned by an AI model. Models occasionally wrap JSON in
 * markdown, add short prose, emit literal newlines inside strings, or leave a
 * trailing comma before a closing bracket. This keeps schema validation strict
 * while tolerating those common formatting slips.
 */
export function parseAIJson(text: string): unknown {
  const extracted = extractJsonBlock(stripMarkdownFence(text.trim()));
  const candidates = [
    extracted,
    escapeControlCharsInStrings(extracted),
    stripTrailingCommas(extracted),
    stripTrailingCommas(escapeControlCharsInStrings(extracted)),
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Invalid JSON");
}

function stripMarkdownFence(s: string): string {
  if (!s.startsWith("```")) return s;
  return s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
}

function extractJsonBlock(s: string): string {
  const firstObject = s.indexOf("{");
  const firstArray = s.indexOf("[");
  const starts = [firstObject, firstArray].filter((i) => i >= 0);
  if (starts.length === 0) return s;

  const start = Math.min(...starts);
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  const end = s.lastIndexOf(close);

  return end > start ? s.slice(start, end + 1) : s.slice(start);
}

function stripTrailingCommas(s: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (!inString && ch === ",") {
      let j = i + 1;
      while (/\s/.test(s[j] ?? "")) j += 1;
      if (s[j] === "}" || s[j] === "]") continue;
    }
    result += ch;
  }

  return result;
}

function escapeControlCharsInStrings(s: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
    }
    result += ch;
  }

  return result;
}
