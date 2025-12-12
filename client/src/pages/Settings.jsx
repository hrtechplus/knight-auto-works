import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { getSettings, updateSettings } from '../api';

function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <>
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

          {/* App Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">About</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', 
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <SettingsIcon size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>Knight Auto Works</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Workshop Management System</div>
                </div>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <p>Version 1.0.0</p>
                <p style={{ marginTop: '0.5rem' }}>Built with React + Express + SQLite</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Settings;
