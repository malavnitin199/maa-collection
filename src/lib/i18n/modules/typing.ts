/**
 * Typing in Hindi or English, and speaking to fill a field (owner's feedback
 * 2026-11-20). Every key starts with "type.".
 */
export const typingEn = {
  'type.hindi': 'Type in Hindi',
  'type.english': 'Type in English',
  'type.toHindi': 'Change to Hindi',
  'type.toEnglish': 'Change to English',
  'type.speak': 'Speak to fill',
  'type.listening': 'Listening… tap to stop',
  'type.micDenied': 'Microphone not allowed. Allow it for this site in the phone’s settings.',
  'type.noSpeech': 'Did not catch that. Tap the microphone and try again.',
  'type.micError': 'Voice did not work this time. Type instead.',
  'type.startOver': 'Start again',
  'type.startOverAsk': 'Clear everything typed here and start again?',
  'type.cleared': 'Cleared. Start a new entry.',
} as const;

export const typingHi: Record<keyof typeof typingEn, string> = {
  'type.hindi': 'हिंदी में लिखें',
  'type.english': 'अंग्रेज़ी में लिखें',
  'type.toHindi': 'हिंदी में बदलें',
  'type.toEnglish': 'अंग्रेज़ी में बदलें',
  'type.speak': 'बोलकर भरें',
  'type.listening': 'सुन रहे हैं… रोकने के लिए दबाएँ',
  'type.micDenied': 'माइक की अनुमति नहीं है। फ़ोन की सेटिंग में इस साइट के लिए माइक चालू करें।',
  'type.noSpeech': 'सुनाई नहीं दिया। माइक दबाकर फिर बोलें।',
  'type.micError': 'इस बार आवाज़ से नहीं हुआ। लिखकर भरें।',
  'type.startOver': 'फिर से शुरू करें',
  'type.startOverAsk': 'यहाँ लिखा सब हटाकर फिर से शुरू करें?',
  'type.cleared': 'हट गया। नई एंट्री शुरू करें।',
};
