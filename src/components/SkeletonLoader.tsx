type SkeletonLoaderProps = {
  label: string;
  variant: 'plans' | 'pocket' | 'result';
};

function Bone({ className }: { className: string }) {
  return <span className={`skeleton-bone ${className}`} aria-hidden="true" />;
}

function SkeletonLoader({ label, variant }: SkeletonLoaderProps) {
  return (
    <div className={`skeleton-loader skeleton-${variant}`} role="status" aria-live="polite" aria-label={label}>
      {variant === 'plans' &&
        [0, 1, 2].map((item) => (
          <div key={item} className="plan-card skeleton-plan-card">
            <Bone className="skeleton-thumb" />
            <div className="skeleton-copy">
              <Bone className="skeleton-line skeleton-line-lg" />
              <Bone className="skeleton-line" />
              <Bone className="skeleton-line skeleton-line-sm" />
            </div>
          </div>
        ))}
      {variant === 'pocket' &&
        [0, 1, 2].map((item) => (
          <div key={item} className="skeleton-pocket-card">
            <Bone className="skeleton-pocket-thumb" />
            <div className="skeleton-copy">
              <Bone className="skeleton-line skeleton-line-lg" />
              <Bone className="skeleton-line skeleton-line-sm" />
            </div>
          </div>
        ))}
      {variant === 'result' && (
        <>
          <div className="skeleton-result-heading">
            <Bone className="skeleton-line skeleton-line-xl" />
            <Bone className="skeleton-line" />
            <Bone className="skeleton-line skeleton-line-lg" />
          </div>
          <div className="skeleton-result-workspace">
            <div className="skeleton-result-map">
              <Bone className="skeleton-map" />
            </div>
            <div className="skeleton-result-list">
              {[0, 1, 2].map((item) => (
                <div key={item} className="skeleton-result-stop">
                  <Bone className="skeleton-badge" />
                  <div className="skeleton-copy">
                    <Bone className="skeleton-line skeleton-line-lg" />
                    <Bone className="skeleton-line skeleton-line-sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default SkeletonLoader;
