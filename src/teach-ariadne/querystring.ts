import { createHash } from "node:crypto";

export function parseQueryString(input: string): Record<string, string | string[]> {
  if (input.startsWith("?")) {
    input = input.slice(1);
  }
  if (!input) return {};

  // Check for malformed percent encoding: '%' not followed by 2 hex digits
  if (/%(?![0-9A-Fa-f]{2})/.test(input)) {
    throw new Error("Malformed percent encoding in query string");
  }

  // Pre-validate key segments for empty keys
  const pairs = input.split("&");
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf("=");
    const rawKey = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
    if (!rawKey.trim()) {
      throw new Error("Empty key in query string");
    }
  }

  const params = new URLSearchParams(input);
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of params.entries()) {
    if (!key) {
      throw new Error("Empty key in query string");
    }
    if (key in result) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing as string, value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

export interface QueryStringCheckCase {
  input: string;
  expected?: Record<string, string | string[]>;
  shouldThrow?: boolean;
}

export const DETERMINISTIC_QUERYSTRING_CASES: QueryStringCheckCase[] = [
  {
    input: "foo=bar&baz=qux",
    expected: { foo: "bar", baz: "qux" },
  },
  {
    input: "tag=alpha&tag=beta&tag=gamma",
    expected: { tag: ["alpha", "beta", "gamma"] },
  },
  {
    input: "greeting=hello%20world&delim=%3D%26",
    expected: { greeting: "hello world", delim: "=&" },
  },
  {
    input: "?page=1&size=20",
    expected: { page: "1", size: "20" },
  },
  {
    input: "",
    expected: {},
  },
  {
    input: "=value",
    shouldThrow: true,
  },
  {
    input: "foo=bar&=bad",
    shouldThrow: true,
  },
  {
    input: "key=%ZZ",
    shouldThrow: true,
  },
];

export interface QueryStringCheckResult {
  passed: boolean;
  casesCount: number;
  receipt: string;
  results: Array<{
    input: string;
    output?: Record<string, string | string[]>;
    error?: string;
    passed: boolean;
  }>;
}

export function runQueryStringCheck(
  cases: QueryStringCheckCase[] = DETERMINISTIC_QUERYSTRING_CASES,
): QueryStringCheckResult {
  const results = [];
  let allPassed = true;

  for (const tc of cases) {
    try {
      const out = parseQueryString(tc.input);
      if (tc.shouldThrow) {
        allPassed = false;
        results.push({ input: tc.input, output: out, passed: false });
      } else {
        const matches = JSON.stringify(out) === JSON.stringify(tc.expected);
        if (!matches) allPassed = false;
        results.push({ input: tc.input, output: out, passed: matches });
      }
    } catch (err: unknown) {
      if (tc.shouldThrow) {
        results.push({
          input: tc.input,
          error: (err as Error).message,
          passed: true,
        });
      } else {
        allPassed = false;
        results.push({
          input: tc.input,
          error: (err as Error).message,
          passed: false,
        });
      }
    }
  }

  const receiptDigest = createHash("sha256")
    .update(JSON.stringify(results))
    .digest("hex");

  return {
    passed: allPassed,
    casesCount: cases.length,
    receipt: `sha256:${receiptDigest}`,
    results,
  };
}
