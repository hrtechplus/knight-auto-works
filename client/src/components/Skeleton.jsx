/**
 * Skeleton Loading Component
 * Displays animated placeholder content while data is loading
 */

export function Skeleton({ width = '100%', height = '1rem', variant = 'text', className = '' }) {
  const variantClass = `skeleton-${variant}`;
  
  return (
    <div 
      className={`skeleton ${variantClass} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <Skeleton variant="circle" width="48px" height="48px" />
        <div className="skeleton-card-header-text">
          <Skeleton width="60%" height="1.25rem" />
          <Skeleton width="40%" height="0.875rem" />
        </div>
      </div>
      <div className="skeleton-card-body">
        <Skeleton width="100%" height="0.875rem" />
        <Skeleton width="80%" height="0.875rem" />
        <Skeleton width="90%" height="0.875rem" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${80 + Math.random() * 40}px`} height="0.75rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              width={colIndex === 0 ? '120px' : `${60 + Math.random() * 80}px`} 
              height="0.875rem" 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="stat-card skeleton-stat-card">
      <Skeleton variant="circle" width="56px" height="56px" />
      <div className="stat-content">
        <Skeleton width="80px" height="2rem" />
        <Skeleton width="100px" height="0.875rem" />
      </div>
    </div>
  );
}
