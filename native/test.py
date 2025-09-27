#!/usr/bin/env python3
"""
Smooth Emotional Cylinder Eyes for OLED Display
Optimized version with interpolated animations and frame rate control
"""

import time
import random
import threading
import math
from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import sh1106


class SmoothEmotionalCylinderEyes:
    def __init__(self, device):
        self.device = device
        self.width = device.width
        self.height = device.height

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
            "sideeye": {'width': 20, 'height': 40, 'offset_y': 0}
        }

    def lerp(self, start, end, t):
        """Linear interpolation between start and end by factor t."""
        return start + (end - start) * t

    def ease_in_out(self, t):
        """Smooth easing function for more natural animations."""
        return t * t * (3.0 - 2.0 * t)

    def update_state(self):
        """Smoothly interpolate current state towards target state."""
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
        """Background thread for controlling emotion changes."""
        emotion_list = list(self.emotions.keys())
        emotion_list.remove("sideeye")  # Handle separately
        
        while self.running:
            sleep_time = random.uniform(4, 8)
            time.sleep(sleep_time)
            
            if not self.running:
                break
                
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
                    # Gradual drooping effect handled by interpolation
                    time.sleep(3)

    def run(self):
        """Main animation loop with consistent frame rate."""
        self.set_emotion("normal")
        
        # Start emotion controller thread
        emotion_thread = threading.Thread(target=self.emotion_controller, daemon=True)
        emotion_thread.start()
        
        print("🎭 Smooth emotional cylinder eyes started!")
        print("   Watching for different emotions...")
        print("   Ctrl+C to stop.")
        
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
            print("\n🛑 Stopping smooth eyes...")
            self.running = False


def main():
    serial = i2c(port=1, address=0x3C)
    device = sh1106(serial, width=128, height=64)
    eyes = SmoothEmotionalCylinderEyes(device)
    eyes.run()


if __name__ == "__main__":
    main()