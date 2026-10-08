#!/usr/bin/env bash
# Encrypted, deduplicated backup of World Country Groups to Wasabi (S3-compatible) with restic.
#
# Settings live in ~/.config/wcg-backup/env (chmod 600), see scripts/backup_wasabi.env.example.
# Usage:
#   scripts/backup_wasabi.sh            # back up and apply retention
#   scripts/backup_wasabi.sh init       # create the repository (first time only)
#   scripts/backup_wasabi.sh snapshots  # list backups
#   scripts/backup_wasabi.sh restore <snapshot|latest> <target-dir>
set -euo pipefail

ENV_FILE="${WCG_BACKUP_ENV:-$HOME/.config/wcg-backup/env}"
PROJECT=/home/exedev/worldcountrygroups
STAGE="$HOME/.cache/wcg-backup/system"

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE (see scripts/backup_wasabi.env.example)"; exit 1; }
set -a; . "$ENV_FILE"; set +a
: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"

case "${1:-backup}" in
  init)      exec restic init ;;
  snapshots) exec restic snapshots ;;
  restore)   exec restic restore "${2:?snapshot id or latest}" --target "${3:?target dir}" ;;
  backup)    ;;
  *) echo "unknown command: $1"; exit 2 ;;
esac

# System config needed to rebuild the server (not inside the project folder)
mkdir -p "$STAGE"
cp /etc/systemd/system/worldcountrygroups.service "$STAGE/" 2>/dev/null || true
cp /etc/nginx/sites-available/default "$STAGE/nginx-default" 2>/dev/null || true
sudo -n crontab -l > "$STAGE/root-crontab" 2>/dev/null || true

rc=0
restic backup --tag wcg --one-file-system \
  --exclude "$PROJECT/site/node_modules" \
  --exclude "$PROJECT/site/.output" \
  --exclude "$PROJECT/site/.nuxt" \
  --exclude "**/__pycache__" \
  --exclude "**/*.tmp" \
  "$PROJECT" "$STAGE" || rc=$?
# exit code 3: the snapshot was saved but some files could not be read; carry on, and say so
if [ "$rc" -ne 0 ] && [ "$rc" -ne 3 ]; then exit "$rc"; fi
[ "$rc" -eq 3 ] && echo "Warning: snapshot saved, but some files could not be read (see above)"

# Keep 7 daily, 4 weekly and 12 monthly snapshots
restic forget --tag wcg --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
restic check --read-data-subset=1%
echo "Backup finished $(date -Is)"
