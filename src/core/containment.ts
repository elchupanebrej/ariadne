import fs from "node:fs";
import path from "node:path";
import { AriadneError } from "./errors.js";

/**
 * Managed projection file names and directory within storage root.
 */
export const MANAGED_PROJECTION_FILES = ["STATE.yaml", "INDEX.md"] as const;
export const MANAGED_CARDS_DIR = "cards" as const;

/**
 * Resolves realpath for existing paths or realpath of closest existing ancestor
 * combined with remaining uncreated segments.
 * Dereferences symlinks along the path.
 *
 * @param pathInput - File or directory path to canonicalize.
 * @returns Canonicalized absolute path.
 */
export function canonicalizePath(pathInput: string): string {
  let curr = path.resolve(pathInput);
  const uncreatedSegments: string[] = [];
  const visitedSymlinks = new Set<string>();

  while (true) {
    try {
      const real = fs.realpathSync(curr);
      return uncreatedSegments.length > 0
        ? path.join(real, ...uncreatedSegments.reverse())
        : real;
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;

        if (code === "ELOOP") {
          throw new AriadneError({
            code: "PATH_ESCAPE",
            message: `Symlink loop detected while resolving path: ${pathInput}`,
            repair: "Ensure all paths and symlinks reside within the designated storage root.",
            detail: { path: pathInput },
          });
        }

        if (code === "EACCES" || code === "EPERM") {
          throw new AriadneError({
            code: "PERMISSION_DENIED",
            message: `Permission denied accessing path: ${curr}`,
            repair: "Ensure the process has read and write permissions for the designated storage root.",
            detail: { path: curr },
          });
        }

        if (code === "ENOENT" || code === "ENOTDIR") {
          // Check if curr is a symlink pointing to a non-existent target
          try {
            const lstat = fs.lstatSync(curr);
            if (lstat.isSymbolicLink()) {
              if (visitedSymlinks.has(curr)) {
                throw new AriadneError({
                  code: "PATH_ESCAPE",
                  message: `Symlink loop detected while resolving path: ${pathInput}`,
                  repair: "Ensure all paths and symlinks reside within the designated storage root.",
                  detail: { path: pathInput },
                });
              }
              visitedSymlinks.add(curr);
              const linkTarget = fs.readlinkSync(curr);
              curr = path.resolve(path.dirname(curr), linkTarget);
              continue;
            }
          } catch {
            // curr does not exist at all on disk
          }

          const parent = path.dirname(curr);
          if (parent === curr) {
            // Filesystem root reached
            return uncreatedSegments.length > 0
              ? path.join(curr, ...uncreatedSegments.reverse())
              : curr;
          }
          uncreatedSegments.push(path.basename(curr));
          curr = parent;
          continue;
        }
      }

      throw err;
    }
  }
}

/**
 * Resolves a candidate target path relative to storageRoot or cwd appropriately.
 */
function resolveCandidateTargetPath(canonicalRoot: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  // If targetPath is relative:
  // If resolving against cwd places it inside canonicalRoot (e.g. ".ariadne/cards/foo.md"),
  // use that. Otherwise resolve against canonicalRoot (e.g. "cards/foo.md" or "../outside").
  const cwdResolved = path.resolve(targetPath);
  const relToCwd = path.relative(canonicalRoot, cwdResolved);
  const cwdContained =
    !path.isAbsolute(relToCwd) &&
    relToCwd !== ".." &&
    !relToCwd.startsWith(".." + path.sep);

  if (cwdContained) {
    return cwdResolved;
  }

  return path.resolve(canonicalRoot, targetPath);
}

/**
 * Checks whether targetPath resolves strictly within canonical storageRoot.
 *
 * @param storageRoot - Designated storage root directory.
 * @param targetPath - Path to check.
 * @returns True if target is contained within storageRoot, false otherwise.
 */
export function isContainedPath(storageRoot: string, targetPath: string): boolean {
  try {
    const canonicalRoot = canonicalizePath(storageRoot);
    const candidatePath = resolveCandidateTargetPath(canonicalRoot, targetPath);
    const canonicalTarget = canonicalizePath(candidatePath);
    const rel = path.relative(canonicalRoot, canonicalTarget);

    return !path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + path.sep);
  } catch {
    return false;
  }
}

/**
 * Validates that targetPath canonicalizes strictly within the canonicalized storageRoot.
 * If a symlink or relative path (../) resolves outside the canonical storage root boundary,
 * throws AriadneError(PATH_ESCAPE).
 *
 * @param storageRoot - Designated storage root directory.
 * @param targetPath - Target path to validate.
 * @returns Canonicalized target path.
 */
export function assertContainedPath(storageRoot: string, targetPath: string): string {
  const canonicalRoot = canonicalizePath(storageRoot);
  const candidatePath = resolveCandidateTargetPath(canonicalRoot, targetPath);
  const canonicalTarget = canonicalizePath(candidatePath);
  const rel = path.relative(canonicalRoot, canonicalTarget);

  const isContained =
    !path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + path.sep);

  if (!isContained) {
    throw new AriadneError({
      code: "PATH_ESCAPE",
      message: `Target path "${targetPath}" resolves outside storage root "${storageRoot}"`,
      repair: "Ensure all paths and symlinks reside within the designated storage root.",
      detail: {
        storageRoot,
        targetPath,
        canonicalRoot,
        canonicalTarget,
      },
    });
  }

  return canonicalTarget;
}

