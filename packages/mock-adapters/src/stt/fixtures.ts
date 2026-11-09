/**
 * Authentic Transcripts & Multilingual Fixtures for Gnani Prisma STT
 *
 * Mined from legacy SQLite database (data/rubi_local.db) preserving 17 real-world
 * Hinglish dictations, user colloquialisms, and speech recognition phonetic artifacts
 * ("backlog wale dance" for tasks, "complete maaf" for mark complete), plus English
 * and Hindi baseline fixtures.
 */

export interface TranscriptFixture {
  id: string;
  title: string;
  transcript: string;
  language: 'en' | 'hi' | 'hi-en';
  confidence: number;
  durationMs: number;
}

/**
 * The 17 recovered Hinglish transcripts from legacy rubi_local.db tasks
 */
export const RECOVERED_HINGLISH_TRANSCRIPTS: readonly TranscriptFixture[] = [
  {
    id: 'hinglish-rec-01',
    title: 'Create Agriculture Website Landing Page',
    transcript:
      'mera ek aur task add kar do mujhe ek website banani hai agriculture ke upar to uske liye mujhe thoda time lagega basic landing page hi banana hai to mujhe aaram se do ghante lag jayenge to main chahta hu tum use kal ke liye schedule kar do dopahar me rakhna usko',
    language: 'hi-en',
    confidence: 0.94,
    durationMs: 7200,
  },
  {
    id: 'hinglish-rec-02',
    title: 'Create Agriculture Website',
    transcript:
      'Haan task yeh hai ki mujhe ek website banana agriculture ke liye, toh aaj toh koi time hai nahi toh kal ke liye isse kal dopahar ke liye isse schedule kar do.',
    language: 'hi-en',
    confidence: 0.95,
    durationMs: 5100,
  },
  {
    id: 'hinglish-rec-03',
    title: 'Study Machine Learning',
    transcript: 'Mujhe kal dopahar mein machine learning padhni hai.',
    language: 'hi-en',
    confidence: 0.98,
    durationMs: 2400,
  },
  {
    id: 'hinglish-rec-04',
    title: 'Read research paper',
    transcript:
      'aur kal ke liye mere ko ek research paper bhi padhna hai to usko 5 baje ka schedule kar do aur... mera aaj aur kal ka schedule tasks bhi dekhna chahta hoon',
    language: 'hi-en',
    confidence: 0.93,
    durationMs: 4800,
  },
  {
    id: 'hinglish-rec-05',
    title: 'Entrance Exam',
    transcript:
      'mujhe sunday ke liye kuch task assign karna hai jaise mujhe exam dene jana hai entrance exam 10 baje se 11 baje tak to meri 9 baje train hai to tum mujhe 8:30 baje yaad dila dena aur then after ha mujhe shaam ko bahar khane khane jana hai 8 baje to mujhe 7:30 baje ek baar yaad dila dena aur mere kaun kaun se schedule tasks hain main wo bhi dekhna chahta hoon abhi',
    language: 'hi-en',
    confidence: 0.96,
    durationMs: 9600,
  },
  {
    id: 'hinglish-rec-06',
    title: 'Gandhi Jayanti speech preparation',
    transcript:
      'Achha second October ko ek event hai usko schedule karo mere ko Gandhi Jayanti ke related ek speech prepare karni hai mere college mein jo ki second October ko 11 baje hoga to mere main',
    language: 'hi-en',
    confidence: 0.92,
    durationMs: 6300,
  },
  {
    id: 'hinglish-rec-07',
    title: 'Paani peene ki yaad dilao',
    transcript:
      'Har 1 minute mein mujhe yaad dilao paani peene ke liye. Repetition task set kar do aur har minute mein woh mujhe yaad dilaye. 8:05 ke baad ise chalu kar dena.',
    language: 'hi-en',
    confidence: 0.95,
    durationMs: 5400,
  },
  {
    id: 'hinglish-rec-08',
    title: 'Build website banana.com',
    transcript:
      'Han theek hai kam karo jitna bhi mere backlog wale dance se unko complete maaf kar do aur usko hata do ab se Ham kuchh new talks add karenge yah karne ke bad Tum aaj ke liye mujhe yah Dal do ki mujhe ek website build karni hai banana.com and cal ke liye Dal do mujhe machine Hai yah sab karne ke bad mujhe last mein ek bar overview de dena tumne kaun kaun se task ko done mention kar diya hai and aaj ka task Kya hoga aur cal ka task kya hoga',
    language: 'hi-en',
    confidence: 0.91,
    durationMs: 11200,
  },
  {
    id: 'hinglish-rec-09',
    title: 'Data Structures GFC assignment',
    transcript: 'Data Structures GFC assignment kal subah 10 baje tak submit karna hai.',
    language: 'hi-en',
    confidence: 0.96,
    durationMs: 3100,
  },
  {
    id: 'hinglish-rec-10',
    title: 'Data Structures GFG assignment',
    transcript: 'Data Structures GFG assignment complete karna hai Rahul ke sath.',
    language: 'hi-en',
    confidence: 0.97,
    durationMs: 2900,
  },
  {
    id: 'hinglish-rec-11',
    title: 'Reading the research paper of the Transformers',
    transcript: 'Reading the research paper of the Transformers before tomorrow evening.',
    language: 'hi-en',
    confidence: 0.98,
    durationMs: 3400,
  },
  {
    id: 'hinglish-rec-12',
    title: 'Agriculture website banana',
    transcript: 'Agriculture website banana hai and deployment configure karna hai.',
    language: 'hi-en',
    confidence: 0.95,
    durationMs: 3200,
  },
  {
    id: 'hinglish-rec-13',
    title: 'Machine learning padhna',
    transcript: 'Machine learning padhna hai Saturday sham ko 6 baje.',
    language: 'hi-en',
    confidence: 0.96,
    durationMs: 2600,
  },
  {
    id: 'hinglish-rec-14',
    title: 'Machine learning padhna start karna',
    transcript: 'Machine learning padhna start karna hai 4 PM pe laptop se.',
    language: 'hi-en',
    confidence: 0.96,
    durationMs: 2800,
  },
  {
    id: 'hinglish-rec-15',
    title: 'Bahar khana khana',
    transcript: 'Bahar khana khana hai doston ke sath 8:00 PM pe.',
    language: 'hi-en',
    confidence: 0.97,
    durationMs: 2200,
  },
  {
    id: 'hinglish-rec-16',
    title: 'Machine learning task',
    transcript: 'Machine learning task complete karo and model accuracy evaluate karo before demo.',
    language: 'hi-en',
    confidence: 0.95,
    durationMs: 3600,
  },
  {
    id: 'hinglish-rec-17',
    title: 'Sprint Planning Meeting & Architecture Doc',
    transcript:
      'Kal subah 10 baje sprint planning meeting karni hai aur Durgvijay ko architecture document complete karna hai before Friday. Frontend dashboard integration blocked hai backend API se.',
    language: 'hi-en',
    confidence: 0.96,
    durationMs: 4800,
  },
] as const;

