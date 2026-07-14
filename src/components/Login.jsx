import React, { useState } from 'react';
import { Lock, Mail, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Invalid credentials or inactive account.');
        }
        return res.json();
      })
      .then(data => {
        setLoading(false);
        if (data.success) {
          onLoginSuccess(data.user);
        }
      })
      .catch(err => {
        setLoading(false);
        setError(err.message || 'Failed to authenticate. Please try again.');
      });
  };

  const handleQuickLogin = (quickEmail, quickPassword) => {
    setEmail(quickEmail);
    setPassword(quickPassword);
    setError('');
  };

  const demoAccounts = [
    { label: 'Admin (Sarah)', email: 'sarah.admin@designbase.com', pw: 'admin123', bg: 'var(--danger)' },
    { label: 'Manager (Clara)', email: 'clara.manager@designbase.com', pw: 'manager123', bg: 'var(--primary)' },
    { label: 'Stylist (Emma)', email: 'emma.stylist@designbase.com', pw: 'stylist123', bg: 'var(--info)' },
    { label: 'Crew (Dave)', email: 'dave.crew@designbase.com', pw: 'crew123', bg: 'var(--success)' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 10% 20%, #171c2f 0%, #0d101a 90%)',
      padding: '24px'
    }}>
      <div style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent) 0%, #a78bfa 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 30px rgba(115, 98, 255, 0.3)'
          }}>
            <ShieldCheck size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.03em', background: 'linear-gradient(to right, #fff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Sales by Design
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Home Staging & Logistics CRM Operations Suite</p>
        </div>

        {/* Login Card */}
        <div className="card" style={{ padding: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', color: '#fff' }}>Staff Sign In</h2>

          {error && (
            <div className="conflict-warning-badge" style={{ marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={18} color="var(--danger)" />
              <div style={{ color: 'var(--danger)', fontSize: '12px' }}>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} color="var(--text-muted)" /> Email Address
              </label>
              <input
                type="email"
                placeholder="you@designbase.com"
                className="input-control"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={14} color="var(--text-muted)" /> Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input-control"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px'
              }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : (
                <>
                  Sign In <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Fast Login Tags */}
        <div className="card" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '12px', fontWeight: '600' }}>
            Demo Account Quick-Select
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {demoAccounts.map((account, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '8px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderLeft: `3px solid ${account.bg}`
                }}
                onClick={() => handleQuickLogin(account.email, account.pw)}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
