import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

interface NativeAdCardProps {
  isPremium: boolean;
  onEnablePremium: () => void;
}

export const NativeAdCard: React.FC<NativeAdCardProps> = ({ isPremium, onEnablePremium }) => {
  if (isPremium) return null;

  return (
    <div className="ad-native-card" role="complementary" aria-label="Sponsored placeholder ad">
      <div className="ad-native-left">
        <span className="ad-label">Sponsored • Ad Placeholder</span>
        <span className="ad-copy">
          Low-key native slot (e.g., partner streaming bundle offer). Hidden for Premium members.
        </span>
      </div>
      <button type="button" className="ad-cta" onClick={onEnablePremium}>
        <Sparkles size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
        Go Ad-Free
      </button>
    </div>
  );
};

interface FooterAdBannerProps {
  isPremium: boolean;
}

export const FooterAdBanner: React.FC<FooterAdBannerProps> = ({ isPremium }) => {
  const [dismissed, setDismissed] = useState(false);

  if (isPremium || dismissed) return null;

  return (
    <div className="ad-footer-banner" role="complementary" aria-label="Footer banner placeholder ad">
      <span>
        <strong style={{ color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.06em' }}>
          AD PLACEHOLDER
        </strong>{' '}
        — Slim footer banner (320×50 mobile style). Removed in Premium.
      </span>
      <button
        type="button"
        className="ad-dismiss-btn"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss ad banner"
        title="Dismiss for this session"
      >
        <X size={14} />
      </button>
    </div>
  );
};
