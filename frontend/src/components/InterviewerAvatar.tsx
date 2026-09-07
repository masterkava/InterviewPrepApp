interface Props {
  state: 'idle' | 'thinking' | 'speaking';
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
};

export default function InterviewerAvatar({ state, size = 'md' }: Props) {
  return (
    <div className={`relative ${SIZES[size]} rounded-full flex items-center justify-center`}>
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 ${
          state === 'thinking'
            ? 'bg-primary-100 animate-pulse'
            : state === 'speaking'
              ? 'bg-primary-200 animate-pulse'
              : 'bg-primary-50'
        }`}
      />
      <div className="relative z-10 flex items-center justify-center w-full h-full">
        <svg
          viewBox="0 0 80 80"
          className={`${SIZES[size]}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Head */}
          <circle cx="40" cy="28" r="16" className="fill-primary-400" />
          {/* Body */}
          <path
            d="M16 72 C16 52 64 52 64 72"
            className="fill-primary-500"
            strokeLinecap="round"
          />
          {/* Eyes */}
          <circle cx="34" cy="26" r="2" className="fill-white" />
          <circle cx="46" cy="26" r="2" className="fill-white" />
          {/* Mouth */}
          {state === 'speaking' ? (
            <ellipse cx="40" cy="34" rx="4" ry="3" className="fill-white" />
          ) : (
            <path
              d="M35 33 Q40 37 45 33"
              className="stroke-white"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          )}
          {/* Tie / accent */}
          <path d="M40 52 L36 60 L40 58 L44 60 Z" className="fill-primary-300" />
        </svg>
      </div>
      {state === 'thinking' && (
        <div className="absolute -top-1 -right-1 flex gap-0.5">
          <span className="block w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="block w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="block w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      )}
    </div>
  );
}
