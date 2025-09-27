/**
 * Display utility functions for controlling the OLED display via API
 */

export interface DisplayOptions {
  text: string;
  emotion?: string;
  duration?: number;
}

export interface DisplayResponse {
  success: boolean;
  text: string;
  emotion: string;
  duration: number;
}

export interface EmotionsResponse {
  emotions: string[];
  current_emotion: string;
  display_mode: string;
}

export interface StatusResponse {
  display_mode: string;
  current_emotion: string;
  current_text?: string;
  text_display_until?: string;
  available_emotions: string[];
}

/**
 * Show text with emotion on the OLED display
 * @param options Display options including text, emotion, and duration
 * @param apiUrl Base URL for the display API (default: http://localhost:5000)
 * @returns Promise<DisplayResponse>
 */
export async function showDisplayMessage(
  options: DisplayOptions,
  apiUrl: string = 'http://172.30.142.11:5000'
): Promise<DisplayResponse> {
  const { text, emotion = 'normal', duration = 10 } = options;

  try {
    const response = await fetch(`${apiUrl}/display`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        emotion,
        duration,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling display API:', error);
    throw error;
  }
}

/**
 * Get available emotions from the display API
 * @param apiUrl Base URL for the display API (default: http://localhost:5000)
 * @returns Promise<EmotionsResponse>
 */
export async function getAvailableEmotions(
  apiUrl: string = 'http://localhost:5000'
): Promise<EmotionsResponse> {
  try {
    const response = await fetch(`${apiUrl}/emotions`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error getting emotions from API:', error);
    throw error;
  }
}

/**
 * Get current display status from the API
 * @param apiUrl Base URL for the display API (default: http://localhost:5000)
 * @returns Promise<StatusResponse>
 */
export async function getDisplayStatus(
  apiUrl: string = 'http://localhost:5000'
): Promise<StatusResponse> {
  try {
    const response = await fetch(`${apiUrl}/status`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error getting status from API:', error);
    throw error;
  }
}

// Available emotions as documented in the README
export const AVAILABLE_EMOTIONS = [
  'normal',
  'happy',
  'angry',
  'surprised',
  'sleepy',
  'confused',
  'excited',
  'grumpy',
  'sad',
  'mischievous',
  'sideeye',
] as const;

export type Emotion = typeof AVAILABLE_EMOTIONS[number];
