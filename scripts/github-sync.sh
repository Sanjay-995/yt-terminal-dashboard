#!/bin/bash
set -e

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set — cannot sync to GitHub." >&2
  exit 1
fi

GITHUB_REMOTE="https://x-access-token@github.com/Sanjay-995/yt-terminal-dashboard.git"

ASKPASS=$(mktemp)
trap "rm -f $ASKPASS" EXIT
chmod 700 "$ASKPASS"
printf '#!/bin/bash\necho "$GITHUB_PERSONAL_ACCESS_TOKEN"\n' > "$ASKPASS"

GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$ASKPASS" \
  git push "$GITHUB_REMOTE" HEAD:main --force-with-lease

echo "GitHub mirror updated successfully."
