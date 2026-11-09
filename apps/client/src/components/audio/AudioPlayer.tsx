import React from 'react';
import { Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  spokenText: string | null;
  audioUrl: string | null;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ spokenText, audioUrl }) => {
  if (!spokenText && !audioUrl) {
    return null;
  }

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-3 animate-in fade-in">
      <div className="flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-emerald-400" />
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Spoken Audio Confirmation (Gnani Timbre TTS)
        </h4>
      </div>

      {spokenText && (
        <div
          data-testid="spoken-confirmation-banner"
          className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 px-3.5 py-2.5 rounded-lg text-sm"
        >
          <span data-testid="tts-spoken-text" className="font-medium">
            "{spokenText}"
          </span>
        </div>
      )}

      {audioUrl && (
        <audio
          data-testid="tts-audio-player"
          controls
          autoPlay
          src={audioUrl}
          className="w-full h-10 rounded-md"
        />
      )}
    </div>
  );
};
