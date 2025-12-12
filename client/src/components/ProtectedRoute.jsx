import { Navigate } from 'react-router-dom';
import { getStoredUser } from '../api';

const ProtectedRoute = ({ children, roles = [] }) => {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="empty-state">
        <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
        <button 
          className="btn btn-primary" 
          onClick={() => window.history.back()}
          style={{ marginTop: '1rem' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
