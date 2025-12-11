import { useState } from 'react';
import { Lock, User, AlertCircle, Wrench } from 'lucide-react';
import { login } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(username, password);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
      padding: '1rem'
    }}>
      <div className="login-card" style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid var(--border)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 40px rgba(249, 115, 22, 0.3)'
          }}>
            <img 
              src="/logoknight.jpg" 
              alt="Knight Auto Works" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px'
          }}>
            Knight Auto Works
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            Sign in to your account
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--danger)'
          }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem' 
            }}>
              <User size={16} />
              Username
            </label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
              style={{ fontSize: '1rem', padding: '0.875rem 1rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem' 
            }}>
              <Lock size={16} />
              Password
            </label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{ fontSize: '1rem', padding: '0.875rem 1rem' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              fontSize: '1rem',
              justifyContent: 'center'
            }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ 
                  width: '18px', 
                  height: '18px',
                  borderWidth: '2px'
                }}></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Default credentials hint */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <strong>Default credentials:</strong><br />
          Username: <code>admin</code><br />
          Password: <code>admin123</code>
        </div>
      </div>
    </div>
  );
}
