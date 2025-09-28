"""
Configuration manager for Pluto Microphone Service
Handles environment variables and service endpoints
"""

import os
from dataclasses import dataclass
from typing import Optional

# Load environment variables if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("python-dotenv not installed - using system environment variables only")


@dataclass
class MicrophoneConfig:
    """Configuration for microphone service"""
    # Service endpoints
    rpi_server_host: str = "172.30.142.11"
    rpi_server_port: int = 3000
    display_host: str = "172.30.142.11"
    display_port: int = 5000
    
    # Audio settings
    energy_threshold: int = 200
    pause_threshold: float = 0.9
    wake_threshold: float = 0.6
    
    # Session settings
    session_timeout_minutes: int = 5
    max_conversation_history: int = 20
    debug_mode: bool = True
    
    # Voice feedback
    voice_feedback_enabled: bool = True
    default_display_duration: int = 8
    
    # Request settings
    max_retries: int = 3
    request_timeout_seconds: int = 10
    
    def __post_init__(self):
        """Load configuration from environment variables"""
        # Service endpoints
        self.rpi_server_host = os.getenv("RPI_SERVER_HOST", self.rpi_server_host)
        self.rpi_server_port = int(os.getenv("RPI_SERVER_PORT", str(self.rpi_server_port)))
        self.display_host = os.getenv("DISPLAY_HOST", self.display_host)
        self.display_port = int(os.getenv("DISPLAY_PORT", str(self.display_port)))
        
        # Audio settings
        self.energy_threshold = int(os.getenv("ENERGY_THRESHOLD", str(self.energy_threshold)))
        self.pause_threshold = float(os.getenv("PAUSE_THRESHOLD", str(self.pause_threshold)))
        self.wake_threshold = float(os.getenv("WAKE_THRESHOLD", str(self.wake_threshold)))
        
        # Session settings
        self.session_timeout_minutes = int(os.getenv("SESSION_TIMEOUT_MINUTES", str(self.session_timeout_minutes)))
        self.max_conversation_history = int(os.getenv("MAX_CONVERSATION_HISTORY", str(self.max_conversation_history)))
        self.debug_mode = os.getenv("DEBUG_MODE", "true").lower() == "true"
        
        # Voice feedback
        self.voice_feedback_enabled = os.getenv("VOICE_FEEDBACK_ENABLED", "true").lower() == "true"
        self.default_display_duration = int(os.getenv("DEFAULT_DISPLAY_DURATION", str(self.default_display_duration)))
        
        # Request settings
        self.max_retries = int(os.getenv("MAX_RETRIES", str(self.max_retries)))
        self.request_timeout_seconds = int(os.getenv("REQUEST_TIMEOUT_SECONDS", str(self.request_timeout_seconds)))
    
    @property
    def rpi_server_url(self) -> str:
        """Get the complete RPI server URL"""
        return f"http://{self.rpi_server_host}:{self.rpi_server_port}/"
    
    @property
    def display_url(self) -> str:
        """Get the complete display service URL"""
        return f"http://{self.display_host}:{self.display_port}"
    
    @property
    def session_timeout_seconds(self) -> int:
        """Get session timeout in seconds"""
        return self.session_timeout_minutes * 60
    
    def validate(self) -> bool:
        """Validate configuration settings"""
        if self.debug_mode:
            print("🔧 Pluto Microphone Configuration:")
            print(f"   RPI Server: {self.rpi_server_url}")
            print(f"   Display: {self.display_url}")
            print(f"   Session timeout: {self.session_timeout_minutes} minutes")
            print(f"   Wake threshold: {self.wake_threshold}")
        
        try:
            # Test connectivity (optional)
            import requests
            
            try:
                response = requests.get(self.rpi_server_url, timeout=2)
                print(f"✅ RPI Server accessible")
            except:
                print(f"⚠️  RPI Server not accessible at {self.rpi_server_url}")
            
            try:
                response = requests.get(f"{self.display_url}/status", timeout=2)
                print(f"✅ Display service accessible")
            except:
                print(f"⚠️  Display service not accessible at {self.display_url}")
                
            return True
        except ImportError:
            print("⚠️  requests not available for connectivity test")
            return True
        except Exception as e:
            if self.debug_mode:
                print(f"⚠️  Configuration validation error: {e}")
            return False


# Global configuration instance
config = MicrophoneConfig()