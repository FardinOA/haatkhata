#!/bin/sh
# Writes the schedule with the secret filled in (busybox crond doesn't pass env to jobs), then runs crond.
set -eu
apk add --no-cache curl >/dev/null
call='curl -fsS -m 300 -o /dev/null -H "Authorization: Bearer '"$CRON_SECRET"'"'
cat > /etc/crontabs/root <<EOF
* * * * *    $call "http://app:3000/api/cron/daily?job=webhooks"
0 * * * *    $call "http://app:3000/api/cron/daily?job=summary"
*/20 * * * * $call "http://app:3000/api/cron/courier-sync"
30 21 * * *  $call -X POST "http://app:3000/api/billing/cron"
EOF
exec crond -f -l 8
