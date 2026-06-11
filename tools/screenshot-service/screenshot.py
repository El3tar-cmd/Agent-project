import os
import sys
import requests
import argparse
from pathlib import Path

# Default configuration
# In a real production environment, these would be environment variables
REMOTE_BROWSER_URL = os.getenv('REMOTE_BROWSER_URL', 'https://chrome.browserless.io/screenshot')
API_KEY = os.getenv('REMOTE_BROWSER_KEY', '')

def take_screenshot(url, output_path, width=1280, height=800):
    """
    Takes a screenshot of a URL using a remote headless browser service
    to bypass local environment restrictions (like Termux namespace issues).
    """
    print(f"Taking screenshot of {url}...")
    
    # Payload for Browserless.io or similar services
    payload = {
        "url": url,
        "options": {
            "fullPage": False,
            "type": "png",
            "viewport": {
                "width": width,
                "height": height
            }
        }
    }
    
    # Add API key to headers if provided
    headers = {}
    if API_KEY:
        headers['Authorization'] = f'Bearer {API_KEY}'

    try:
        response = requests.post(REMOTE_BROWSER_URL, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            # Ensure output directory exists
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'wb') as f:
                f.write(response.content)
            print(f"Screenshot saved successfully to {output_path}")
            return True
        else:
            print(f"Error from screenshot service: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"An error occurred while taking the screenshot: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Remote Screenshot Tool for Termux")
    parser.add_argument("url", help="The URL to take a screenshot of")
    parser.add_argument("output", help="The output path for the image file")
    parser.add_argument("--width", type=int, default=1280, help="Viewport width (default: 1280)")
    parser.add_argument("--height", type=int, default=800, help="Viewport height (default: 800)")
    
    args = parser.parse_args()
    
    success = take_screenshot(args.url, args.output, args.width, args.height)
    sys.exit(0 if success else 1)
