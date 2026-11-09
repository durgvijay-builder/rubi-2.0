import { MockPrismaSTTAdapter } from './stt/mockPrismaSTT.js';
import { MockTimbreTTSAdapter } from './tts/mockTimbreTTS.js';

// STT Port & Adapters
export * from './stt/index.js';

// TTS Port & Adapters
export * from './tts/index.js';

// Extraction Port & Adapters
export * from './extraction/index.js';

// Backward-compatibility aliases
export { MockPrismaSTTAdapter as MockSTTAdapter };
export { MockTimbreTTSAdapter as MockTTSAdapter };
