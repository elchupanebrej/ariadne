#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO/.agents/skills/ariadne"

if [[ ! -f "$SRC/SKILL.md" ]]; then
    echo "error: SKILL.md not found at $SRC" >&2
    exit 1
fi

link_one() {
    local dir="$1" target="$2"
    local path="$dir/ariadne"
    mkdir -p "$dir"
    if [[ -L "$path" ]]; then
        if [[ "$(readlink "$path")" == "$target" ]]; then
            echo "= $path"
        else
            ln -sfn "$target" "$path"
            echo "~ $path -> $target"
        fi
    elif [[ -e "$path" ]]; then
        echo "! skipping $path (real directory exists)" >&2
    else
        ln -s "$target" "$path"
        echo "+ $path -> $target"
    fi
}

echo "== WSL =="
link_one "$HOME/.agents/skills" "$SRC"
link_one "$HOME/.gemini/config/skills" "$SRC"

echo "== Windows =="
if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -ExecutionPolicy Bypass \
        -File "$(wslpath -w "$REPO/scripts/link-skill.ps1")" | tr -d '\r'
else
    echo "powershell.exe not available; run scripts/link-skill.ps1 from Windows manually" >&2
fi
