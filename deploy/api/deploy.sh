#!/bin/sh
# Deploys the Gardener API on the server. Run as root on 169.58.223.190:
#   sh /opt/gardener/src/deploy/api/deploy.sh [git-ref]   (default: origin/main)
#
# Builds the image from the public repo on the server itself (no registry),
# tags it with the commit, and restarts the container. Old images are pruned.
set -eu

REF="${1:-origin/main}"
ROOT=/opt/gardener
SRC=$ROOT/src

if [ ! -d "$SRC/.git" ]; then
  git clone -q https://github.com/bran0h/gardener.git "$SRC"
fi
git -C "$SRC" fetch -q origin
git -C "$SRC" checkout -q --detach "$REF"
SHA=$(git -C "$SRC" rev-parse --short HEAD)

cp "$SRC/deploy/api/docker-compose.yml" "$ROOT/docker-compose.yml"
[ -f "$ROOT/.env.api" ] || { echo "Missing $ROOT/.env.api (see deploy/api/.env.api.example)"; exit 1; }

echo "Building gardener-api:$SHA"
docker build -q -f "$SRC/apps/api/Dockerfile" -t "gardener-api:$SHA" "$SRC" >/dev/null

cd "$ROOT"
API_TAG=$SHA docker compose up -d --wait
docker image ls gardener-api --format '{{.Tag}}' | grep -vx "$SHA" | sed 's/^/gardener-api:/' | xargs -r docker image rm -f >/dev/null 2>&1 || true
echo "Deployed gardener-api:$SHA"
