#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# URAM Watcher
# - Watches downloads folder for "inbox.zip"
# - If META.json is missing -> DO NOTHING (leave file in Downloads)
# - If META.json exists but broken -> still process, mark BROKEN META
# - If META.json valid -> process and show project + kind
# - Moves processed inbox.zip into ~/uram/Inbox/inbox.zip (single entrypoint)
# - Does NOT touch any other files (only exact name: inbox.zip)
#
# Usage:
#   watch-inbox.sh                # continuous watch
#   watch-inbox.sh --once         # process at most one file then exit
#   watch-inbox.sh --dir <path>   # watch custom directory
# ============================================================

ts() { date -Iseconds | sed 's/+.*$//'; }
log() { echo "[$(ts)] $*"; }

ONCE=0
WATCH_DIR="${HOME}/Загрузки"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once) ONCE=1; shift ;;
    --dir)  WATCH_DIR="${2:-}"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

URAM_ROOT="${URAM_ROOT:-${HOME}/uram}"
URAM_INBOX="${URAM_ROOT}/Inbox"
URAM_PROCESSED="${URAM_INBOX}/processed"
LOCK_FILE="${URAM_INBOX}/.watch.lock"
WATCH_LOG="${URAM_INBOX}/watch.log"

mkdir -p "${URAM_INBOX}" "${URAM_PROCESSED}"

append_watch_log() {
  echo "[$(ts)] $*" >> "${WATCH_LOG}" || true
}

# ---- helper: check zip contains META.json
zip_has_meta() {
  local zip="$1"
  unzip -l "$zip" 2>/dev/null | awk '{print $4}' | grep -qx "META.json"
}

# ---- helper: read JSON field via node (safe)
json_field() {
  local file="$1"
  local key="$2"
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const k=process.argv[2];process.stdout.write(String(j?.[k] ?? ''))" "$file" "$key" 2>/dev/null || true
}

# ---- helper: basic META validation (no zod, minimal)
validate_meta_minimal() {
  local file="$1"
  node -e '
    const fs=require("fs");
    const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const errs=[];
    if (!m || typeof m!=="object") errs.push("META must be an object");
    if (m.version !== 1) errs.push("version must be 1");
    if (!m.kind || typeof m.kind!=="string") errs.push("kind is required");
    if (!m.project || typeof m.project!=="string") errs.push("project is required");
    if (errs.length){ console.error(errs.join("; ")); process.exit(10); }
  ' "$file" 2>/dev/null
}

# ---- helper: place last run marker in URAM/Inbox
mark_last_run() {
  local result="$1" # OK / FAIL
  : > "${URAM_INBOX}/last_run.${result}" || true
  cat > "${URAM_INBOX}/last_run.txt" <<EOF
time: $(ts)
watch_dir: ${WATCH_DIR}
file: ${WATCH_DIR}/inbox.zip
result: ${result}
EOF
}

# ---- helper: safely move downloads/inbox.zip into URAM Inbox entrypoint
stage_inbox_into_uram() {
  local src_zip="$1" # downloads/inbox.zip
  local dst_zip="${URAM_INBOX}/inbox.zip"

  # If dst exists, archive it into processed with timestamp (so we never overwrite silently)
  if [[ -f "${dst_zip}" ]]; then
    local bak="${URAM_PROCESSED}/$(date +%F_%H-%M-%S)__prev.inbox.zip"
    mv -f "${dst_zip}" "${bak}" || true
  fi

  mv -f "${src_zip}" "${dst_zip}"
}

