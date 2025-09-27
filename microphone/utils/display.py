"""
Display utility functions for controlling the OLED display via API
"""

import requests
from dataclasses import dataclass
from typing import List, Optional, Dict, Any


# ------------------------
# Data Models
# ------------------------

@dataclass
class DisplayOptions:
    text: str
    emotion: str = "normal"
    duration: int = 10


@dataclass
class DisplayResponse:
    success: bool
    text: str
    emotion: str
    duration: int


@dataclass
class EmotionsResponse:
    emotions: List[str]
    current_emotion: str
    display_mode: str


@dataclass
class StatusResponse:
    display_mode: str
    current_emotion: str
    current_text: Optional[str] = None
    text_display_until: Optional[str] = None
    available_emotions: Optional[List[str]] = None


# ------------------------
# API Functions
# ------------------------

def show_display_message(
    options: DisplayOptions | dict,
    api_url: str = "http://172.30.142.11:5000"
) -> DisplayResponse:
    """Show text with emotion on the OLED display"""
    try:
        if isinstance(options, dict):
            text = options.get("text", "")
            emotion = options.get("emotion", "normal")
            duration = options.get("duration", 10)
        else:
            text = options.text
            emotion = options.emotion
            duration = options.duration

        response = requests.post(
            f"{api_url}/display",
            json={
                "text": text,
                "emotion": emotion,
                "duration": duration,
            },
            timeout=5
        )
        response.raise_for_status()
        data = response.json()
        return DisplayResponse(**data)
    except Exception as e:
        print("Error calling display API:", e)
        raise


def get_available_emotions(
    api_url: str = "http://localhost:5000"
) -> EmotionsResponse:
    """Get available emotions from the display API"""
    try:
        response = requests.get(f"{api_url}/emotions", timeout=5)
        response.raise_for_status()
        data = response.json()
        return EmotionsResponse(**data)
    except Exception as e:
        print("Error getting emotions from API:", e)
        raise


def get_display_status(
    api_url: str = "http://localhost:5000"
) -> StatusResponse:
    """Get current display status from the API"""
    try:
        response = requests.get(f"{api_url}/status", timeout=5)
        response.raise_for_status()
        data = response.json()
        return StatusResponse(**data)
    except Exception as e:
        print("Error getting status from API:", e)
        raise


# ------------------------
# Constants
# ------------------------

AVAILABLE_EMOTIONS = [
    "normal",
    "happy",
    "angry",
    "surprised",
    "sleepy",
    "confused",
    "excited",
    "grumpy",
    "sad",
    "mischievous",
    "sideeye",
]
