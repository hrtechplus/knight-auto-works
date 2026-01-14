import { useState } from 'react';
import { Search, CheckCircle, Clock, AlertCircle, Package } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function TrackJob() {
  const [jobNumber, setJobNumber] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobData, setJobData] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setJobData(null);

    try {
      const response = await axios.get(`${API_BASE}/api/track-job`, {
        params: {
          job_number: jobNumber,
          plate: plateNumber
        }
      });
      setJobData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to track job. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={48} color="#22c55e" />;
      case 'in_progress':
        return <Clock size={48} color="#f59e0b" />;
      case 'invoiced':
        return <Package size={48} color="#3b82f6" />;
      default:
        return <AlertCircle size={48} color="#6b7280" />;
    }
  };

  const getStatusText = (status) => {
    return status.replace('_', ' ').toUpperCase();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        padding: '3rem',
        maxWidth: '500px',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1a1a1a', marginBottom: '0.5rem' }}>
            Track Your Job
          </h1>
          <p style={{ color: '#6b7280' }}>Enter your job details to check the status</p>
        </div>

        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
              Job Number
            </label>
            <input
              type="text"
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
              placeholder="e.g., KAW-2025-0001"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
              Vehicle Plate Number
            </label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="e.g., WP CAA-1234"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#9ca3af' : '#667eea',
              color: 'white',
              padding: '0.875rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = '#5568d3')}
            onMouseLeave={(e) => !loading && (e.target.style.background = '#667eea')}
          >
            <Search size={20} />
            {loading ? 'Searching...' : 'Track Job'}
          </button>
        </form>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '1rem',
            color: '#dc2626',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {jobData && (
          <div style={{
            background: '#f9fafb',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              {getStatusIcon(jobData.status)}
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a1a1a', marginTop: '1rem' }}>
                Status: {getStatusText(jobData.status)}
              </h3>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Job Number</span>
                <span style={{ fontWeight: '600', color: '#1a1a1a' }}>{jobData.job_number}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Vehicle</span>
                <span style={{ fontWeight: '600', color: '#1a1a1a' }}>{jobData.vehicle}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Started</span>
                <span style={{ fontWeight: '600', color: '#1a1a1a' }}>
                  {new Date(jobData.created_at).toLocaleDateString()}
                </span>
              </div>

              {jobData.completed_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Completed</span>
                  <span style={{ fontWeight: '600', color: '#1a1a1a' }}>
                    {new Date(jobData.completed_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {jobData.status === 'completed' && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: '#ecfdf5',
                borderRadius: '0.5rem',
                textAlign: 'center',
                color: '#065f46'
              }}>
                ✓ Your vehicle is ready for pickup!
              </div>
            )}

            {jobData.status === 'in_progress' && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: '#fff7ed',
                borderRadius: '0.5rem',
                textAlign: 'center',
                color: '#9a3412'
              }}>
                🔧 Work in progress. We'll notify you when complete.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
          Knight Auto Works • Professional Auto Care
        </div>
      </div>
    </div>
  );
}

export default TrackJob;
