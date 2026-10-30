#!/bin/bash
# Code Review Diff Helper for Linux/Mac

# Try to fetch but don't fail if offline
git fetch origin main 2>/dev/null || echo "Warning: Could not fetch from origin."

# Determine base branch
TARGET="origin/main"
if ! git rev-parse --verify "$TARGET" >/dev/null 2>&1; then
    echo "origin/main not found, defaulting to main"
    TARGET="main"
fi

# Find merge base
BASE=$(git merge-base "$TARGET" HEAD)

if [ -z "$BASE" ]; then
  echo "Error: Could not find merge base between HEAD and $TARGET"
  exit 1
fi

echo "Generating diff against $TARGET (Base: $BASE)..."
git diff "$BASE"
