#!/usr/bin/env python3
"""
API Server for OLED Display with Eyes and Text
Displays eyes constantly, shows text + emotion when API called
"""

import time
import random
import threading
import math
from flask import Flask, request, jsonify
from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import sh1106
from datetime import datetime, timedelta
import textwrap

app = Flask(__name__)

class APIEmotionalDisplay:
    def __init__(self, device):
        self.device = device
        self.width = device.width
        self.height = device.height

        # Display modes
        self.display_mode = "eyes"  # "eyes" or "text"
        self.text_display_until = None
        self.current_text = ""
        self.current_emotion = "normal"

        # Base eye properties
        self.base_eye_width = 20
        self.base_eye_height = 40
        self.eye_spacing = 20

        # Current eye state (for interpolation)
        self.current_state = {
            'width': float(self.base_eye_width),
            'height': float(self.base_eye_height),
            'offset_y': 0.0,
            'pupil_offset_x': 0.0,
            'pupil_offset_y': 0.0,
            'emotion': "normal"
        }

        # Target state (what we're animating towards)
        self.target_state = self.current_state.copy()

        # Positions
        self.left_eye_x = self.width // 2 - self.base_eye_width - self.eye_spacing // 2
        self.right_eye_x = self.width // 2 + self.eye_spacing // 2
        self.base_eye_y = self.height // 2 - self.base_eye_height // 2

        # Animation control
        self.running = True
        self.frame_rate = 30  # Target FPS
        self.frame_time = 1.0 / self.frame_rate
        
        # Interpolation speed (0-1, higher = faster transitions)
        self.lerp_speed = 0.15
        
        # Blink state
        self.is_blinking = False
        self.blink_progress = 0.0
        self.blink_speed = 0.3

        # wave state
        self.wave_phase = 0.0   # NEW
        self.wave_speed = 0.3   # NEW

        # Thread safety
        self.state_lock = threading.Lock()

        # Emotions with smooth parameters
        self.emotions = {
            "normal": {'width': 20, 'height': 40, 'offset_y': 0},
            "happy": {'width': 20, 'height': 28, 'offset_y': 5},
            "angry": {'width': 24, 'height': 24, 'offset_y': 0},
            "surprised": {'width': 30, 'height': 52, 'offset_y': -5},
            "sleepy": {'width': 20, 'height': 12, 'offset_y': 10},
            "confused": {'width': 16, 'height': 40, 'offset_y': 0},
            "excited": {'width': 26, 'height': 48, 'offset_y': -3},
            "grumpy": {'width': 18, 'height': 20, 'offset_y': 5},
            "sad": {'width': 20, 'height': 44, 'offset_y': 3},
            "mischievous": {'width': 14, 'height': 32, 'offset_y': 2},
            "sideeye": {'width': 20, 'height': 40, 'offset_y': 0},
            "wave" : {'width': 20, 'height': 40, 'offset_y': 0}
        }

    def draw_wave(self, draw):
        """Draw a compressed, randomized waveform (voice memo style)."""
        mid_y = self.height // 2
        bar_width = 4           # width of each bar
        spacing = 2             # space between bars
        num_bars = self.width // (bar_width + spacing)

        for i in range(num_bars):
            # Random bar height for "listening energy"
            bar_height = random.randint(4, self.height // 2)
            top_y = mid_y - bar_height // 2
            bottom_y = mid_y + bar_height // 2
            x = i * (bar_width + spacing)

            draw.rectangle([x, top_y, x + bar_width, bottom_y], fill="white")



    def show_text_with_emotion(self, text, emotion="normal", duration=10):
        """API method to show text with emotion for specified duration."""
        with self.state_lock:
            self.current_text = text
            self.current_emotion = emotion
            self.display_mode = "text"
            self.text_display_until = datetime.now() + timedelta(seconds=duration)
            self.set_emotion(emotion)
        
        print(f"📝 Showing text: '{text}' with emotion: {emotion} for {duration}s")

    def lerp(self, start, end, t):
        """Linear interpolation between start and end by factor t."""
        return start + (end - start) * t

    def ease_in_out(self, t):
        """Smooth easing function for more natural animations."""
        return t * t * (3.0 - 2.0 * t)

    def update_state(self):
        """Smoothly interpolate current state towards target state."""
        # Check if we should switch back to eyes mode
        with self.state_lock:
            if self.display_mode == "text" and self.text_display_until:
                if datetime.now() >= self.text_display_until:
                    self.display_mode = "eyes"
                    self.text_display_until = None
                    # Keep the current emotion instead of resetting to normal
                    print(f"👀 Switching back to eyes mode with emotion: {self.current_emotion}")

        # Calculate interpolation factor with easing
        base_lerp = self.lerp_speed
        if self.is_blinking:
            base_lerp = self.blink_speed
        
        # Smooth interpolation for all properties
        self.current_state['width'] = self.lerp(
            self.current_state['width'], 
            self.target_state['width'], 
            base_lerp
        )
        self.current_state['height'] = self.lerp(
            self.current_state['height'], 
            self.target_state['height'], 
            base_lerp
        )
        self.current_state['offset_y'] = self.lerp(
            self.current_state['offset_y'], 
            self.target_state['offset_y'], 
            base_lerp
        )
        self.current_state['pupil_offset_x'] = self.lerp(
            self.current_state['pupil_offset_x'], 
            self.target_state['pupil_offset_x'], 
            base_lerp
        )
        self.current_state['pupil_offset_y'] = self.lerp(
            self.current_state['pupil_offset_y'], 
            self.target_state['pupil_offset_y'], 
            base_lerp
        )

        # Handle blinking animation
        if self.is_blinking:
            self.blink_progress += self.blink_speed
            if self.blink_progress >= 1.0:
                self.blink_progress = 1.0
                self.is_blinking = False
            
            # Create blink curve (goes down then up)
            blink_curve = 1.0 - abs(2.0 * self.blink_progress - 1.0)
            blink_factor = self.ease_in_out(blink_curve)
            
            # Apply blink to height
            min_height = 4
            base_height = self.target_state['height']
            self.current_state['height'] = self.lerp(min_height, base_height, blink_factor)

    def draw_eye(self, draw, x, y, w, h):
        """Draw one rounded-rectangle eye with proper bounds checking."""
        w = max(4, int(w))
        h = max(2, int(h))
        
        # Ensure coordinates are within bounds
        x = max(0, min(x, self.width - w))
        y = max(0, min(y, self.height - h))
        
        radius = min(w // 2, h // 2, 8)
        
        # Draw eye outline
        draw.rectangle([x, y, x + w, y + h], fill="black", outline="white")
        
        # Draw rounded corners if space allows
        if h > 2 * radius and radius > 2:
            draw.ellipse([x, y, x + w, y + 2 * radius], fill="white")
            draw.ellipse([x, y + h - 2 * radius, x + w, y + h], fill="white")
            draw.rectangle([x, y + radius, x + w, y + h - radius], fill="white")
        else:
            draw.rectangle([x + 1, y + 1, x + w - 1, y + h - 1], fill="white")

    def draw_pupil(self, draw, x, y, w, h, offset_x=0, offset_y=0):
        """Draw pupil inside eye with offset and bounds checking."""
        w = max(4, int(w))
        h = max(2, int(h))
        
        pupil_w = max(3, w // 3)
        pupil_h = max(3, h // 3)
        
        # Calculate pupil position with offset
        px = int(x + w // 2 - pupil_w // 2 + offset_x)
        py = int(y + h // 2 - pupil_h // 2 + offset_y)
        
        # Keep pupil within eye bounds
        px = max(x + 1, min(px, x + w - pupil_w - 1))
        py = max(y + 1, min(py, y + h - pupil_h - 1))
        
        draw.ellipse([px, py, px + pupil_w, py + pupil_h], fill="black")

    def draw_eyebrow(self, draw, x, y, w, emotion, is_left=True):
        """Draw eyebrow above eye based on emotion."""
        brow_y = max(0, y - 8)
        w = max(4, int(w))
        
        try:
            if emotion == "angry":
                if is_left:
                    draw.line([x, brow_y, x + w, brow_y - 4], fill="white", width=2)
                else:
                    draw.line([x, brow_y - 4, x + w, brow_y], fill="white", width=2)
            elif emotion == "surprised":
                if brow_y >= 5:
                    draw.arc([x - 2, brow_y - 5, x + w + 2, brow_y + 3], 0, 180, fill="white", width=2)
            elif emotion == "sad":
                if is_left:
                    draw.line([x, brow_y - 2, x + w, brow_y + 2], fill="white", width=2)
                else:
                    draw.line([x, brow_y + 2, x + w, brow_y - 2], fill="white", width=2)
            elif emotion == "grumpy":
                if is_left:
                    draw.line([x, brow_y + 2, x + w, brow_y - 6], fill="white", width=3)
                else:
                    draw.line([x, brow_y - 6, x + w, brow_y + 2], fill="white", width=3)
        except:
            pass  # Skip drawing if coordinates are invalid

    def draw_text(self, draw, text, emotion):
        """Draw text on the display with word wrapping."""
        try:
            # Use a reasonable font size for the display
            from PIL import ImageFont
            try:
                # Try different font paths for different systems
                font_paths = [
                    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",  # Linux
                    "/System/Library/Fonts/Arial.ttf",  # macOS
                    "/Windows/Fonts/arial.ttf",  # Windows
                ]
                font = None
                for font_path in font_paths:
                    try:
                        font = ImageFont.truetype(font_path, 14)  # Increased from 10 to 14
                        break
                    except:
                        continue
                
                if font is None:
                    font = ImageFont.load_default()
            except:
                font = ImageFont.load_default()
        except:
            font = None

        # Word wrap the text
        char_width = 8  # Increased from 6 to 8 for bigger font
        max_chars_per_line = self.width // char_width
        wrapped_text = textwrap.fill(text, width=max_chars_per_line)
        lines = wrapped_text.split('\n')
        
        # Calculate text positioning
        line_height = 16  # Increased from 12 to 16 for bigger font
        total_text_height = len(lines) * line_height
        start_y = max(20, (self.height - total_text_height) // 2)  # Leave more space at top
        
        # Draw emotion indicator at top (without emoji to avoid encoding issues)
        emotion_text = f"[{emotion.upper()}]"
        try:
            draw.text((2, 2), emotion_text, fill="white", font=font)
        except (UnicodeEncodeError, UnicodeDecodeError):
            # Fallback without special characters
            draw.text((2, 2), emotion.upper(), fill="white", font=font)
        
        # Draw main text
        for i, line in enumerate(lines):
            if start_y + i * line_height < self.height - line_height:
                try:
                    draw.text((2, start_y + i * line_height), line, fill="white", font=font)
                except (UnicodeEncodeError, UnicodeDecodeError):
                    # Fallback: filter out problematic characters
                    safe_line = ''.join(char for char in line if ord(char) < 256)
                    draw.text((2, start_y + i * line_height), safe_line, fill="white", font=font)

    def set_emotion(self, emotion):
        """Set target emotion for smooth transition."""
        if emotion in self.emotions:
            params = self.emotions[emotion]
            self.target_state['width'] = params['width']
            self.target_state['height'] = params['height']
            self.target_state['offset_y'] = params['offset_y']
            self.target_state['emotion'] = emotion
            
            # Special handling for sideeye
            if emotion == "sideeye":
                self.target_state['pupil_offset_x'] = params['width'] // 4
            else:
                self.target_state['pupil_offset_x'] = 0
                self.target_state['pupil_offset_y'] = 0

    def start_blink(self):
        """Initiate a smooth blink animation."""
        if not self.is_blinking:
            self.is_blinking = True
            self.blink_progress = 0.0

    def render_frame(self):
        """Render one frame of the animation."""
        with canvas(self.device) as draw:
            with self.state_lock:
                current_mode = self.display_mode
                current_text = self.current_text
                current_emotion = self.current_emotion

            if current_mode == "text":
                # Draw text mode
                self.draw_text(draw, current_text, current_emotion)
            elif current_emotion == "wave":
                self.draw_wave(draw)
            else:
                # Draw eyes mode
                # Calculate current eye positions and sizes
                eye_y = int(self.base_eye_y + self.current_state['offset_y'])
                current_width = int(self.current_state['width'])
                current_height = int(self.current_state['height'])
                
                left_x = self.width // 2 - current_width - self.eye_spacing // 2
                right_x = self.width // 2 + self.eye_spacing // 2
                
                # Draw eyebrows for certain emotions
                emotion = self.target_state['emotion']
                if emotion in ["angry", "surprised", "sad", "grumpy"]:
                    self.draw_eyebrow(draw, left_x, eye_y, current_width, emotion, True)
                    self.draw_eyebrow(draw, right_x, eye_y, current_width, emotion, False)
                
                # Draw eyes
                self.draw_eye(draw, left_x, eye_y, current_width, current_height)
                self.draw_eye(draw, right_x, eye_y, current_width, current_height)
                
                # Draw pupils
                pupil_offset_x = self.current_state['pupil_offset_x']
                pupil_offset_y = self.current_state['pupil_offset_y']
                
                self.draw_pupil(draw, left_x, eye_y, current_width, current_height, 
                              pupil_offset_x, pupil_offset_y)
                self.draw_pupil(draw, right_x, eye_y, current_width, current_height, 
                              pupil_offset_x, pupil_offset_y)

    def emotion_controller(self):
        """Background thread for controlling emotion changes (only in eyes mode)."""
        emotion_list = list(self.emotions.keys())
        emotion_list.remove("sideeye")  # Handle separately
        
        while self.running:
            sleep_time = random.uniform(4, 8)
            time.sleep(sleep_time)
            
            if not self.running:
                break
            
            # Only change emotions automatically when in eyes mode
            with self.state_lock:
                if self.display_mode != "eyes":
                    continue
                    
            action_chance = random.random()
            
            if action_chance < 0.3:
                # Blink
                self.start_blink()
            elif action_chance < 0.4:
                # Side-eye moment
                print("👀 Side-eye")
                self.set_emotion("sideeye")
                time.sleep(2)
                self.set_emotion("normal")
            else:
                # Random emotion change
                new_emotion = random.choice(emotion_list)
                print(f"😊 Emotion: {new_emotion}")
                self.start_blink()  # Blink before emotion change
                time.sleep(0.5)
                self.set_emotion(new_emotion)
                
                # Special behaviors for certain emotions
                if new_emotion == "excited":
                    time.sleep(1)
                    self.start_blink()
                    time.sleep(0.5)
                    self.start_blink()
                elif new_emotion == "sleepy":
                    time.sleep(3)

    def run(self):
        """Main animation loop with consistent frame rate."""
        self.set_emotion("normal")
        
        # Start emotion controller thread
        emotion_thread = threading.Thread(target=self.emotion_controller, daemon=True)
        emotion_thread.start()
        
        print("🎭 API Emotional Display started!")
        print("   Eyes mode active by default")
        print("   Send API requests to show text + emotions")
        
        try:
            last_frame_time = time.time()
            
            while self.running:
                current_time = time.time()
                
                # Update animation state
                self.update_state()
                
                # Render frame
                self.render_frame()
                
                # Frame rate control
                elapsed = current_time - last_frame_time
                sleep_time = max(0, self.frame_time - elapsed)
                
                if sleep_time > 0:
                    time.sleep(sleep_time)
                
                last_frame_time = current_time
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping API display...")
            self.running = False


# Global display instance
display = None

@app.route('/display', methods=['POST'])
def display_text():
    """API endpoint to display text with emotion."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        text = data.get('text', '')
        emotion = data.get('emotion', 'normal')
        duration = data.get('duration', 10)
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        # Validate emotion
        if emotion not in display.emotions:
            return jsonify({'error': f'Invalid emotion. Valid emotions: {list(display.emotions.keys())}'}), 400
        
        # Validate duration
        try:
            duration = float(duration)
            if duration <= 0 or duration > 60:
                return jsonify({'error': 'Duration must be between 0 and 60 seconds'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Duration must be a number'}), 400
        
        # Show text with emotion
        display.show_text_with_emotion(text, emotion, duration)
        
        return jsonify({
            'success': True,
            'text': text,
            'emotion': emotion,
            'duration': duration
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/emotions', methods=['GET'])
def get_emotions():
    """Get list of available emotions."""
    return jsonify({
        'emotions': list(display.emotions.keys()),
        'current_emotion': display.current_emotion,
        'display_mode': display.display_mode
    })

@app.route('/status', methods=['GET'])
def get_status():
    """Get current display status."""
    with display.state_lock:
        return jsonify({
            'display_mode': display.display_mode,
            'current_emotion': display.current_emotion,
            'current_text': display.current_text if display.display_mode == "text" else "",
            'text_display_until': display.text_display_until.isoformat() if display.text_display_until else None,
            'available_emotions': list(display.emotions.keys())
        })

def start_display():
    """Initialize and start the display in a separate thread."""
    global display
    
    try:
        serial = i2c(port=1, address=0x3C)
        device = sh1106(serial, width=128, height=64)
        display = APIEmotionalDisplay(device)
        
        # Start display in separate thread
        display_thread = threading.Thread(target=display.run, daemon=True)
        display_thread.start()
        
        return True
    except Exception as e:
        print(f"Error initializing display: {e}")
        return False

def main():
    """Main function to start both display and API server."""
    print("🚀 Starting API Emotional Display Server...")
    
    if not start_display():
        print("❌ Failed to initialize display")
        return
    
    # Give display time to initialize
    time.sleep(2)
    
    print("🌐 Starting Flask API server...")
    print("📡 API Endpoints:")
    print("   POST /display - Show text with emotion")
    print("   GET /emotions - Get available emotions")
    print("   GET /status - Get current status")
    print("")
    print("📝 Example API call:")
    print('   curl -X POST -H "Content-Type: application/json" \\')
    print('        -d \'{"text": "Hello World!", "emotion": "happy", "duration": 5}\' \\')
    print('        http://localhost:5000/display')
    
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

if __name__ == "__main__":
    main()