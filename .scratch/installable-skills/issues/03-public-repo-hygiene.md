# Public repository hygiene

Type: grilling

## Question

This repository is published as-is — what must be tidied up before the push:

1. License: which one do we pick (MIT/Apache-2.0/other)? Without it "public" is meaningless.
2. `.scratch/` is not in `.gitignore` and will ship in the published history along with the v4/v5 specs at the repo root — what do we remove, and what do we deliberately keep?
3. README as the storefront: is the current one enough, or do we write an installation section (the exact copy is decided later — here only whether it exists)?

The resolution fixes: the license + the list of files/directories to delete or ignore before the push.
