import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X, Car } from 'lucide-react';
import { getVehicles, getCustomers, createVehicle, updateVehicle, deleteVehicle } from '../api';
import Select from '../components/Select';

function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    customer_id: '', plate_number: '', make: '', model: '', year: '',
    vin: '', color: '', engine_type: '', transmission: '', odometer: '', notes: '',
    category: 'Asian'
  });

  useEffect(() => {
    loadData();
  }, [searchTerm]);

  const loadData = async () => {
    try {
      const [vehiclesRes, customersRes] = await Promise.all([
        getVehicles({ search: searchTerm }),
        getCustomers()
      ]);
      setVehicles(vehiclesRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, formData);
      } else {
        await createVehicle(formData);
      }
      setShowModal(false);
      setEditingVehicle(null);
      resetForm();
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save vehicle');
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '', plate_number: '', make: '', model: '', year: '',
      vin: '', color: '', engine_type: '', transmission: '', odometer: '', notes: '',
      category: 'Asian'
    });
  };

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      customer_id: vehicle.customer_id,
      plate_number: vehicle.plate_number || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year || '',
      vin: vehicle.vin || '',
      color: vehicle.color || '',
      engine_type: vehicle.engine_type || '',
      transmission: vehicle.transmission || '',
      odometer: vehicle.odometer || '',
      notes: vehicle.notes || '',
      category: vehicle.category || 'Asian'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await deleteVehicle(id);
        loadData();
      } catch (error) {
        console.error('Failed to delete vehicle:', error);
      }
    }
  };

  const openNewModal = () => {
    setEditingVehicle(null);
    resetForm();
    setShowModal(true);
  };

  return (
    <>
      <header className="main-header">
        <h1 className="page-title">Vehicles</h1>
        <button className="btn btn-primary" onClick={openNewModal}>
          <Plus size={18} />
          Add Vehicle
        </button>
      </header>
      
      <div className="main-body">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Search by plate, make, model, or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : vehicles.length === 0 ? (
            <div className="empty-state">
              <Car size={64} />
              <h3>No vehicles yet</h3>
              <p>Add your first vehicle to get started</p>
              <button className="btn btn-primary" onClick={openNewModal} style={{ marginTop: '1rem' }}>
                <Plus size={18} /> Add Vehicle
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Plate Number</th>
                    <th>Make & Model</th>
                    <th>Year</th>
                    <th>Color</th>
                    <th>Owner</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(vehicle => (
                    <tr key={vehicle.id}>
                      <td>
                        <Link to={`/vehicles/${vehicle.id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '600' }}>
                          {vehicle.plate_number}
                        </Link>
                      </td>
                      <td>{vehicle.make} {vehicle.model}</td>
                      <td>{vehicle.year}</td>
                      <td>{vehicle.color || '-'}</td>
                      <td>
                        <Link to={`/customers/${vehicle.customer_id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {vehicle.customer_name}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(vehicle)}>
                            Edit
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(vehicle.id)} style={{ color: 'var(--danger)' }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <Select
                    label="Owner"
                    required
                    value={formData.customer_id}
                    onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                    name="customer_id"
                    placeholder="Select Customer"
                    options={customers.map(c => ({ value: c.id, label: c.name }))}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Plate Number *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.plate_number}
                      onChange={(e) => setFormData({...formData, plate_number: e.target.value.toUpperCase()})}
                      required
                      placeholder="e.g. ABC-1234"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">VIN</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.vin}
                      onChange={(e) => setFormData({...formData, vin: e.target.value})}
                      placeholder="Vehicle Identification Number"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category (For Labor Rates)</label>
                    <select
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="Asian">Asian (Toyota, Honda, etc.)</option>
                      <option value="European">European (BMW, Benz, etc.)</option>
                      <option value="American">American (Ford, Chev, etc.)</option>
                      <option value="Indian">Indian (Tata, Maruti, etc.)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Make *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.make}
                      onChange={(e) => setFormData({...formData, make: e.target.value})}
                      required
                      placeholder="e.g. Toyota"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Model *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                      required
                      placeholder="e.g. Corolla"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                      placeholder="e.g. 2020"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Color</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Engine Type</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.engine_type}
                      onChange={(e) => setFormData({...formData, engine_type: e.target.value})}
                      placeholder="e.g. 1.8L Petrol"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Transmission</label>
                    <select
                      className="form-control"
                      value={formData.transmission}
                      onChange={(e) => setFormData({...formData, transmission: e.target.value})}
                    >
                      <option value="">Select</option>
                      <option value="Manual">Manual</option>
                      <option value="Automatic">Automatic</option>
                      <option value="CVT">CVT</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Current Odometer (km)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.odometer}
                      onChange={(e) => setFormData({...formData, odometer: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingVehicle ? 'Update' : 'Add'} Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Vehicles;
