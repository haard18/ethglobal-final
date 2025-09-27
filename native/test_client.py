#!/usr/bin/env python3
"""
Test client for API Emotional Display
Demonstrates how to send text and emotions to the display
"""

import requests
import json
import time

API_BASE_URL = "http://localhost:5000"

def send_text(text, emotion="normal", duration=10):
    """Send text with emotion to the display."""
    url = f"{API_BASE_URL}/display"
    payload = {
        "text": text,
        "emotion": emotion,
        "duration": duration
    }
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success: Showing '{result['text']}' with emotion '{result['emotion']}' for {result['duration']}s")
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to API server. Is it running?")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def get_emotions():
    """Get available emotions from the API."""
    url = f"{API_BASE_URL}/emotions"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            result = response.json()
            print(f"📋 Available emotions: {', '.join(result['emotions'])}")
            print(f"🎭 Current emotion: {result['current_emotion']}")
            print(f"📺 Display mode: {result['display_mode']}")
            return result['emotions']
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"❌ Error: {e}")
        return []

def get_status():
    """Get current display status."""
    url = f"{API_BASE_URL}/status"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            result = response.json()
            print("📊 Current Status:")
            print(f"   Mode: {result['display_mode']}")
            print(f"   Emotion: {result['current_emotion']}")
            if result['current_text']:
                print(f"   Text: '{result['current_text']}'")
            if result['text_display_until']:
                print(f"   Display until: {result['text_display_until']}")
            return result
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def demo_sequence():
    """Run a demonstration sequence of different emotions and texts."""
    print("🎬 Running demonstration sequence...")
    print("Make sure the API server is running first!")
    print()
    
    # Get available emotions
    emotions = get_emotions()
    if not emotions:
        return
    
    print()
    
    # Demo different emotions with texts
    demo_messages = [
        ("Hello! I'm your emotional display!", "happy", 5),
        ("This is exciting stuff!", "excited", 4),
        ("Hmm, let me think about this...", "confused", 6),
        ("I'm feeling a bit sleepy now", "sleepy", 5),
        ("Wait, what was that?!", "surprised", 4),
        ("Grr, I don't like bugs!", "angry", 5),
        ("That makes me sad...", "sad", 4),
        ("I'm up to something mischievous...", "mischievous", 6),
        ("Just looking around...", "sideeye", 4),
        ("Back to normal mode now!", "normal", 3)
    ]
    
    for text, emotion, duration in demo_messages:
        print(f"📤 Sending: '{text}' ({emotion})")
        if send_text(text, emotion, duration):
            time.sleep(duration + 1)  # Wait for display + 1 second
        else:
            print("Failed to send message, stopping demo")
            break
    
    print("🎬 Demo complete! Display should return to eyes mode.")

def interactive_mode():
    """Interactive mode for manual testing."""
    print("🎮 Interactive Mode")
    print("Type 'help' for commands, 'quit' to exit")
    print()
    
    while True:
        try:
            command = input(">>> ").strip()
            
            if command.lower() in ['quit', 'exit', 'q']:
                break
            elif command.lower() == 'help':
                print("Commands:")
                print("  send <text> [emotion] [duration] - Send text to display")
                print("  emotions - List available emotions")
                print("  status - Show current status")
                print("  demo - Run demonstration sequence")
                print("  quit - Exit interactive mode")
            elif command.lower() == 'emotions':
                get_emotions()
            elif command.lower() == 'status':
                get_status()
            elif command.lower() == 'demo':
                demo_sequence()
            elif command.startswith('send '):
                parts = command[5:].split(' ', 2)
                if len(parts) >= 1:
                    text = parts[0] if len(parts) == 1 else ' '.join(parts[:-2]) if len(parts) > 2 else parts[0]
                    emotion = parts[1] if len(parts) >= 2 else "normal"
                    duration = int(parts[2]) if len(parts) >= 3 and parts[2].isdigit() else 10
                    
                    # If we have quotes, try to parse properly
                    if '"' in command or "'" in command:
                        # Simple quote parsing
                        if '"' in command:
                            parts = command.split('"')
                            if len(parts) >= 2:
                                text = parts[1]
                        elif "'" in command:
                            parts = command.split("'")
                            if len(parts) >= 2:
                                text = parts[1]
                    
                    send_text(text, emotion, duration)
                else:
                    print("Usage: send <text> [emotion] [duration]")
            else:
                print(f"Unknown command: {command}. Type 'help' for available commands.")
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")

def main():
    """Main function with menu options."""
    print("🎭 API Emotional Display Test Client")
    print("====================================")
    print()
    print("Options:")
    print("1. Run demonstration sequence")
    print("2. Interactive mode")
    print("3. Check status")
    print("4. List emotions")
    print("5. Exit")
    print()
    
    while True:
        try:
            choice = input("Choose an option (1-5): ").strip()
            
            if choice == '1':
                demo_sequence()
            elif choice == '2':
                interactive_mode()
            elif choice == '3':
                get_status()
            elif choice == '4':
                get_emotions()
            elif choice == '5':
                print("👋 Goodbye!")
                break
            else:
                print("Invalid choice. Please select 1-5.")
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break

if __name__ == "__main__":
    main()