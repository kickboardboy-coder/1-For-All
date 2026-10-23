type EmptyStateProps = {
  title: string;
  description: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
};

function EmptyState({ title, description, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {icon && <img src={icon} alt="" />}
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
