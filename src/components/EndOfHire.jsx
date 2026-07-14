import React, { useState, useEffect } from 'react';
import { Clock, Home, BadgePercent, AlertTriangle, Calendar, Award, CheckCircle2, X } from 'lucide-react';

export default function EndOfHire({ onNavigateToJob }) {
  const [jobs, setJobs] = useState([]);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showSoldModal, setShowSoldModal] = useState(false);

  const [activeJobId, setActiveJobId] = useState(null);
  
  // Extension state
  const [extensionForm, setExtensionForm] = useState({
    new_end_date: '',
    extension_type: 'fixed' // 'fixed' | 'week-to-week'
  });
  const [extensionConflicts, setExtensionConflicts] = useState([]);

  // Sold state
  const [soldForm, setSoldForm] = useState({
    deinstall_date: ''
  });

  const fetchData = () => {
    fetch('/api/end-of-hire')
      .then(res => res.json())
      .then(data => setJobs(data));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openExtendModal = (jobId) => {
    setActiveJobId(jobId);
    setExtensionConflicts([]);
    setExtensionForm({ new_end_date: '', extension_type: 'fixed' });
    setShowExtendModal(true);
  };

  const openSoldModal = (jobId) => {
    setActiveJobId(jobId);
    setSoldForm({ deinstall_date: '' });
    setShowSoldModal(true);
  };

  const handleExtendSubmit = (e) => {
    e.preventDefault();
    fetch(`/api/jobs/${activeJobId}/extend-hire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extensionForm)
    })
      .then(res => res.json())
      .then(res => {
        if (res.conflicts && res.conflicts.length > 0) {
          // Display conflicts and do not close modal automatically
          setExtensionConflicts(res.conflicts);
        } else {
          fetchData();
          setShowExtendModal(false);
          alert('Hire period extended successfully.');
        }
      })
      .catch(err => console.error(err));
  };

  const handleSoldSubmit = (e) => {
    e.preventDefault();
    fetch(`/api/jobs/${activeJobId}/sold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deinstall_date: soldForm.deinstall_date })
    })
      .then(res => res.json())
      .then(() => {
        fetchData();
        setShowSoldModal(false);
        alert('Property marked as sold and de-stage pickup scheduled.');
      })
      .catch(err => console.error(err));
  };

  // Helper to check deadline warning intensity
  const getDeadlineAlert = (endDateStr) => {
    if (!endDateStr) return { color: 'badge-secondary', text: 'No end date' };
    const today = new Date();
    const end = new Date(endDateStr);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return { color: 'badge-danger', text: `${diffDays} days left` };
    if (diffDays <= 14) return { color: 'badge-warning', text: `${diffDays} days left` };
    return { color: 'badge-success', text: `${diffDays} days left` };
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>End of Hire Tracker</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Monitor hire completions, extensions, and sold stages to organize de-installation runs.</p>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Staged Address</th>
                <th>Current End Date</th>
                <th>Status</th>
                <th>Alert Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => {
                const alertInfo = getDeadlineAlert(job.hire_end_date);
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: '600' }}>{job.client_name}</td>
                    <td>{job.client_address}</td>
                    <td>{job.hire_end_date || 'TBC'}</td>
                    <td>
                      <span className={`badge ${
                        job.status === 'Extended' ? 'badge-primary' :
                        job.status === 'De-install Scheduled' ? 'badge-info' :
                        'badge-success'
                      }`}>{job.status}</span>
                      {job.extension_type === 'week-to-week' && (
                        <span className="badge badge-warning" style={{ fontSize: '9px', marginLeft: '4px' }}>Week-to-week</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${alertInfo.color}`}>{alertInfo.text}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => onNavigateToJob(job.id)}>
                          View
                        </button>
                        {job.status !== 'De-install Scheduled' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => openExtendModal(job.id)}>
                              Extend
                            </button>
                            <button className="btn btn-success btn-sm" onClick={() => openSoldModal(job.id)}>
                              Mark Sold
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                    No active hire jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extension Modal (US-6.3, Section 10) */}
      {showExtendModal && (
        <div className="modal-backdrop">
          <form onSubmit={handleExtendSubmit} className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Extend Client Staging Contract</h3>
              <button type="button" className="modal-close" onClick={() => setShowExtendModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Extension Pricing Mode</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className={`btn ${extensionForm.extension_type === 'fixed' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setExtensionForm(prev => ({ ...prev, extension_type: 'fixed' }))}
                  >
                    Set New Fixed Date
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${extensionForm.extension_type === 'week-to-week' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setExtensionForm(prev => ({ ...prev, extension_type: 'week-to-week', new_end_date: '' }))}
                  >
                    Week-to-Week Pending
                  </button>
                </div>
              </div>

              {extensionForm.extension_type === 'fixed' && (
                <div className="form-group">
                  <label className="form-label">New Staging End Date *</label>
                  <input 
                    type="date" 
                    className="input-control" 
                    required 
                    value={extensionForm.new_end_date}
                    onChange={(e) => setExtensionForm(prev => ({ ...prev, new_end_date: e.target.value }))}
                  />
                </div>
              )}

              {/* Sourcing conflicts alert banner (US-6.3, Section 10) */}
              {extensionConflicts.length > 0 && (
                <div className="conflict-warning-badge" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Extension Inventory Conflict!</strong>
                    <p style={{ fontSize: '11px', marginTop: '2px' }}>The following jobs are scheduled to pickup or source items from this property before the new extension date:</p>
                    <ul style={{ paddingLeft: '14px', marginTop: '6px', fontSize: '10px' }}>
                      {extensionConflicts.map((conf, i) => (
                        <li key={i}>
                          Job-{conf.jobId} ({conf.client}) expects: <strong>{conf.item}</strong> on {conf.installationDate}
                        </li>
                      ))}
                    </ul>
                    <p style={{ fontSize: '10px', marginTop: '6px', fontWeight: '700' }}>Please relocate inventory replacements or adjust dates before finalizing.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowExtendModal(false)}>
                {extensionConflicts.length > 0 ? 'Dismiss Conflict' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={extensionForm.extension_type === 'fixed' && !extensionForm.new_end_date}
              >
                Confirm Extension
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mark Sold Modal (US-6.3, Section 10) */}
      {showSoldModal && (
        <div className="modal-backdrop">
          <form onSubmit={handleSoldSubmit} className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Property Marked as Sold</h3>
              <button type="button" className="modal-close" onClick={() => setShowSoldModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Marking this property as sold. Please schedule the furniture de-stage pickup date.</p>
              
              <div className="form-group">
                <label className="form-label">De-stage / Removal Date *</label>
                <input 
                  type="date" 
                  className="input-control" 
                  required 
                  value={soldForm.deinstall_date}
                  onChange={(e) => setSoldForm(prev => ({ ...prev, deinstall_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowSoldModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-success">Confirm Sale & Schedule</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
