#!/bin/bash
# Wrapper for the local screenshot tool using termux-chroot

URL="$1"
OUTPUT_FILE="2"
MOBILE_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mobile)
            MOBILE_MODE=true
            shift
            ;;
        *)
            if [ -z "$URL" ]; then
                URL="$1"
            elif [ -z "$OUTPUT_FILE" ]; then
                OUTPUT_FILE="$1"
            fi
            shift
            ;;
    esac
done

if [ -z "$URL" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Usage: screenshot <url> <output_path> [--mobile]"
    echo "  --mobile  : Emulate a mobile device (375x812)"
    exit 1
fi

# Build Chromium flags
CHROMIUM_FLAGS="--headless=new --no-sandbox --disable-gpu --screenshot=$OUTPUT_FILE"


if [ "$MOBILE_MODE" = true ]; then
    echo "Taking mobile screenshot..."
    CHROMIUM_FLAGS="$CHROMIUM_FLAGS --window-size=375,812 --user-agent='Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Mobile Safari/537.36'"
else
    echo "Taking desktop screenshot..."
    CHROMIUM_FLAGS="$CHROMIUM_FLAGS --window-size=1280,800"
fi

# Execute with termux-chroot
termux-chroot chromium-browser $CHROMIUM_FLAGS "$URL"
