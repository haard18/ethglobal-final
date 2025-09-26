# Use an official Python base image for ARM (Raspberry Pi)
FROM --platform=linux/arm/v7 python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt ./
# Install system dependencies for PyAudio
RUN apt-get update && \
	apt-get install -y portaudio19-dev gcc && \
	pip install --no-cache-dir -r requirements.txt && \
	apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY . .

# Set environment variables (optional)
ENV PYTHONUNBUFFERED=1

# Default command to run your main script
CMD ["python", "main.py"]
