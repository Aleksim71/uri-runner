#!/usr/bin/env bash
set -euo pipefail

URAM_ROOT="${URAM_ROOT:-$HOME/uram}"
WATCH_DIR="${WATCH_DIR:-$HOME/Загрузки}"
LOG_FILE="${LOG_FILE:-$URAM_ROOT/Inbox/watch.log}"

ONCE=0
if [[ "${1:-}" == "--once" ]]; then
  ONCE=1
fi

ts() { date -Iseconds; }

ensure_dirs() {
  mkdir -p "$URAM_ROOT/Inbox" "$URAM_ROOT/Inbox/processed"
  mkdir -p "$URAM_ROOT/patchpacks/_unknown" "$URAM_ROOT/patchpacks/tempasi" "$URAM_ROOT/patchpacks/abonasi"
}

log() { echo "[$(ts)] $*" | tee -a "$LOG_FILE"; }

zip_has() {
  local zip="$1"
  local pattern="$2"
  unzip -l "$zip" 2>/dev/null | grep -qE "$pattern"
}

zip_read_meta() {
  local zip="$1"
  local meta_path=""

  if unzip -l "$zip" 2>/dev/null | awk '{print $4}' | grep -qx "META.json"; then
    meta_path="META.json"
  else
    meta_path="$(unzip -l "$zip" 2>/dev/null | awk '{print $4}' | grep -m1 -E '/?META\.json$' || true)"
  fi

  [[ -n "$meta_path" ]] || return 1
  unzip -p "$zip" "$meta_path" 2>/dev/null || return 1
}

meta_field() {
  # meta_field <zip> <fieldName>
  local zip="$1"
  local field="$2"
  local meta=""
  meta="$(zip_read_meta "$zip" 2>/dev/null || true)"
  [[ -n "$meta" ]] || { echo ""; return 0; }

  node -e '
    try {
      const fs = require("fs");
      const input = fs.readFileSync(0, "utf8");
      const j = JSON.parse(input);
      const field = process.argv[1];
      const v = (j && typeof j[field] === "string") ? j[field].trim() : "";
      process.stdout.write(v);
    } catch (e) {
      process.stdout.write("");
    }
  ' "$field" <<<"$meta" 2>/dev/null || echo ""
}

classify_zip() {
  local zip="$1"

  # 1) Inbox marker
  if zip_has "$zip" 'RUNBOOK\.yaml$'; then
    echo "INBOX"
    return 0
  fi

  # 2) META-driven patchpack (new)
  local kind=""
  kind="$(meta_field "$zip" "kind")"
  if [[ "$kind" == "patchpack" ]]; then
    echo "PATCHPACK"
    return 0
  fi

  # 3) Heuristic patchpack markers
  if zip_has "$zip" '(^| )PATCHES/' || zip_has "$zip" '(^| )REPLACE/' || zip_has "$zip" 'APPLY\.sh$'; then
    echo "PATCHPACK"
    return 0
  fi

  echo "UNKNOWN"
}

stamp_name() { echo "$1" | sed 's/[ \/]/_/g'; }

write_last_run() {
  local result="$1"
  local inbox_path="$2"

  rm -f "$URAM_ROOT/Inbox/last_run.OK" "$URAM_ROOT/Inbox/last_run.FAIL" 2>/dev/null || true
  : > "$URAM_ROOT/Inbox/last_run.$result"

  {
    echo "time: $(ts)"
    echo "inbox: $inbox_path"
    echo "result: $result"
  } > "$URAM_ROOT/Inbox/last_run.txt"
}

process_inbox_zip() {
  local src_zip="$1"

  log "============================================================"
  log "detected ZIP → INBOX: $(basename "$src_zip")"
  log "============================================================"

  local dst="$URAM_ROOT/Inbox/inbox.zip"
  mv -f "$src_zip" "$dst"

  log "running: uri run"
  set +e
  uri run
  local rc=$?
  set -e

  if [[ $rc -eq 0 ]]; then
    log "DONE: OK"
    write_last_run "OK" "$dst"
  else
    log "DONE: FAIL (exit=$rc)"
    write_last_run "FAIL" "$dst"
  fi

  return $rc
}

move_patchpack_by_project() {
  local src_zip="$1"
  local base
  base="$(basename "$src_zip")"
  local stamped
  stamped="$(stamp_name "$base")"

  local proj=""
  proj="$(meta_field "$src_zip" "project")"

  local target_dir="$URAM_ROOT/patchpacks/_unknown"
  local label="_unknown"
  if [[ "$proj" == "tempasi" || "$proj" == "abonasi" ]]; then
    target_dir="$URAM_ROOT/patchpacks/$proj"
    label="$proj"
  fi

  mkdir -p "$target_dir"
  local dst="$target_dir/$(date +%F_%H-%M-%S)__${stamped}"

  log "--------------------------------------------"
  log "FILE DETECTED: $base"
  log "PATCHPACK project=$label → $dst"
  log "--------------------------------------------"

  mv -f "$src_zip" "$dst"
}

process_unknown_zip() {
  local src_zip="$1"
  local base
  base="$(basename "$src_zip")"
  local stamped
  stamped="$(stamp_name "$base")"
  local dst="$URAM_ROOT/patchpacks/_unknown/$(date +%F_%H-%M-%S)__${stamped}"

  log "--------------------------------------------"
  log "FILE DETECTED: $base"
  log "UNKNOWN ZIP → $dst"
  log "--------------------------------------------"

  mv -f "$src_zip" "$dst"
}

wait_until_stable() {
  local f="$1"
  local last_size="-1"
  local size="0"

  for _ in {1..30}; do
    [[ -f "$f" ]] || return 1
    size="$(stat -c%s "$f" 2>/dev/null || echo 0)"
    if [[ "$size" == "$last_size" && "$size" -gt 0 ]]; then
      return 0
    fi
    last_size="$size"
    sleep 0.3
  done
  return 0
}

main() {
  ensure_dirs
  touch "$LOG_FILE"

  log "watch started (URAM_ROOT=$URAM_ROOT)"
  log "Watching: $WATCH_DIR"
  echo

  while true; do
    local found=""
    found="$(find "$WATCH_DIR" -maxdepth 1 -type f -name "*.zip" -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -n 1 | awk '{print $2}')"

    if [[ -n "${found:-}" && -f "$found" ]]; then
      wait_until_stable "$found" || true

      if [[ -f "$found" ]]; then
        local kind
        kind="$(classify_zip "$found" || echo "UNKNOWN")"

        if [[ "$kind" == "INBOX" ]]; then
          process_inbox_zip "$found" || true
        elif [[ "$kind" == "PATCHPACK" ]]; then
          move_patchpack_by_project "$found" || true
        else
          process_unknown_zip "$found" || true
        fi

        if [[ $ONCE -eq 1 ]]; then
          log "watch --once: done, exiting"
          exit 0
        fi
      fi
    fi

    sleep 0.5
  done
}

main "$@"
