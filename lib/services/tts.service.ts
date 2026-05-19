import * as Speech from 'expo-speech';

export class TTSService {
  private static currentSpeakId: string | null = null;

  static async speak(text: string, onDone?: () => void, onError?: (error: any) => void): Promise<void> {
    try {
      // Stop any existing speech
      await Speech.stop();
      
      this.currentSpeakId = Math.random().toString();
      const speakId = this.currentSpeakId;

      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          console.log('Speech finished');
          if (speakId === this.currentSpeakId) {
            this.currentSpeakId = null;
          }
          onDone?.();
        },
        onError: (error) => {
          console.error('Speech error:', error);
          if (speakId === this.currentSpeakId) {
            this.currentSpeakId = null;
          }
          onError?.(error);
        },
      });
    } catch (error) {
      console.error('TTS error:', error);
      this.currentSpeakId = null;
      throw error;
    }
  }

  static async stop(): Promise<void> {
    try {
      this.currentSpeakId = null;
      await Speech.stop();
    } catch (error) {
      console.error('Failed to stop speech:', error);
    }
  }

  static async pause(): Promise<void> {
    try {
      await Speech.pause();
    } catch (error) {
      console.error('Failed to pause speech:', error);
    }
  }

  static async resume(): Promise<void> {
    try {
      await Speech.resume();
    } catch (error) {
      console.error('Failed to resume speech:', error);
    }
  }

  static async isSpeaking(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch (error) {
      console.error('Failed to check speaking status:', error);
      return false;
    }
  }
}
