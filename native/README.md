# API Emotional Display

This project converts the OLED eye display into an API-controlled system that shows eyes by default and displays text with emotions when called via HTTP API.

## Features

- **Default Mode**: Displays animated eyes with random emotions and blinking
- **Text Mode**: Shows text with specific emotions for a configurable duration
- **Smooth Transitions**: Interpolated animations between emotional states
- **RESTful API**: Simple HTTP endpoints for controlling the display

## Hardware Requirements

- Raspberry Pi (or similar SBC)
- SH1106 OLED Display (128x64)
- I2C connection (default port 1, address 0x3C)

## Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Enable I2C on Raspberry Pi:**
   ```bash
   sudo raspi-config
   # Navigate to Interface Options > I2C > Enable
   ```

3. **Connect the OLED display:**
   - VCC → 3.3V
   - GND → Ground
   - SCL → GPIO 3 (SCL)
   - SDA → GPIO 2 (SDA)

## Usage

### Starting the Server

```bash
python3 api_server.py
```

The server will:
- Initialize the OLED display
- Start showing animated eyes
- Listen for API requests on `http://localhost:5000`

### API Endpoints

#### POST /display
Show text with emotion for a specified duration.

**Request:**
```json
{
  "text": "Hello World!",
  "emotion": "happy",
  "duration": 10
}
```

**Response:**
```json
{
  "success": true,
  "text": "Hello World!",
  "emotion": "happy",
  "duration": 10
}
```

#### GET /emotions
Get list of available emotions.

**Response:**
```json
{
  "emotions": ["normal", "happy", "angry", "surprised", "sleepy", "confused", "excited", "grumpy", "sad", "mischievous", "sideeye"],
  "current_emotion": "normal",
  "display_mode": "eyes"
}
```

#### GET /status
Get current display status.

**Response:**
```json
{
  "display_mode": "text",
  "current_emotion": "happy",
  "current_text": "Hello World!",
  "text_display_until": "2025-09-27T15:30:45.123456",
  "available_emotions": ["normal", "happy", "angry", "surprised", "sleepy", "confused", "excited", "grumpy", "sad", "mischievous", "sideeye"]
}
```

### Available Emotions

- **normal**: Default neutral expression
- **happy**: Slightly squinted eyes with upward offset
- **angry**: Wider, shorter eyes with angry eyebrows
- **surprised**: Very wide, tall eyes with raised eyebrows
- **sleepy**: Narrow, droopy eyes
- **confused**: Slightly narrower eyes
- **excited**: Wide, tall eyes
- **grumpy**: Short eyes with grumpy eyebrows
- **sad**: Slightly taller eyes with sad eyebrows
- **mischievous**: Narrower eyes with slight offset
- **sideeye**: Eyes looking to the side

### Example API Calls

#### Using curl:

```bash
# Show happy message for 5 seconds
curl -X POST -H "Content-Type: application/json" \
     -d '{"text": "Hello World!", "emotion": "happy", "duration": 5}' \
     http://localhost:5000/display

# Show angry message for 3 seconds
curl -X POST -H "Content-Type: application/json" \
     -d '{"text": "Error occurred!", "emotion": "angry", "duration": 3}' \
     http://localhost:5000/display

# Get available emotions
curl http://localhost:5000/emotions

# Check current status
curl http://localhost:5000/status
```

#### Using the test client:

```bash
python3 test_client.py
```

This provides an interactive interface and demonstration mode.

### Integration Examples

#### Python:
```python
import requests

def show_message(text, emotion="normal", duration=10):
    response = requests.post('http://localhost:5000/display', 
                           json={'text': text, 'emotion': emotion, 'duration': duration})
    return response.json()

# Usage
show_message("Welcome!", "happy", 5)
show_message("Processing...", "confused", 3)
show_message("Complete!", "excited", 2)
```

#### JavaScript:
```javascript
async function showMessage(text, emotion = 'normal', duration = 10) {
    const response = await fetch('http://localhost:5000/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, emotion, duration })
    });
    return await response.json();
}

// Usage
await showMessage("Hello!", "happy", 5);
await showMessage("Error!", "angry", 3);
```

## Behavior

### Default Eyes Mode
- Displays animated cylindrical eyes
- Random emotion changes every 4-8 seconds
- Automatic blinking
- Smooth interpolated animations
- Special behaviors like side-eye glances

### Text Display Mode
- Automatically triggered by API calls
- Shows text with word wrapping
- Displays emotion indicator at top
- Returns to eyes mode after duration expires
- Emotions affect eye appearance when returning to eyes mode

### Threading Model
- Main thread: Display rendering loop (30 FPS)
- API thread: Flask web server
- Emotion controller thread: Automatic emotion changes (eyes mode only)
- Thread-safe state management with locks

## Customization

### Adjusting Display Parameters
Edit `api_server.py`:
- Frame rate: Change `self.frame_rate`
- Animation speed: Adjust `self.lerp_speed`
- Eye dimensions: Modify `base_eye_width`, `base_eye_height`
- Emotion parameters: Update `self.emotions` dictionary

### Adding New Emotions
```python
self.emotions["custom"] = {
    'width': 25, 
    'height': 35, 
    'offset_y': -2
}
```

### Changing Text Display
Modify the `draw_text()` method to customize:
- Font size and style
- Text positioning
- Word wrapping behavior
- Emotion indicator format

## Troubleshooting

### Display Issues
- Check I2C connection and address (default 0x3C)
- Verify OLED is SH1106 compatible
- Test with `i2cdetect -y 1`

### API Issues
- Ensure port 5000 is available
- Check firewall settings for network access
- Verify Flask is installed correctly

### Performance Issues
- Reduce frame rate if CPU usage is high
- Increase lerp_speed for faster animations
- Check I2C bus speed settings

## Files

- `api_server.py` - Main API server with display control
- `test_client.py` - Interactive test client and demo
- `requirements.txt` - Python dependencies
- `test.py` - Original standalone eye display (reference)

## License

This project is part of the ETH Global hackathon submission.