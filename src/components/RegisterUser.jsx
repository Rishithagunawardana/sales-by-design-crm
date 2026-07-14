import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Mail, Lock, Phone, DollarSign, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export default function RegisterUser() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Stylist',
    phone: '',
    hourly_rate: ''
  });

  const fetchStaff = () => {
    fetch('/api/staff')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch staff list');
        return res.json();
      })
      .then(data => setStaffList(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name || !form.email || !form.password || !form.role) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    fetch('/api/staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(form)
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to register user.');
        }
        return data;
      })
      .then(data => {
        setLoading(false);
        setSuccess(`Successfully registered ${data.staff.name} as ${data.staff.role}!`);
        setForm({
          name: '',
          email: '',
          password: '',
          role: 'Stylist',
          phone: '',
          hourly_rate: ''
        });
        fetchStaff();
      })
      .catch(err => {
        setLoading(false);
        setError(err.message || 'Error occurred during registration.');
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Page Header */}
      <div style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>User & Staff Management</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Create new credentials and assign roles for stylists, managers, and crew members.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Registration Form */}
        <div className="card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'var(--card-bg)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <UserPlus size={18} color="var(--primary)" /> Register New User
          </h3>

          {error && (
            <div className="conflict-warning-badge" style={{ marginBottom: '16px', display: 'flex', gap: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
              <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ color: 'var(--danger)', fontSize: '12.5px' }}>{error}</span>
            </div>
          )}

          {success && (
            <div className="conflict-warning-badge" style={{ marginBottom: '16px', display: 'flex', gap: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ color: 'var(--success)', fontSize: '12.5px' }}>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: '500' }}>Full Name *</label>
              <input 
                type="text" 
                name="name" 
                placeholder="e.g. Jane Doe" 
                className="input-control" 
                required 
                value={form.name} 
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: '500' }}>Email Address *</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  name="email" 
                  placeholder="name@designbase.com" 
                  className="input-control" 
                  style={{ paddingLeft: '36px' }}
                  required 
                  value={form.email} 
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: '500' }}>Temporary Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  name="password" 
                  placeholder="••••••••" 
                  className="input-control" 
                  style={{ paddingLeft: '36px' }}
                  required 
                  value={form.password} 
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: '500' }}>Role *</label>
                <select 
                  name="role" 
                  className="input-control select-control" 
                  value={form.role} 
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="Stylist">Stylist</option>
                  <option value="Admin">Admin</option>
                  <option value="Head Stylist/Management">Head Stylist/Management</option>
                  <option value="Removalist Crew">Removalist Crew</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: '500' }}>Hourly Rate ($/hr)</label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                  <input 
                    type="number" 
                    step="0.01" 
                    name="hourly_rate" 
                    placeholder="35.00" 
                    className="input-control" 
                    style={{ paddingLeft: '36px' }}
                    value={form.hourly_rate} 
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-main)', fontWeight: '500' }}>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  name="phone" 
                  placeholder="0491 555 555" 
                  className="input-control" 
                  style={{ paddingLeft: '36px' }}
                  value={form.phone} 
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ padding: '10px', marginTop: '10px', fontWeight: '600' }}
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register User'}
            </button>
          </form>
        </div>

        {/* Right Side: Active Users List */}
        <div className="card" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <Users size={18} color="var(--primary)" /> Active Staff Directory
          </h3>

          <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Contact Info</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((staff, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: '600', color: '#fff' }}>{staff.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: Staff-{staff.id}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        staff.role === 'Admin' ? 'badge-danger' :
                        staff.role === 'Head Stylist/Management' ? 'badge-primary' :
                        staff.role === 'Stylist' ? 'badge-info' :
                        'badge-success'
                      }`}>
                        {staff.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>{staff.email}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{staff.phone || 'No phone'}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                        ${(staff.hourly_rate || 0).toFixed(2)}/hr
                      </span>
                    </td>
                  </tr>
                ))}
                {staffList.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No active staff found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Newly registered users can log in immediately using their email and the temporary password defined here. They will automatically be granted workspace layouts matching their role permissions.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
