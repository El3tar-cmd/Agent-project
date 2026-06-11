# Remote Screenshot Tool

## Overview
This tool replaces the local `chromium-browser` screenshot method which fails in Termux due to Android namespace restrictions (`CANNOT LINK EXECUTABLE /proc/self/exe`). It uses a remote headless browser service to render pages and return a screenshot.

## Installation
1. The tool is located at `/data/data/com.termux/files/home/agent-project/agent-project/tools/screenshot-service/`.
2. Use the wrapper script: `./screenshot-cli.sh <url> <output_path>`.

## Configuration
To make the tool functional, you need a remote browser service (e.g., Browserless.io).

Set the following environment variables:
- `REMOTE_BROWSER_URL`: The endpoint of your screenshot service (Default: `https://chrome.browserless.io/screenshot`).
- `REMOTE_BROWSER_KEY`: Your API key for the service.

Example:
```bash
export REMOTE_BROWSER_KEY="your_api_key_here"
/data/data/com.termux/files/home/agent-project/agent-project/tools/screenshot-service/screenshot-cli.sh http://localhost:5173 .screenshots/test.png
```

## Why this method?
Local Chromium in Termux cannot spawn child processes (like the network service) because the Android linker prevents access to the executable in the `/proc/self/exe` namespace. By moving the rendering to a remote server, we eliminate this environment-level failure.