#!/usr/bin/env python3
import sys
import os
from pydub import AudioSegment
import speech_recognition as sr

def transcribe(audio_path):
    if not os.path.exists(audio_path):
        return f"ERROR: File not found: {audio_path}"
    
    # Generate temporary WAV file path
    wav_path = audio_path + ".wav"
    try:
        # Convert OGA/OGG/MP3 to WAV
        sound = AudioSegment.from_file(audio_path)
        sound.export(wav_path, format="wav")
        
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            
        text_ar = None
        conf_ar = 0.0
        try:
            text_ar, conf_ar = recognizer.recognize_google(audio_data, language="ar-EG", with_confidence=True)
        except Exception:
            pass

        text_en = None
        conf_en = 0.0
        try:
            text_en, conf_en = recognizer.recognize_google(audio_data, language="en-US", with_confidence=True)
        except Exception:
            pass

        # Language selection logic based on presence and confidence scores
        if text_ar and text_en:
            # If both succeeded, choose the one with higher confidence.
            # Since the environment is primarily Arabic, we give it a tiny bias unless English has higher confidence.
            if conf_en > conf_ar:
                return text_en
            else:
                return text_ar
        elif text_ar:
            return text_ar
        elif text_en:
            return text_en
        else:
            return "ERROR: Could not recognize speech in either Arabic or English."
            
    except Exception as e:
        return f"ERROR: Transcription failed: {str(e)}"
    finally:
        # Clean up temporary WAV file
        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except:
                pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: stt.py <audio_file_path>")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    result = transcribe(audio_file)
    print(result)
