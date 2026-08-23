import type { ParserCheckResult } from "./types.js";

/**
 * Deterministic config line parser:
 * - Splits on first '='
 * - Retains subsequent '=' in the value
 * - Throws if empty key or missing delimiter
 */
export function parseConfigLine(line: string): [string, string] {
  const delimiter = line.indexOf("=");
  if (delimiter <= 0) {
    throw new Error("Invalid config line: missing delimiter or empty key");
  }
  return [line.slice(0, delimiter), line.slice(delimiter + 1)];
}

/**
 * Execute the 4 deterministic test cases for the config line parser:
 * 1. "A=1" -> ["A", "1"]
 * 2. "TOKEN=a=b" -> ["TOKEN", "a=b"]
 * 3. "=x" -> throws Error
 * 4. "NO_DELIMITER" -> throws Error
 */
export function runParserCheck(): ParserCheckResult {
  const testCases = [
    { input: "A=1", expected: ["A", "1"], shouldThrow: false },
    { input: "TOKEN=a=b", expected: ["TOKEN", "a=b"], shouldThrow: false },
    { input: "=x", shouldThrow: true },
    { input: "NO_DELIMITER", shouldThrow: true },
  ];

  const results: ParserCheckResult["results"] = [];
  let allPassed = true;

  for (const tc of testCases) {
    try {
      const output = parseConfigLine(tc.input);
      if (tc.shouldThrow) {
        allPassed = false;
        results.push({
          input: tc.input,
          output,
          error: "Expected error but function succeeded",
          passed: false,
        });
      } else {
        const match =
          tc.expected &&
          output[0] === tc.expected[0] &&
          output[1] === tc.expected[1];
        if (!match) allPassed = false;
        results.push({
          input: tc.input,
          output,
          passed: Boolean(match),
        });
      }
    } catch (err) {
      if (tc.shouldThrow) {
        results.push({
          input: tc.input,
          error: err instanceof Error ? err.message : String(err),
          passed: true,
        });
      } else {
        allPassed = false;
        results.push({
          input: tc.input,
          error: err instanceof Error ? err.message : String(err),
          passed: false,
        });
      }
    }
  }

  return {
    passed: allPassed,
    casesCount: testCases.length,
    results,
  };
}
