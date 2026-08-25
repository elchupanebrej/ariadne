import { relative } from "node:path";

/** DEC-RPT-06: paths that leave ariadne are project-root-relative POSIX paths. */
export const toRootRelative = (root: string, target: string): string =>
  relative(root, target).replaceAll("\\", "/");
