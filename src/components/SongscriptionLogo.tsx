interface Props {
  iconSize?: number;
  showWordmark?: boolean;
  className?: string;
}

export function SongscriptionLogo({ iconSize = 24, showWordmark = true, className = "" }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Songscription"
      >
        {/* 4 vertical bars — music visualizer waveform */}
        <rect x="1"  y="12" width="5" height="14" rx="2.5" fill="#1A1A1A" />
        <rect x="9"  y="5"  width="5" height="22" rx="2.5" fill="#1A1A1A" />
        <rect x="17" y="8"  width="5" height="19" rx="2.5" fill="#1A1A1A" />
        <rect x="25" y="14" width="5" height="12" rx="2.5" fill="#1A1A1A" />
      </svg>
      {showWordmark && (
        <span className="text-[15px] font-semibold text-text tracking-tight leading-none">
          songscription
        </span>
      )}
    </div>
  );
}
