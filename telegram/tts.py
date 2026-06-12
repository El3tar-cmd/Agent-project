#!/usr/bin/env python3
import sys
import os
from gtts import gTTS

def text_to_speech(text, output_path, lang='ar'):
    try:
        tts = gTTS(text=text, lang=lang, slow=False)
        tts.save(output_path)
        return True
    except Exception as e:
        sys.stderr.write(f"ERROR: {str(e)}\n")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: tts.py <text> <output_file_path> [lang]")
        sys.exit(1)
        
    text = sys.argv[1]
    # If the text argument is a file path, read from it
    if os.path.exists(text):
        try:
            with open(text, 'r', encoding='utf-8') as f:
                text = f.read()
        except:
            pass
            
    output_path = sys.argv[2]
    lang = sys.argv[3] if len(sys.argv) > 3 else 'ar'
    
    # Auto-detect language briefly (if contains Arabic characters, use 'ar', otherwise 'en')
    # Simple check: any char in range 0x0600 - 0x06FF is Arabic
    has_arabic = any('\u0600' <= char <= '\u06ff' for char in text)
    if has_arabic:
        lang = 'ar'
    else:
        lang = 'en'
        
    success = text_to_speech(text, output_path, lang)
    if success:
        print("SUCCESS")
        sys.exit(0)
    else:
        print("FAILED")
        sys.exit(1)
