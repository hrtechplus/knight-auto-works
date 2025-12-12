import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X, Wrench, Filter } from 'lucide-react';
import { getJobs, getVehicles, createJob } from '../api';
import { useToast, ToastContainer } from '../components/Toast';
import { SkeletonTable } from '../components/Skeleton';
import Select from '../components/Select';

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '', description: '', priority: 'normal', technician: '', odometer_in: ''
  });

  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    loadData();
  }, [searchTerm, filter]); // Updated dependency array

  const loadData = async () => {
    try {
      setLoading(true); // Always set loading to true when data is being loaded
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filter) params.status = filter; // Use 'filter' instead of 'statusFilter'
      
      const [jobsRes, vehiclesRes] = await Promise.all([
        getJobs(params),
        getVehicles() // Initial load of vehicles without search
      ]);
      setJobs(jobsRes.data);
      setVehicles(vehiclesRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      addToast('Failed to load jobs data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSearch = async (term) => {
    try {
      setVehiclesLoading(true);
      const res = await getVehicles({ search: term });
      setVehicles(res.data);
    } catch (error) {
      console.error('Failed to search vehicles:', error);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createJob(formData);
      setShowModal(false);
      setFormData({ vehicle_id: '', description: '', priority: 'normal', technician: '', odometer_in: '' });
      addToast('Job created successfully!', 'success');
      loadData();
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to create job';
      addToast(msg, 'error');
    }
  };

  const statuses = ['pending', 'in_progress', 'completed', 'invoiced'];

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <header className="main-header">
        <h1 className="page-title">Jobs</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          New Job
        </button>
      </header>
      
      <div className="main-body">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="tabs">
            <button 
              className={`tab ${filter === '' ? 'active' : ''}`}
              onClick={() => setFilter('')}
            >
              All
            </button>
            {statuses.map(status => (
              <button 
                key={status}
                className={`tab ${filter === status ? 'active' : ''}`}
                onClick={() => setFilter(status)}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: '1.5rem' }}>
              <SkeletonTable rows={5} columns={7} />
            </div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <Wrench size={64} />
              <h3>No jobs found</h3>
              <p>Create your first job to get started</p>
              <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: '1rem' }}>
                <Plus size={18} /> New Job
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Job #</th>
                    <th>Vehicle</th>
                    <th>Customer</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id}>
                      <td>
                        <Link to={`/jobs/${job.id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '600' }}>
                          {job.job_number}
                        </Link>
                      </td>
                      <td>
                        <div>{job.plate_number}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {job.make} {job.model}
                        </div>
                      </td>
                      <td>{job.customer_name}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.description || '-'}
                      </td>
                      <td>
                        <span className={`badge badge-${job.priority}`}>{job.priority}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${job.status}`}>{job.status.replace('_', ' ')}</span>
                      </td>
                      <td className="currency">Rs. {(job.total_cost || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Job Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Job</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <Select
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({...formData, vehicle_id: e.target.value})}
                    name="vehicle_id"
                    required
                    placeholder="Search Vehicle (Plate, Make, Model...)"
                    onSearch={handleVehicleSearch}
                    isLoading={vehiclesLoading}
                    options={vehicles.map(v => ({
                      value: v.id,
                      label: `${v.plate_number} - ${v.make} ${v.model} (${v.customer_name})`
                    }))}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe the work to be done..."
                    rows={3}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <Select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      name="priority"
                      options={[
                        { value: 'low', label: 'Low' },
                        { value: 'normal', label: 'Normal' },
                        { value: 'high', label: 'High' },
                        { value: 'urgent', label: 'Urgent' }
                      ]}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Technician</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.technician}
                      onChange={(e) => setFormData({...formData, technician: e.target.value})}
                      placeholder="Assigned technician"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Odometer Reading (km)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.odometer_in}
                    onChange={(e) => setFormData({...formData, odometer_in: e.target.value})}
                    placeholder="Current odometer reading"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Jobs;