/**
 * Detects non-regular files (FIFOs, UNIX domain sockets, character devices, block devices).
 * If a special file is detected, throws AriadneError(INVALID_INPUT).
 * Non-existent files are accepted (so new files can be created).
 *
 * @param targetPath - Path to inspect.
 */
export function assertRegularFileOrDirectory(targetPath: string): void {
  try {
    const stats = fs.statSync(targetPath);
    if (
      stats.isFIFO() ||
      stats.isSocket() ||
      stats.isCharacterDevice() ||
      stats.isBlockDevice() ||
      (!stats.isFile() && !stats.isDirectory())
    ) {
      throw new AriadneError({
        code: "INVALID_INPUT",
        message: "Special files (FIFOs, sockets, character/block devices) are not supported",
        repair: "Ensure storage targets are regular files or directories.",
        detail: {
          targetPath,
          isFIFO: stats.isFIFO(),
          isSocket: stats.isSocket(),
          isCharacterDevice: stats.isCharacterDevice(),
          isBlockDevice: stats.isBlockDevice(),
        },
      });
    }
  } catch (err: unknown) {
    if (err instanceof AriadneError) {
      throw err;
    }
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: string }).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return;
      }
    }
    // Also check lstatSync in case statSync failed on a broken link or device
    try {
      const lstats = fs.lstatSync(targetPath);
      if (
        lstats.isFIFO() ||
        lstats.isSocket() ||
        lstats.isCharacterDevice() ||
        lstats.isBlockDevice()
      ) {
        throw new AriadneError({
          code: "INVALID_INPUT",
          message: "Special files (FIFOs, sockets, character/block devices) are not supported",
          repair: "Ensure storage targets are regular files or directories.",
          detail: {
            targetPath,
            isFIFO: lstats.isFIFO(),
            isSocket: lstats.isSocket(),
            isCharacterDevice: lstats.isCharacterDevice(),
            isBlockDevice: lstats.isBlockDevice(),
          },
        });
      }
    } catch (lstatErr: unknown) {
      if (lstatErr instanceof AriadneError) {
        throw lstatErr;
      }
    }
  }
}

/**
 * Checks whether targetPath is a safe projection target for --force overwriting.
 * Safe targets are STATE.yaml, INDEX.md, and cards under cards/ (e.g. cards/*.md).
 *
 * @param storageRoot - Designated storage root directory.
 * @param targetPath - Path to check.
 * @returns True if target is a safe projection file within storageRoot.
 */
export function isSafeForceTarget(storageRoot: string, targetPath: string): boolean {
  try {
    const canonicalRoot = canonicalizePath(storageRoot);
    const candidatePath = resolveCandidateTargetPath(canonicalRoot, targetPath);
    const canonicalTarget = canonicalizePath(candidatePath);
    const rel = path.relative(canonicalRoot, canonicalTarget);

    if (path.isAbsolute(rel) || rel === ".." || rel.startsWith(".." + path.sep)) {
      return false;
    }

    const posixRel = rel.split(path.sep).join("/");
    if (posixRel === "STATE.yaml" || posixRel === "INDEX.md") {
      return true;
    }
    if (
      posixRel.startsWith("cards/") &&
      posixRel.endsWith(".md") &&
      posixRel.length > "cards/.md".length
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Restricts --force overwriting to known managed Ariadne projection files:
 * STATE.yaml, INDEX.md, and cards under cards/ (e.g. cards/*.md).
 *
 * If target is not a managed projection file within the storage root, fails closed
 * by throwing AriadneError(INVALID_INPUT).
 *
 * @param storageRoot - Designated storage root directory.
 * @param targetPath - Path of the target to overwrite.
 */
export function assertSafeForceTarget(storageRoot: string, targetPath: string): void {
  if (!isSafeForceTarget(storageRoot, targetPath)) {
    throw new AriadneError({
      code: "INVALID_INPUT",
      message: "The --force flag is restricted to managed Ariadne projection files (STATE.yaml, INDEX.md, cards)",
      repair: "Do not use --force on unmanaged files or source code.",
      detail: {
        storageRoot,
        targetPath,
      },
    });
  }
}

/**
 * Composite helper that validates both containment within the storage root
 * and that the target is not an unsupported special file.
 *
 * @param storageRoot - Designated storage root directory.
 * @param targetPath - Path to validate.
 * @returns Canonicalized target path.
 */
export function assertContainedStorageTarget(
  storageRoot: string,
  targetPath: string,
): string {
  const canonicalTarget = assertContainedPath(storageRoot, targetPath);
  assertRegularFileOrDirectory(canonicalTarget);
  return canonicalTarget;
}
