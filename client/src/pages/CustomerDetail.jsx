import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, Phone, Mail, MapPin, Edit, Plus, Wrench } from 'lucide-react';
import { getCustomer, updateCustomer } from '../api';
import Breadcrumb from '../components/Breadcrumb';
import Avatar from '../components/Avatar';
import { SkeletonCard } from '../components/Skeleton';

function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    try {
      const res = await getCustomer(id);
      setCustomer(res.data);
    } catch (error) {
      console.error('Failed to load customer:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="main-body">
        <div className="detail-grid">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="main-body">
        <div className="empty-state">
          <h3>Customer not found</h3>
          <Link to="/customers" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 className="page-title">{customer.name}</h1>
        </div>
      </header>
      
      <div className="main-body">
        <Breadcrumb items={[
          { label: 'Customers', to: '/customers' },
          { label: customer.name }
        ]} />
        
        <div className="detail-grid">
          {/* Customer Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Customer Information</h3>
            </div>
            <div className="card-body">
              {customer.phone && (
                <div className="info-group">
                  <div className="info-label">Phone</div>
                  <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Phone size={16} /> {customer.phone}
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="info-group">
                  <div className="info-label">Email</div>
                  <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Mail size={16} /> {customer.email}
                  </div>
                </div>
              )}
              {customer.address && (
                <div className="info-group">
                  <div className="info-label">Address</div>
                  <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={16} /> {customer.address}
                  </div>
                </div>
              )}
              {customer.notes && (
                <div className="info-group">
                  <div className="info-label">Notes</div>
                  <div className="info-value">{customer.notes}</div>
                </div>
              )}
            </div>
          </div>

          {/* Vehicles */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Vehicles ({customer.vehicles?.length || 0})</h3>
              <Link to="/vehicles" className="btn btn-primary btn-sm">
                <Plus size={16} /> Add Vehicle
              </Link>
            </div>
            {customer.vehicles?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Plate</th>
                      <th>Make & Model</th>
                      <th>Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.vehicles.map(vehicle => (
                      <tr key={vehicle.id}>
                        <td>
                          <Link to={`/vehicles/${vehicle.id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none', fontWeight: '500' }}>
                            {vehicle.plate_number}
                          </Link>
                        </td>
                        <td>{vehicle.make} {vehicle.model}</td>
                        <td>{vehicle.year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-body">
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <Car size={48} />
                  <p>No vehicles registered</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invoices */}
        {customer.invoices?.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Invoice History</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.invoices.map(invoice => (
                    <tr key={invoice.id}>
                      <td>
                        <Link to={`/invoices/${invoice.id}`} style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td>{new Date(invoice.created_at).toLocaleDateString()}</td>
                      <td className="currency">Rs. {invoice.total.toLocaleString()}</td>
                      <td>
                        <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default CustomerDetail;
