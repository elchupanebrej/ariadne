export function parseConfigLine(line) {
  const delimiter = line.indexOf("=");
  if (delimiter <= 0) {
    throw new Error("Invalid config line: missing delimiter or empty key");
  }
  return [line.slice(0, delimiter), line.slice(delimiter + 1)];
}
