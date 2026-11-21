#!/bin/sh
# Forced command for the GitHub Actions deploy key (in root's authorized_keys
# with command="/opt/gardener/ci-deploy.sh",no-pty,no-port-forwarding,...).
# Whatever the key asks for, the only thing it can do is: deploy <commit sha>.
set -eu

case "${SSH_ORIGINAL_COMMAND:-}" in
  "deploy "*) REF=${SSH_ORIGINAL_COMMAND#deploy } ;;
  *) echo "This key can only run: deploy <commit-sha>" >&2; exit 64 ;;
esac

echo "$REF" | grep -Eq '^[0-9a-f]{7,40}$' || { echo "Not a commit sha: $REF" >&2; exit 64; }

# Run the deploy script from the commit being deployed, not the one on disk.
git -C /opt/gardener/src fetch -q origin
git -C /opt/gardener/src checkout -q --detach "$REF"
exec sh /opt/gardener/src/deploy/api/deploy.sh "$REF"
