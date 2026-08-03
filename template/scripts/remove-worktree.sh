#!/bin/bash

set -e

WORKTREE_DIR=".claude/worktrees"

# If no argument, list existing worktrees and exit
if [ -z "$1" ]; then
    echo "Usage: $0 <worktree-name>"
    echo ""
    echo "Available worktrees:"
    if [ -d "$WORKTREE_DIR" ] && [ "$(ls -A "$WORKTREE_DIR" 2>/dev/null)" ]; then
        for dir in "$WORKTREE_DIR"/*/; do
            name=$(basename "$dir")
            echo "  $name"
        done
    else
        echo "  (none)"
    fi
    exit 0
fi

NAME=$1
WORKTREE_PATH="$WORKTREE_DIR/$NAME"
BRANCH_NAME="worktree-$NAME"

if [ ! -d "$WORKTREE_PATH" ]; then
    echo "Error: Worktree '$WORKTREE_PATH' does not exist"
    exit 1
fi

echo "Removing worktree '$NAME'..."

# git worktree remove doesn't work with submodules, so remove manually and prune
echo "  Removing worktree directory..."
rm -rf "$WORKTREE_PATH"
git worktree prune

# Delete the branch if it exists
if git rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
    echo "  Deleting branch $BRANCH_NAME..."
    git branch -D "$BRANCH_NAME"
fi

echo "Done."
