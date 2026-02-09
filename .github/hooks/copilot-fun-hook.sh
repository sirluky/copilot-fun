#!/bin/bash
INPUT=$(cat)
EVENT_TYPE="$1"
STATUS_FILE="/home/lukas/projects/fun/copilot-fun/.copilot-fun-status"

# Determine copilot state from the hook event
case "$EVENT_TYPE" in
  prompt)
    echo "working" > "$STATUS_FILE"
    ;;
  post-tool)
    echo "working" > "$STATUS_FILE"
    ;;
  session-end)
    echo "idle" > "$STATUS_FILE"
    ;;
  *)
    echo "working" > "$STATUS_FILE"
    ;;
esac
