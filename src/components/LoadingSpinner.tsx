type LoadingSpinnerProps = {
  label: string;
  size?: 'page' | 'block';
};

function LoadingSpinner({ label, size = 'block' }: LoadingSpinnerProps) {
  return (
    <div
      className={size === 'page' ? 'loading-spinner loading-spinner-page' : 'loading-spinner'}
      role="status"
      aria-live="polite"
    >
      <span className="loading-spinner-mark" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export default LoadingSpinner;