# ---- main processor for one detected inbox.zip
process_one() {
  local src_zip="${WATCH_DIR}/inbox.zip"
  [[ -f "${src_zip}" ]] || return 0

  log "--------------------------------------------"
  log "FILE DETECTED: inbox.zip"
  log "--------------------------------------------"
  append_watch_log "FILE DETECTED: inbox.zip"

  # Quick sanity: is it a readable zip?
  if ! unzip -tq "${src_zip}" >/dev/null 2>&1; then
    log "BROKEN ZIP (cannot unzip) -> leaving in Downloads (no action)"
    append_watch_log "BROKEN ZIP -> ignored"
    mark_last_run "FAIL"
    return 0
  fi

  # Rule #1: if META.json missing -> do NOT touch
  if ! zip_has_meta "${src_zip}"; then
    log "NO META.json -> leaving in Downloads (ignored)"
    append_watch_log "NO META -> ignored"
    # no last_run marker here: it was intentionally ignored
    return 0
  fi

  # Extract META.json to temp
  local run_id
  run_id="$(date +%FT%H-%M-%S)__$RANDOM"
  local tmp_dir="/tmp/uram_watch_${run_id}"
  mkdir -p "${tmp_dir}"
  unzip -q "${src_zip}" META.json -d "${tmp_dir}" >/dev/null 2>&1 || true

  local meta_file="${tmp_dir}/META.json"
  local project="_unknown"
  local kind="unknown"
  local meta_ok=1

  if [[ ! -f "${meta_file}" ]]; then
    meta_ok=0
  else
    if validate_meta_minimal "${meta_file}" >/dev/null 2>&1; then
      meta_ok=1
      project="$(json_field "${meta_file}" "project")"
      kind="$(json_field "${meta_file}" "kind")"
      [[ -n "${project}" ]] || project="_unknown"
      [[ -n "${kind}" ]] || kind="unknown"
    else
      meta_ok=0
      # best-effort parse if JSON is at least parseable
      project="$(json_field "${meta_file}" "project")"
      kind="$(json_field "${meta_file}" "kind")"
      [[ -n "${project}" ]] || project="_unknown"
      [[ -n "${kind}" ]] || kind="unknown"
    fi
  fi

  if [[ "${meta_ok}" -eq 1 ]]; then
    log "META: OK project=${project} kind=${kind}"
    append_watch_log "META OK project=${project} kind=${kind}"
  else
    log "META: BROKEN -> project=${project} kind=${kind} (will still process)"
    append_watch_log "META BROKEN project=${project} kind=${kind}"
  fi

  # Stage into URAM Inbox entrypoint (single inbox.zip)
  stage_inbox_into_uram "${src_zip}"

  log "STAGED -> ${URAM_INBOX}/inbox.zip"
  append_watch_log "STAGED -> ${URAM_INBOX}/inbox.zip"

  # NOTE:
  # Here we only stage. Actual execution is done by you running watcher + URI.
  # If you want FULL AUTO execution later, we can add:
  #   - kind=info => uri run
  #   - kind=patch => cd <project> && uri patch ...
  #
  # For now: minimal, safe behavior.

  mark_last_run "OK"
  rm -rf "${tmp_dir}" >/dev/null 2>&1 || true
  return 0
}

# ---- loop impls
watch_loop_inotify() {
  log "watch started (URAM_ROOT=${URAM_ROOT})"
  log "Watching: ${WATCH_DIR}"
  append_watch_log "watch started (inotify) dir=${WATCH_DIR}"

  while true; do
    # Wait for create/move-close of inbox.zip only
    inotifywait -q -e close_write,create,moved_to --format '%f' "${WATCH_DIR}" 2>/dev/null | while read -r fname; do
      if [[ "${fname}" == "inbox.zip" ]]; then
        (
          flock -n 9 || exit 0
          process_one
        ) 9>"${LOCK_FILE}"
        if [[ "${ONCE}" -eq 1 ]]; then
          log "watch --once: done, exiting"
          append_watch_log "watch --once exit"
          exit 0
        fi
      fi
    done
  done
}

watch_loop_poll() {
  log "watch started (URAM_ROOT=${URAM_ROOT})"
  log "Watching: ${WATCH_DIR}"
  log "inotifywait not found -> using polling mode (1s)"
  append_watch_log "watch started (poll) dir=${WATCH_DIR}"

  while true; do
    if [[ -f "${WATCH_DIR}/inbox.zip" ]]; then
      (
        flock -n 9 || exit 0
        process_one
      ) 9>"${LOCK_FILE}"

      if [[ "${ONCE}" -eq 1 ]]; then
        log "watch --once: done, exiting"
        append_watch_log "watch --once exit"
        exit 0
      fi
    fi
    sleep 1
  done
}

# Choose strategy
if command -v inotifywait >/dev/null 2>&1; then
  watch_loop_inotify
else
  watch_loop_poll
fi
