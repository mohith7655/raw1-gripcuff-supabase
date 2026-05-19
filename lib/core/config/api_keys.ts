// API Configuration - Load from environment variables
export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
export const OPENAI_API_BASE = 'https://api.openai.com/v1';
export const TTS_MODEL = 'tts-1';
export const TTS_VOICE = 'alloy';
export const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';

export const isApiKeysConfigured = {
  openAI: !!OPENAI_API_KEY,
};
