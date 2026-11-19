/**
 * Sections (plan v19, ADR-033): Men / Women / Boys / Girls and the owner's own.
 * Every key starts with "sec.". English text is copied exactly from the
 * screens / server messages; Hindi uses the shared word list in
 * docs/TECHNICAL_REFERENCE.md §15.
 */
export const sectionsEn = {
  'sec.err.sectionNotFound': 'Choose Men, Women, Boys or Girls.',
  'sec.err.name': 'Enter a name (up to 30 characters).',
  'sec.err.exists': 'That name is already in the list.',
  'sec.err.size': 'Type a size.',
  'sec.err.hidden': 'This section is hidden. Bring it back in Categories first.',
  'sec.err.needsSection': 'Sort this category under Men, Women, Boys or Girls first (Categories).',
  'sec.unsorted': 'Needs sorting',
} as const;

export const sectionsHi: Record<keyof typeof sectionsEn, string> = {
  'sec.err.sectionNotFound': 'पुरुष, महिला, लड़के या लड़कियाँ चुनें।',
  'sec.err.name': 'नाम लिखें (30 अक्षर तक)।',
  'sec.err.exists': 'यह नाम सूची में पहले से है।',
  'sec.err.size': 'साइज़ लिखें।',
  'sec.err.hidden': 'यह सेक्शन छिपा है। पहले कैटेगरी में इसे वापस लाएँ।',
  'sec.err.needsSection': 'पहले इस कैटेगरी को पुरुष, महिला, लड़के या लड़कियाँ में रखें (कैटेगरी)।',
  'sec.unsorted': 'अभी किसी में नहीं',
};
