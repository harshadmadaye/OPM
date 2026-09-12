#!/bin/sh
# Start, stop or inspect a detached local dev process for a project.
#   dev-server.sh start --project <dir> --name <name> [--url <http://localhost:PORT>] -- <command...>
#   dev-server.sh stop  --project <dir> --name <name>
#   dev-server.sh status --project <dir>
# Logs: <dir>/.opm/<name>.log   Pid: <dir>/.opm/<name>.pid   Url: <dir>/.opm/<name>.url
set -eu

READY_TIMEOUT_SECONDS=90
POLL_INTERVAL_SECONDS=2

usage() { sed -n '2,6p' "$0" >&2; exit 1; }

ACTION="${1:-}"; [ -n "$ACTION" ] || usage; shift
PROJECT=""; NAME=""; URL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --url) URL="$2"; shift 2 ;;
    --) shift; break ;;
    *) echo "unknown option: $1" >&2; usage ;;
  esac
done
[ -n "$PROJECT" ] && [ -d "$PROJECT" ] || { echo "--project must be an existing directory" >&2; exit 1; }
PROJECT="$(cd "$PROJECT" && pwd)"
STATE_DIR="$PROJECT/.opm"
mkdir -p "$STATE_DIR"
if [ -f "$PROJECT/.gitignore" ] && ! grep -qx '.opm/' "$PROJECT/.gitignore"; then
  printf '\n.opm/\n' >> "$PROJECT/.gitignore"
fi

pid_alive() { kill -0 "$1" 2>/dev/null; }

case "$ACTION" in
  start)
    [ -n "$NAME" ] || { echo "--name is required" >&2; exit 1; }
    [ $# -gt 0 ] || { echo "command after -- is required" >&2; exit 1; }
    PID_FILE="$STATE_DIR/$NAME.pid"; LOG_FILE="$STATE_DIR/$NAME.log"
    if [ -f "$PID_FILE" ] && pid_alive "$(cat "$PID_FILE")"; then
      echo "ALREADY_RUNNING ${URL:-pid $(cat "$PID_FILE")}"; exit 0
    fi
    : > "$LOG_FILE"
    printf '%s\n' "$URL" > "$STATE_DIR/$NAME.url"
    cd "$PROJECT"
    nohup "$@" > "$LOG_FILE" 2>&1 < /dev/null &
    PID=$!
    echo "$PID" > "$PID_FILE"
    echo "STARTED pid=$PID log=$LOG_FILE"
    [ -n "$URL" ] || exit 0
    waited=0
    while [ "$waited" -lt "$READY_TIMEOUT_SECONDS" ]; do
      if curl -s -o /dev/null --max-time 2 "$URL"; then echo "READY $URL"; exit 0; fi
      pid_alive "$PID" || { echo "EXITED before ready; last log lines:"; tail -20 "$LOG_FILE"; exit 1; }
      sleep "$POLL_INTERVAL_SECONDS"; waited=$((waited + POLL_INTERVAL_SECONDS))
    done
    echo "TIMEOUT after ${READY_TIMEOUT_SECONDS}s waiting for $URL; last log lines:"; tail -20 "$LOG_FILE"; exit 1 ;;
  stop)
    [ -n "$NAME" ] || { echo "--name is required" >&2; exit 1; }
    PID_FILE="$STATE_DIR/$NAME.pid"
    [ -f "$PID_FILE" ] || { echo "NOT_RUNNING $NAME"; exit 0; }
    PID="$(cat "$PID_FILE")"
    if pid_alive "$PID"; then
      pkill -TERM -P "$PID" 2>/dev/null || true
      kill -TERM "$PID" 2>/dev/null || true
      sleep 1
      pid_alive "$PID" && kill -KILL "$PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"; echo "STOPPED $NAME" ;;
  status)
    found=0
    for f in "$STATE_DIR"/*.pid; do
      [ -f "$f" ] || continue; found=1
      n="$(basename "$f" .pid)"; p="$(cat "$f")"; u="$(cat "$STATE_DIR/$n.url" 2>/dev/null || true)"
      if pid_alive "$p"; then echo "$n alive pid=$p ${u:+url=$u}"; else echo "$n dead pid=$p"; fi
    done
    [ "$found" -eq 1 ] || echo "no processes recorded in $STATE_DIR" ;;
  *) usage ;;
esac
