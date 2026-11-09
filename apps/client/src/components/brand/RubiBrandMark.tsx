import React from 'react';

export interface RubiBrandMarkProps {
  className?: string;
  size?: number;
  showSubtitle?: boolean;
}

/**
 * R.U.B.I. Brand Mark Component.
 * Features the faceted Ruby Gem with audio waveform visual.
 */
export const RubiBrandMark: React.FC<RubiBrandMarkProps> = ({
  className = '',
  size = 28,
  showSubtitle = false,
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="relative shrink-0 flex items-center justify-center rounded-lg overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img
          src="/brand/rubi-mark.png"
          alt="R.U.B.I. Ruby Gem Logo"
          className="w-full h-full object-cover rounded-lg"
          onError={(e) => {
            // Fallback to stylized SVG ruby if image is loading
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold tracking-tight text-sm text-[#ededed]">
            R.U.B.I.
          </span>
          <span className="font-mono text-[10px] text-ruby-400 font-medium">
            2.0
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] text-[#85858b] truncate leading-tight">
            Responsive User Backlog & Intelligence
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Pure SVG Ruby Gem with audio waveform for Crisp Favicons and Mini Icons
 */
export const RubiGemSvg: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ruby-grad-top" x1="50" y1="5" x2="50" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
        <linearGradient id="ruby-grad-body" x1="50" y1="35" x2="50" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E11D48" />
          <stop offset="50%" stopColor="#BE123C" />
          <stop offset="100%" stopColor="#881337" />
        </linearGradient>
        <linearGradient id="ruby-grad-left" x1="5" y1="40" x2="50" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
        <linearGradient id="ruby-grad-right" x1="95" y1="40" x2="50" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#BE123C" />
          <stop offset="100%" stopColor="#4C0519" />
        </linearGradient>
      </defs>

      {/* Brilliant Cut Ruby Polygon */}
      {/* Top Facet */}
      <polygon points="26,16 74,16 92,42 8,42" fill="url(#ruby-grad-top)" />
      {/* Left Triangular Facet */}
      <polygon points="8,42 50,94 26,42" fill="url(#ruby-grad-left)" />
      {/* Right Triangular Facet */}
      <polygon points="92,42 50,94 74,42" fill="url(#ruby-grad-right)" />
      {/* Center Ruby Body Facet */}
      <polygon points="26,42 74,42 50,94" fill="url(#ruby-grad-body)" />

      {/* 5 Vertical Audio Waveform Bars in Center */}
      <rect x="36" y="52" width="4" height="16" rx="2" fill="#FFFFFF" opacity="0.95" />
      <rect x="43" y="44" width="4" height="32" rx="2" fill="#FFFFFF" />
      <rect x="50" y="38" width="4" height="44" rx="2" fill="#FFFFFF" />
      <rect x="57" y="44" width="4" height="32" rx="2" fill="#FFFFFF" />
      <rect x="64" y="52" width="4" height="16" rx="2" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );
};