/**
 * Standard English baseline fixtures
 */
export const ENGLISH_STT_FIXTURES: readonly TranscriptFixture[] = [
  {
    id: 'en-fixture-01',
    title: 'PostgreSQL Database Setup with Dependency',
    transcript:
      'Please set up the PostgreSQL database by tomorrow 5 PM and assign the task to backend team. The API integration is blocked by database setup.',
    language: 'en',
    confidence: 0.98,
    durationMs: 4500,
  },
  {
    id: 'en-fixture-02',
    title: 'Team Retrospective',
    transcript: 'Schedule team retrospective meeting for Friday at 4 PM and assign to Sarah.',
    language: 'en',
    confidence: 0.99,
    durationMs: 3200,
  },
  {
    id: 'en-fixture-03',
    title: 'Deterministic Complete Command',
    transcript: 'Mark task #3 as completed.',
    language: 'en',
    confidence: 0.99,
    durationMs: 1500,
  },
  {
    id: 'en-fixture-04',
    title: 'Deterministic Backlog Query',
    transcript: 'Show all pending tasks in the backlog.',
    language: 'en',
    confidence: 0.98,
    durationMs: 1800,
  },
] as const;

/**
 * Standard Hindi (Devanagari) baseline fixtures
 */
export const HINDI_STT_FIXTURES: readonly TranscriptFixture[] = [
  {
    id: 'hi-fixture-01',
    title: 'डेटाबेस माइग्रेशन कार्य',
    transcript: 'हफ्ते के अंत तक हमें डेटाबेस माइग्रेशन पूरा करना है और राहुल इसकी समीक्षा करेगा।',
    language: 'hi',
    confidence: 0.97,
    durationMs: 3800,
  },
  {
    id: 'hi-fixture-02',
    title: 'टास्क नंबर 5 पूर्ण',
    transcript: 'टास्क नंबर 5 को पूरा मार्क करो',
    language: 'hi',
    confidence: 0.98,
    durationMs: 1600,
  },
  {
    id: 'hi-fixture-03',
    title: 'समस्या निवारण',
    transcript: 'इस समस्या को तुरंत हल करो',
    language: 'hi',
    confidence: 0.95,
    durationMs: 1500,
  },
] as const;

/**
 * Master catalog of all STT fixtures
 */
export const ALL_STT_FIXTURES: readonly TranscriptFixture[] = [
  ...RECOVERED_HINGLISH_TRANSCRIPTS,
  ...ENGLISH_STT_FIXTURES,
  ...HINDI_STT_FIXTURES,
];

