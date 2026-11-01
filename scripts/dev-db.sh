#!/usr/bin/env bash
# Local development MySQL for Staffly (isolated: own data folder, own port).
#
#   scripts/dev-db.sh start    create (first time), start, and load schema + demo data
#   scripts/dev-db.sh stop     stop the server (data is kept)
#   scripts/dev-db.sh reset    wipe the data folder and start again from scratch
#   scripts/dev-db.sh status   show whether it is running
#
# It never touches a MySQL you installed as a service: it listens only on
# 127.0.0.1:3307, keeps its files in ./.devdb (git-ignored), and the root user
# has no password. Demo data only, never use this for real data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.devdb"
PORT="${DEV_DB_PORT:-3307}"
SOCK="$DIR/mysql.sock"
BASEDIR="$(brew --prefix mysql 2>/dev/null || echo /opt/homebrew)"

client() { mysql --no-defaults -uroot --protocol=TCP -h127.0.0.1 -P"$PORT" "$@"; }
running() { client -e "SELECT 1" >/dev/null 2>&1; }

start() {
  mkdir -p "$DIR"
  if [ ! -d "$DIR/data/mysql" ]; then
    echo "Creating a new data folder in .devdb ..."
    mysqld --no-defaults --initialize-insecure --datadir="$DIR/data" --basedir="$BASEDIR" >"$DIR/init.log" 2>&1
    FRESH=1
  fi
  if running; then echo "Already running on 127.0.0.1:$PORT"; else
    nohup mysqld --no-defaults --datadir="$DIR/data" --basedir="$BASEDIR" \
      --port="$PORT" --socket="$SOCK" --mysqlx=OFF --bind-address=127.0.0.1 \
      --pid-file="$DIR/mysql.pid" >"$DIR/server.log" 2>&1 &
    echo -n "Starting MySQL "
    for _ in $(seq 1 60); do running && break; echo -n "."; sleep 1; done
    echo
    running || { echo "MySQL did not start, see .devdb/server.log"; exit 1; }
  fi
  if [ "${FRESH:-0}" = "1" ] || ! client -e "USE employee_management; SELECT 1 FROM employees LIMIT 1" >/dev/null 2>&1; then
    echo "Loading schema and demo data ..."
    client < "$ROOT/database/schemas.sql"
    client employee_management < "$ROOT/database/demo_seed.sql"
  fi
  echo "Ready: DB_HOST=127.0.0.1 DB_PORT=$PORT DB_USER=root DB_PASSWORD= DB_NAME=employee_management"
}

stop() {
  if [ -f "$DIR/mysql.pid" ] && kill -0 "$(cat "$DIR/mysql.pid")" 2>/dev/null; then
    kill "$(cat "$DIR/mysql.pid")"; echo "Stopped."
  else echo "Not running."; fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  reset) stop || true; sleep 2; rm -rf "$DIR"; start ;;
  status) running && echo "Running on 127.0.0.1:$PORT" || echo "Not running" ;;
  *) echo "usage: $0 start|stop|reset|status"; exit 1 ;;
esac
