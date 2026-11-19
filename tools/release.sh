#!/usr/bin/env bash
# Push the release, publish the GitHub release and (if logged in) the npm package.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
echo "releasing $VERSION"

git push --follow-tags

gh release create "v$VERSION" \
  --title "$VERSION" \
  --notes-file RELEASE_NOTES.md

if npm whoami >/dev/null 2>&1; then
  npm publish --access public
else
  echo "npm: not logged in — run 'npm login' then 'npm publish --access public'"
fi
