import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, User, Calendar, Gauge } from 'lucide-react';
import { getVehicle } from '../api';

function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicle();
  }, [id]);

  const loadVehicle = async () => {
    try {
      const res = await getVehicle(id);
      setVehicle(res.data);
    } catch (error) {
      console.error('Failed to load vehicle:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!vehicle) {
    return (
      <div className="main-body">
        <div className="empty-state">
          <h3>Vehicle not found</h3>
          <Link to="/vehicles" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Back to Vehicles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/vehicles')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{vehicle.plate_number}</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {vehicle.make} {vehicle.model} {vehicle.year}
            </div>
          </div>
        </div>
        <Link to="/jobs" className="btn btn-primary">
          <Wrench size={18} /> Create Job
        </Link>
      </header>
      
      <div className="main-body">
        <div className="detail-grid">
          {/* Vehicle Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Vehicle Details</h3>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="info-group">
                  <div className="info-label">Make</div>
                  <div className="info-value">{vehicle.make}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Model</div>
                  <div className="info-value">{vehicle.model}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Year</div>
                  <div className="info-value">{vehicle.year || '-'}</div>
                </div>
              </div>
              <div className="form-row">
                <div className="info-group">
                  <div className="info-label">Color</div>
                  <div className="info-value">{vehicle.color || '-'}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Transmission</div>
                  <div className="info-value">{vehicle.transmission || '-'}</div>
                </div>
                <div className="info-group">
                  <div className="info-label">Engine</div>
                  <div className="info-value">{vehicle.engine_type || '-'}</div>
                </div>
              </div>
              {vehicle.vin && (
                <div className="info-group">
                  <div className="info-label">VIN</div>
                  <div className="info-value" style={{ fontFamily: 'monospace' }}>{vehicle.vin}</div>
                </div>
              )}
              <div className="info-group">
                <div className="info-label">Odometer</div>
                <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Gauge size={16} /> {(vehicle.odometer || 0).toLocaleString()} km
                </div>
              </div>
            </div>
          </div>

          {/* Owner Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Owner</h3>
            </div>
            <div className="card-body">
              <div className="info-group">
                <div className="info-label">Name</div>
                <div className="info-value">
                  <Link to={`/customers/${vehicle.customer_id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={16} /> {vehicle.customer_name}
                  </Link>
                </div>
              </div>
              {vehicle.customer_phone && (
                <div className="info-group">
                  <div className="info-label">Phone</div>
                  <div className="info-value">{vehicle.customer_phone}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Service History */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Service History ({vehicle.jobs?.length || 0})</h3>
          </div>
          {vehicle.jobs?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Job #</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicle.jobs.map(job => (
                    <tr key={job.id}>
                      <td>
                        <Link to={`/jobs/${job.id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '500' }}>
                          {job.job_number}
                        </Link>
                      </td>
                      <td>{new Date(job.created_at).toLocaleDateString()}</td>
                      <td>{job.description || '-'}</td>
                      <td>
                        <span className={`badge badge-${job.status}`}>{job.status.replace('_', ' ')}</span>
                      </td>
                      <td className="currency">Rs. {(job.total_cost || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-body">
              <div className="empty-state" style={{ padding: '2rem' }}>
                <Wrench size={48} />
                <p>No service history yet</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default VehicleDetail;
