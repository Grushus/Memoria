import { AppState } from 'react-native';
import * as Speech from 'expo-speech';

let isSpeaking = false;

// Stop speech whenever the app goes to background or becomes inactive
AppState.addEventListener('change', (state) => {
  if (state === 'background' || state === 'inactive') {
    Speech.stop();
    isSpeaking = false;
  }
});

export async function narrateText(text: string): Promise<void> {
  if (isSpeaking) {
    Speech.stop();
  }
  isSpeaking = true;

  return new Promise((resolve) => {
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
      onDone: () => {
        isSpeaking = false;
        resolve();
      },
      onError: () => {
        isSpeaking = false;
        resolve();
      },
    });
  });
}

export function stopNarration(): void {
  if (isSpeaking) {
    Speech.stop();
    isSpeaking = false;
  }
}

export function isNarrating(): boolean {
  return isSpeaking;
}
