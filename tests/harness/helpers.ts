import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const newRoot = async (): Promise<string> =>
  join(await mkdtemp(join(tmpdir(), "ariadne-attempt-")), ".ariadne");

export const hourFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 3_600_000).toISOString();
