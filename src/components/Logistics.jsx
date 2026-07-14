import React, { useState, useEffect } from 'react';
import { Calendar, Truck, User, Clock, AlertTriangle, Play, MapPin, CheckCircle, Navigation, ShieldAlert, Plus, X } from 'lucide-react';

export default function Logistics() {
  const [logisticsTab, setLogisticsTab] = useState('planning'); // 'planning' | 'live'
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const [installs, setInstalls] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [runs, setRuns] = useState([]);
  
  const [staff, setStaff] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    jobsSelected: [],
    vehicle_id: '',
    crew_ids: []
  });

  // Assign Stylist Modal
  const [showStylistModal, setShowStylistModal] = useState(false);
  const [selectedJobForStylist, setSelectedJobForStylist] = useState(null);
  const [stylistId, setStylistId] = useState('');

  const fetchLogistics = () => {
    fetch(`/api/logistics/day?date=${selectedDate}`)
      .then(res => res.json())
      .then(data => {
        setInstalls(data.installs || []);
        setPickups(data.pickups || []);
        setRuns(data.runs || []);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchLogistics();
    
    // Fetch static resources
    fetch('/api/staff').then(res => res.json()).then(data => setStaff(data));
    fetch('/api/vehicles').then(res => res.json()).then(data => setVehicles(data));
  }, [selectedDate]);

  const handleCheckboxJob = (jobId, isInstall) => {
    const exists = assignForm.jobsSelected.find(js => js.job_id === jobId);
    if (exists) {
      setAssignForm(prev => ({
        ...prev,
        jobsSelected: prev.jobsSelected.filter(js => js.job_id !== jobId)
      }));
    } else {
      setAssignForm(prev => ({
        ...prev,
        jobsSelected: [...prev.jobsSelected, { job_id: jobId, stop_type: isInstall ? 'Install' : 'De-install' }]
      }));
    }
  };

  const handleCrewToggle = (crewId) => {
    const exists = assignForm.crew_ids.includes(crewId);
    if (exists) {
      setAssignForm(prev => ({
        ...prev,
        crew_ids: prev.crew_ids.filter(id => id !== crewId)
      }));
    } else {
      setAssignForm(prev => ({
        ...prev,
        crew_ids: [...prev.crew_ids, crewId]
      }));
    }
  };

  const submitRunAssignment = (e) => {
    e.preventDefault();
    fetch('/api/logistics/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_date: selectedDate,
        vehicle_id: parseInt(assignForm.vehicle_id),
        crew_ids: assignForm.crew_ids.map(Number),
        stops: assignForm.jobsSelected
      })
    })
      .then(res => res.json())
      .then(() => {
        fetchLogistics();
        setShowAssignModal(false);
        setAssignForm({ jobsSelected: [], vehicle_id: '', crew_ids: [] });
      })
      .catch(err => console.error(err));
  };

  const openStylistModal = (job) => {
    setSelectedJobForStylist(job);
    setStylistId(job.stylist_id || '');
    setShowStylistModal(true);
  };

  const submitStylistAssignment = (e) => {
    e.preventDefault();
    fetch(`/api/jobs/${selectedJobForStylist.id}/logistics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stylist_id: parseInt(stylistId),
        styling_visit_date: selectedDate
      })
    })
      .then(res => res.json())
      .then(() => {
        fetchLogistics();
        setShowStylistModal(false);
        setSelectedJobForStylist(null);
      })
      .catch(err => console.error(err));
  };

  // Crew filter for assignment
  const crewStaff = staff.filter(s => s.role === 'Removalist Crew');
  const stylistsStaff = staff.filter(s => s.role === 'Stylist');

  return (
    <div>
      {/* Navigation Headers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${logisticsTab === 'planning' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLogisticsTab('planning')}
          >
            Logistics Planner
          </button>
          <button 
            className={`btn ${logisticsTab === 'live' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLogisticsTab('live')}
          >
            Live Runs Progress
          </button>
        </div>

        {/* Date Selector */}
        <div className="role-switcher-container">
          <Calendar size={14} color="var(--text-muted)" />
          <span className="role-switcher-label">Schedule Date:</span>
          <input 
            type="date" 
            className="role-select" 
            style={{ border: 'none', background: 'transparent', outline: 'none' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {logisticsTab === 'planning' ? (
        /* Planner View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Assignment Toolbar */}
          {assignForm.jobsSelected.length > 0 && (
            <div style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {assignForm.jobsSelected.length} job(s) selected for run sheet creation.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAssignModal(true)}>
                <Truck size={14} /> Assign Vehicle & Crew
              </button>
            </div>
          )}

          {/* Jobs Lists grids */}
          <div className="grid-2">
            {/* Installs Column */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }}></div>
                Installs Scheduled ({installs.length})
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {installs.map((job, idx) => {
                  const hasAttention = job.needs_attention_count > 0;
                  const isReady = job.not_sourced_count === 0 && !hasAttention;
                  return (
                    <div className="card" key={idx} style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <input 
                        type="checkbox" 
                        style={{ marginTop: '4px', cursor: 'pointer' }}
                        checked={!!assignForm.jobsSelected.find(js => js.job_id === job.id)}
                        onChange={() => handleCheckboxJob(job.id, true)}
                      />
                      <div style={{ flexGrow: 1 }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{job.client_name}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <MapPin size={12} /> {job.client_address}
                        </p>
                        
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <span className={`badge ${isReady ? 'badge-success' : 'badge-warning'}`}>
                            Inventory: {isReady ? 'Ready' : 'Incomplete'}
                          </span>
                          {hasAttention && (
                            <span className="badge badge-danger">
                              ⚠ {job.needs_attention_count} Flags
                            </span>
                          )}
                          <span className="badge badge-secondary">
                            Stylist: {job.stylist_name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => openStylistModal(job)}>
                        Assign Stylist
                      </button>
                    </div>
                  );
                })}
                {installs.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No installations scheduled for this day.</p>
                )}
              </div>
            </div>

            {/* Pickups / De-installs Column */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)' }}></div>
                De-installs & Pickups ({pickups.length})
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pickups.map((job, idx) => (
                  <div className="card" key={idx} style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <input 
                      type="checkbox" 
                      style={{ marginTop: '4px', cursor: 'pointer' }}
                      checked={!!assignForm.jobsSelected.find(js => js.job_id === job.id)}
                      onChange={() => handleCheckboxJob(job.id, false)}
                    />
                    <div style={{ flexGrow: 1 }}>
                      <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{job.client_name}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <MapPin size={12} /> {job.client_address}
                      </p>
                      
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <span className="badge badge-danger">De-stage Required</span>
                        <span className="badge badge-secondary">
                          Stylist: {job.stylist_name || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => openStylistModal(job)}>
                      Assign Stylist
                    </button>
                  </div>
                ))}
                {pickups.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No de-stages scheduled for this day.</p>
                )}
              </div>
            </div>
          </div>

          {/* Configured Runs Section */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Configured Runs for {selectedDate}</h3>
            <div className="grid-2">
              {runs.map((run, idx) => (
                <div className="card" key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Truck size={18} color="var(--primary)" />
                      <strong style={{ fontSize: '15px' }}>{run.vehicle?.name || 'No Vehicle'} ({run.vehicle?.rego})</strong>
                    </div>
                    <span className={`badge ${run.status === 'Completed' ? 'badge-success' : run.status === 'Departed' ? 'badge-primary' : 'badge-secondary'}`}>
                      {run.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <strong>Crew: </strong> {run.crew.map(c => c.name).join(', ') || 'Unassigned'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {run.stops.map((stop, sIdx) => (
                      <div 
                        key={sIdx} 
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ fontSize: '12px' }}>
                          <strong>Stop {stop.stop_order}: </strong> {stop.stop_type} - {stop.client_name} ({stop.client_address.split(',')[0]})
                        </span>
                        <span className={`badge badge-secondary`} style={{ fontSize: '9px' }}>{stop.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {runs.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', gridColumn: 'span 2', textAlign: 'center', padding: '20px' }}>No runs configured yet. Select jobs above to create a run sheet.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Live Tracking View (US-5.5) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {runs.map((run, idx) => {
            // Calculate delay warning: if departed, and first arrived stop has been over 3.5 hours
            const hasDelay = run.status === 'Departed' && run.stops.find(s => s.status === 'Arrived');

            return (
              <div className="card" key={idx} style={{ padding: '20px', borderLeft: hasDelay ? '4px solid var(--warning)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Truck size={18} color="var(--primary)" /> Run on {run.vehicle?.name} ({run.vehicle?.rego})
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Crew: {run.crew.map(c => c.name).join(', ') || 'No crew'}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {hasDelay && (
                      <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> Crew on site {'>'} 3 hrs
                      </span>
                    )}
                    <span className={`badge ${run.status === 'Completed' ? 'badge-success' : run.status === 'Departed' ? 'badge-primary' : 'badge-secondary'}`}>
                      {run.status === 'Departed' ? 'Road Live' : run.status}
                    </span>
                  </div>
                </div>

                {/* Progress stops indicator */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${run.stops.length}, 1fr)`, gap: '16px' }}>
                  {run.stops.map((stop, sIdx) => {
                    const isArrived = stop.status === 'Arrived';
                    const isCompleted = stop.status === 'Departed';
                    return (
                      <div 
                        key={sIdx}
                        style={{
                          padding: '12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: isArrived ? 'var(--primary-glow)' : isCompleted ? 'rgba(16,185,129,0.02)' : 'transparent',
                          borderColor: isArrived ? 'var(--primary)' : isCompleted ? 'var(--success)' : 'var(--border)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stop {stop.stop_order}</span>
                          <span className={`badge ${isCompleted ? 'badge-success' : isArrived ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: '9px' }}>
                            {stop.status}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '13px', fontWeight: '700' }}>{stop.client_name} ({stop.stop_type})</h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{stop.client_address.split(',')[0]}</p>
                        
                        {(isArrived || isCompleted) && (
                          <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '6px' }}>
                            {stop.arrived_at && <div>Arrived: {stop.arrived_at.split(' ')[1]}</div>}
                            {stop.departed_at && <div>Departed: {stop.departed_at.split(' ')[1]}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {runs.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No runs configured for {selectedDate} yet.</p>
          )}
        </div>
      )}

      {/* Run Assignment Modal (US-5.2) */}
      {showAssignModal && (
        <div className="modal-backdrop">
          <form onSubmit={submitRunAssignment} className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Run Sheet</h3>
              <button type="button" className="modal-close" onClick={() => setShowAssignModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Create a run sheet for the {assignForm.jobsSelected.length} selected stop(s).</p>
              
              <div className="form-group">
                <label className="form-label">Select Vehicle *</label>
                <select 
                  className="input-control select-control" 
                  required
                  value={assignForm.vehicle_id}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, vehicle_id: e.target.value }))}
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map((v, i) => (
                    <option key={i} value={v.id}>{v.name} ({v.rego}) - {v.capacity_notes}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Crew Members (Removalist Crew) *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {crewStaff.map((c, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={assignForm.crew_ids.includes(c.id)}
                        onChange={() => handleCrewToggle(c.id)}
                      />
                      {c.name} ({c.phone})
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!assignForm.vehicle_id || assignForm.crew_ids.length === 0}>Generate Run Sheet</button>
            </div>
          </form>
        </div>
      )}

      {/* Stylist Assignment Modal */}
      {showStylistModal && selectedJobForStylist && (
        <div className="modal-backdrop">
          <form onSubmit={submitStylistAssignment} className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Assign Stylist</h3>
              <button type="button" className="modal-close" onClick={() => setShowStylistModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Assign Stylist for: {selectedJobForStylist.client_name}</label>
                <select 
                  className="input-control select-control" 
                  required
                  value={stylistId}
                  onChange={(e) => setStylistId(e.target.value)}
                >
                  <option value="">Select stylist...</option>
                  {stylistsStaff.map((s, i) => (
                    <option key={i} value={s.id}>{s.name} ({s.phone})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowStylistModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!stylistId}>Assign Stylist</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
