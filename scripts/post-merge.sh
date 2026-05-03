#!/bin/bash
set -e

git config --local core.hooksPath scripts/git-hooks

pnpm install --frozen-lockfile
pnpm --filter db push
