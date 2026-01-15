import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, Shield } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { ToastContainer, useToast } from '../components/Toast';
import { getSettings, updateSettings } from '../api';

function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await getSettings();
      setSettings(res.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const [backupLoading, setBackupLoading] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const handleBackupClick = () => {
    setShowBackupConfirm(true);
  };

  const proceedWithBackup = async () => {
    setShowBackupConfirm(false);
    setBackupLoading(true);
    try {
      const { triggerBackup } = await import('../api');
      const res = await triggerBackup();
      
      // Blob Download Logic (Server returns binary Excel file)
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from header or default
      const contentDisposition = res.headers['content-disposition'];
      let fileName = 'KAW_Backup.xlsx';
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1];
      }
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      // Update local state to show new date immediately
      setSettings(prev => ({
        ...prev,
        last_backup_at: new Date().toISOString()
      }));

      addToast('Excel backup downloaded successfully!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Failed to generate backup: ' + (error.response?.data?.error?.message || error.message), 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <header className="main-header">
        <h1 className="page-title">Settings</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={18} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </header>
      
      <div className="main-body">
        <div className="detail-grid">
          {/* Business Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Business Information</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.business_name || ''}
                  onChange={(e) => setSettings({...settings, business_name: e.target.value})}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Currency Code</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.currency || ''}
                    onChange={(e) => setSettings({...settings, currency: e.target.value})}
                    placeholder="LKR"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency Symbol</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.currency_symbol || ''}
                    onChange={(e) => setSettings({...settings, currency_symbol: e.target.value})}
                    placeholder="Rs."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pricing & Tax</h3>
            </div>
            <div className="card-body">
                <label className="form-label" style={{ marginBottom: '1rem', display: 'block' }}>Labor Rates (Rs. per hour)</label>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Asian (Toyota, Honda)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.labor_rate_asian || '1500'}
                      onChange={(e) => setSettings({...settings, labor_rate_asian: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">European (BMW, Benz)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.labor_rate_european || '2500'}
                      onChange={(e) => setSettings({...settings, labor_rate_european: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">American (Ford, Jeep)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.labor_rate_american || '2000'}
                      onChange={(e) => setSettings({...settings, labor_rate_american: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Indian (Tata, Maruti)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.labor_rate_indian || '1200'}
                      onChange={(e) => setSettings({...settings, labor_rate_indian: e.target.value})}
                    />
                  </div>
                </div>
              <div className="form-group">
                <label className="form-label">Tax Rate (%)</label>
                <input
                  type="number"
                  className="form-control"
                  value={settings.tax_rate || ''}
                  onChange={(e) => setSettings({...settings, tax_rate: e.target.value})}
                  placeholder="0"
                />
                <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Set to 0 if no tax applies. You can update this later when ready.
                </small>
              </div>
            </div>
          </div>

          {/* Number Prefixes */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Number Formats</h3>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Job Number Prefix</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.job_prefix || ''}
                    onChange={(e) => setSettings({...settings, job_prefix: e.target.value})}
                    placeholder="KAW"
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Example: {settings.job_prefix || 'KAW'}-2024-0001
                  </small>
                </div>
                <div className="form-group">
                  <label className="form-label">Invoice Number Prefix</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.invoice_prefix || ''}
                    onChange={(e) => setSettings({...settings, invoice_prefix: e.target.value})}
                    placeholder="INV"
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Example: {settings.invoice_prefix || 'INV'}-2024-0001
                  </small>
                </div>
              </div>
            </div>
          </div>



          {/* System Backup */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">System Data</h3>
            </div>
            <div className="card-body">
              {(!settings.last_backup_at || (new Date() - new Date(settings.last_backup_at)) / (1000 * 60 * 60 * 24) > 7) && (
                <div style={{ 
                  background: 'rgba(234, 179, 8, 0.1)', 
                  color: 'var(--warning)', 
                  padding: '0.75rem', 
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  <Shield size={16} />
                  <span>Warning: No recent backup found. Please download a backup.</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  Download a complete copy of your business data (Excel format).
                </p>
                {settings.last_backup_at && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Last Backup: {new Date(settings.last_backup_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <button 
                className="btn btn-secondary" 
                onClick={handleBackupClick} 
                disabled={backupLoading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {backupLoading ? 'Generating Backup...' : 'Download Data Backup'}
              </button>
            </div>
          </div>

          {/* App Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">About</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div className="logo-icon">
                  <img src="/bg-removed_logo_small.png" alt="Knight Auto Works" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1rem', whiteSpace: 'nowrap' }}>Knight Auto Works</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Workshop Management System</div>
                </div>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <p>Version 1.0.0</p>
              </div>
              
              {/* Developer Credits */}
              <div style={{ 
                marginTop: '1.5rem', 
                paddingTop: '1.5rem', 
                borderTop: '1px solid var(--border)'
              }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  color: 'var(--text-muted)',
                  marginBottom: '0.75rem'
                }}>
                  Developer
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '600',
                    color: 'white',
                    fontSize: '1rem'
                  }}>
                    H
                  </div>
                  <div>
                    <div style={{ fontWeight: '500' }}>Hasindu</div>
                    <a 
                      href="https://hasidu.live/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: 'var(--primary)', 
                        textDecoration: 'none',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      hasidu.live
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showBackupConfirm}
        onClose={() => setShowBackupConfirm(false)}
        onConfirm={proceedWithBackup}
        title="Download Data Backup"
        message="This will generate a complete Excel backup of your Customers, Jobs, Invoices, and Inventory. This process might take a few seconds."
        confirmText="Download Backup"
        confirmColor="primary"
      />
    </>
  );
}

export default Settings;
