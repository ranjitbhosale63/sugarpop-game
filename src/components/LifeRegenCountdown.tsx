import React, { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_MAX_LIVES,
  LIFE_REGEN_INTERVAL_SECONDS,
  formatRegenCountdown,
  getRemainingRegenSeconds,
} from '../game-engine/economyEngine';

interface LifeRegenCountdownProps {
  lives: number;
  maxLives?: number;
  nextLifeSeconds: number;
  lastLifeUpdatedAt?: number;
  fullLabel?: string;
  prefix?: string;
  className?: string;
  onRegenReady?: () => void;
}

const LifeRegenCountdownComponent: React.FC<LifeRegenCountdownProps> = ({
  lives,
  maxLives = DEFAULT_MAX_LIVES,
  nextLifeSeconds,
  lastLifeUpdatedAt,
  fullLabel = 'FULL',
  prefix = '',
  className,
  onRegenReady,
}) => {
  const isFull = lives >= maxLives;

  const [displaySeconds, setDisplaySeconds] = useState<number>(() =>
    isFull
      ? 0
      : getRemainingRegenSeconds(
          { lives, maxLives, nextLifeSeconds, lastLifeUpdatedAt },
          Date.now(),
          LIFE_REGEN_INTERVAL_SECONDS
        )
  );

  const notifiedAnchorRef = useRef<string | null>(null);

  useEffect(() => {
    if (isFull) {
      notifiedAnchorRef.current = null;
      setDisplaySeconds(0);
      return;
    }

    const anchorKey = `${lives}:${maxLives}:${nextLifeSeconds}:${lastLifeUpdatedAt ?? 0}`;

    const refreshFromClock = () => {
      const remaining = getRemainingRegenSeconds(
        { lives, maxLives, nextLifeSeconds, lastLifeUpdatedAt },
        Date.now(),
        LIFE_REGEN_INTERVAL_SECONDS
      );

      setDisplaySeconds((prev) => (prev === remaining ? prev : remaining));

      if (remaining <= 0 && onRegenReady && notifiedAnchorRef.current !== anchorKey) {
        notifiedAnchorRef.current = anchorKey;
        onRegenReady();
      }
    };

    refreshFromClock();

    const intervalId = window.setInterval(refreshFromClock, 1000);

    const handleResume = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      refreshFromClock();
    };

    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [isFull, lives, maxLives, nextLifeSeconds, lastLifeUpdatedAt, onRegenReady]);

  if (isFull) {
    return <span className={className}>{fullLabel}</span>;
  }

  return (
    <span className={className}>
      {prefix}
      {formatRegenCountdown(displaySeconds)}
    </span>
  );
};

export const LifeRegenCountdown = React.memo(LifeRegenCountdownComponent);
