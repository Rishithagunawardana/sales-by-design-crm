import React, { useState, useEffect } from 'react';
import { Truck, CheckSquare, Clock, MapPin, Key, Phone, Camera, AlertTriangle, UserCheck, ChevronRight, X, ArrowLeft } from 'lucide-react';

export default function CrewView() {
  const [crewMemberId, setCrewMemberId] = useState('');
  const [staffList, setStaffList] = useState([]);
  
  const [runs, setRuns] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [activeStopId, setActiveStopId] = useState(null);
  const [activeStopDetail, setActiveStopDetail] = useState(null);

  // Key tracking state
  const [keyState, setKeyState] = useState({
    status: 'Picked Up',
    current_holder: 'Crew',
    photo_url: ''
  });

  // Damage form state
  const [damageForm, setDamageForm] = useState({
    description: '',
    repair_cost: 0,
    recharged_to_client: false,
    photo_url: ''
  });

  const [showDamageForm, setShowDamageForm] = useState(false);

  useEffect(() => {
    fetch('/api/staff')
      .then(res => res.json())
      .then(data => setStaffList(data.filter(s => s.role === 'Removalist Crew')));
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    fetchCrewData();
  };

  const fetchCrewData = () => {
    if (!crewMemberId) return;
    fetch(`/api/runs/staff/${crewMemberId}`)
      .then(res => res.json())
      .then(data => {
        setRuns(data);
        if (data.length > 0) {
          setActiveRunId(data[0].id);
        }
      });
  };

  const loadStopDetail = (stopId) => {
    fetch(`/api/runs/${activeRunId}/stops/${stopId}`)
      .then(res => res.json())
      .then(data => {
        setActiveStopId(stopId);
        setActiveStopDetail(data);
        // Bind key states if keys already logged
        if (data.keys && data.keys.length > 0) {
          setKeyState({
            status: data.keys[0].status,
            current_holder: data.keys[0].current_holder,
            photo_url: data.keys[0].photo_url || ''
          });
        } else {
          setKeyState({ status: 'Picked Up', current_holder: 'Crew', photo_url: '' });
        }
      });
  };

  const handleToggleChecklist = (checkId, isChecked, isStopChecklist = false) => {
    fetch(`/api/checklists/${checkId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_checked: isChecked, checked_by: parseInt(crewMemberId) })
    })
      .then(res => res.json())
      .then(() => {
        fetchCrewData();
        if (isStopChecklist && activeStopId) {
          loadStopDetail(activeStopId);
        }
      });
  };

  const handleDepartWarehouse = () => {
    fetch(`/api/runs/${activeRunId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Departed' })
    })
      .then(res => res.json())
      .then(() => {
        fetchCrewData();
      });
  };

  const handleArriveAtStop = () => {
    fetch(`/api/runs/stops/${activeStopId}/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => res.json())
      .then(res => {
        loadStopDetail(activeStopId);
        fetchCrewData();
      });
  };

  // Submit keys update
  const handleUpdateKeys = (newStatus, newHolder) => {
    fetch(`/api/jobs/${activeStopDetail.job_id}/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        current_holder: newHolder,
        photo_url: keyState.photo_url
      })
    })
      .then(res => res.json())
      .then(() => {
        loadStopDetail(activeStopId);
      });
  };

  const handleAddDamage = (e) => {
    e.preventDefault();
    fetch(`/api/jobs/${activeStopDetail.job_id}/damage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(damageForm)
    })
      .then(res => res.json())
      .then(() => {
        loadStopDetail(activeStopId);
        setShowDamageForm(false);
        setDamageForm({ description: '', repair_cost: 0, recharged_to_client: false, photo_url: '' });
        alert('Damage record saved.');
      });
  };

  const handleDepartStop = () => {
    // Check if checklists completed
    const incompleteArrival = activeStopDetail.checklists.filter(c => c.type.includes('Arrival') && !c.is_checked);
    const incompleteDeparture = activeStopDetail.checklists.filter(c => c.type.includes('Departure') && !c.is_checked);

    if (incompleteArrival.length > 0 || incompleteDeparture.length > 0) {
      alert('Cannot depart stop. All arrival and departure checklists must be ticked off by the crew first.');
      return;
    }

    // Update keys one last time to Returned or Dropped off automatically for safety
    fetch(`/api/jobs/${activeStopDetail.job_id}/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: activeStopDetail.stop_type === 'Install' ? 'With Agent' : 'Returned',
        current_holder: activeStopDetail.stop_type === 'Install' ? 'Keysafe' : 'Agent'
      })
    }).catch(e => console.error(e));

    fetch(`/api/runs/stops/${activeStopId}/depart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => res.json())
      .then(() => {
        alert('Crew departure and sign-off recorded successfully.');
        setActiveStopId(null);
        setActiveStopDetail(null);
        fetchCrewData();
      });
  };

  // Main login view if not crew user selected
  if (!crewMemberId || runs.length === 0) {
    return (
      <div style={{ maxWidth: '400px', margin: '60px auto' }} className="card">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="logo-icon" style={{ margin: '0 auto 16px auto', width: '50px', height: '50px', borderRadius: 'var(--radius-md)', fontSize: '24px' }}>C</div>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Removalist Mobile Portal</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Log in to view your run sheet and daily checklists</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Crew Member</label>
            <select 
              className="input-control select-control" 
              required
              value={crewMemberId}
              onChange={(e) => setCrewMemberId(e.target.value)}
            >
              <option value="">Select your account...</option>
              {staffList.map((s, i) => (
                <option key={i} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Access Run Sheets
          </button>
        </form>
      </div>
    );
  }

  const activeRun = runs.find(r => r.id === activeRunId);

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '40px' }}>
      {!activeStopId ? (
        /* Run stops list */
        <div>
          {/* Crew Info Header */}
          <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="stat-label">Daily Run Portal</span>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Vehicle: {activeRun?.vehicle_name}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Crew: {activeRun?.crew.map(c => c.name.split(' ')[0]).join(', ')}</p>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => { setCrewMemberId(''); setRuns([]); }}>
              Log Out
            </button>
          </div>

          {/* Step 1: Warehouse Departure checklist (US-5.3) */}
          {activeRun?.status === 'Planned' && (
            <div className="card" style={{ padding: '20px', marginBottom: '20px', borderLeft: '4px solid var(--primary)' }}>
              <h4 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Clock size={16} color="var(--primary)" /> 1. Warehouse Departure Checks
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {activeRun?.warehouse_checklist.map((c, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      style={{ marginTop: '3px' }}
                      checked={c.is_checked === 1}
                      onChange={(e) => handleToggleChecklist(c.id, e.target.checked)}
                    />
                    <span style={{ color: c.is_checked ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: c.is_checked ? 'line-through' : 'none' }}>
                      {c.item_text}
                    </span>
                  </label>
                ))}
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                disabled={!activeRun?.warehouse_checklist.every(c => c.is_checked === 1)}
                onClick={handleDepartWarehouse}
              >
                Sign Off & Depart Warehouse
              </button>
            </div>
          )}

          {/* Stops List */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>Stops Checklist ({activeRun?.stops.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeRun?.stops.map((stop, sIdx) => {
                const isArrived = stop.status === 'Arrived';
                const isCompleted = stop.status === 'Departed';
                return (
                  <div 
                    key={sIdx}
                    onClick={() => activeRun.status !== 'Planned' && loadStopDetail(stop.id)}
                    className="card"
                    style={{
                      padding: '16px',
                      cursor: activeRun.status === 'Planned' ? 'not-allowed' : 'pointer',
                      borderLeft: isArrived ? '4px solid var(--primary)' : isCompleted ? '4px solid var(--success)' : '1px solid var(--border)',
                      opacity: activeRun.status === 'Planned' ? 0.6 : 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Stop {stop.stop_order}</span>
                        <span className={`badge ${stop.stop_type === 'Install' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '9px' }}>
                          {stop.stop_type}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', marginTop: '4px' }}>{stop.client_name}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <MapPin size={12} /> {stop.client_address.split(',')[0]}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge ${isCompleted ? 'badge-success' : isArrived ? 'badge-primary' : 'badge-secondary'}`}>
                        {stop.status}
                      </span>
                      {activeRun.status !== 'Planned' && <ChevronRight size={16} color="var(--text-muted)" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Stop Detail view (US-5.4) */
        activeStopDetail && (
          <div>
            {/* Header toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => { setActiveStopId(null); setActiveStopDetail(null); fetchCrewData(); }}>
                <ArrowLeft size={14} /> Back to Stops
              </button>
              <span className={`badge ${activeStopDetail.stop_type === 'Install' ? 'badge-success' : 'badge-danger'}`}>
                {activeStopDetail.stop_type} Stop
              </span>
            </div>

            {/* Address Card */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>{activeStopDetail.client_name}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} /> {activeStopDetail.client_address}
              </p>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                <a href={`tel:${activeStopDetail.client_phone}`} className="btn btn-secondary btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyCenter: 'center', gap: '6px' }}>
                  <Phone size={12} /> Call Client
                </a>
                {activeStopDetail.agent_phone && (
                  <a href={`tel:${activeStopDetail.agent_phone}`} className="btn btn-secondary btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyCenter: 'center', gap: '6px' }}>
                    <Phone size={12} /> Call Agent ({activeStopDetail.agent_name.split(' ')[0]})
                  </a>
                )}
              </div>
            </div>

            {/* Keys Status / Audit Trail (US-5.4) */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} /> Property Keys Tracker
              </h4>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button 
                  type="button" 
                  className={`btn btn-sm ${keyState.status === 'Picked Up' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setKeyState(prev => ({ ...prev, status: 'Picked Up', current_holder: 'Crew' }));
                    handleUpdateKeys('Picked Up', 'Crew');
                  }}
                >
                  Pick Up Keys
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm ${keyState.status === 'Dropped Off' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setKeyState(prev => ({ ...prev, status: 'Dropped Off', current_holder: 'Keysafe' }));
                    handleUpdateKeys('Dropped Off', 'Keysafe');
                  }}
                >
                  Drop Off Keys
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Current Status: <strong>{keyState.status}</strong> • Holder: <strong>{keyState.current_holder}</strong>
              </div>
            </div>

            {/* Checklists and Sourcing lists */}
            {activeStopDetail.status === 'Not Started' ? (
              /* If stop not started, must click Arrive */
              <button className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '16px' }} onClick={handleArriveAtStop}>
                <Clock size={18} /> Record Arrival At Property
              </button>
            ) : (
              /* Arrived state, show checklist */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Arrival Checklist */}
                <div className="card" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--success)', marginBottom: '10px' }}>
                    1. Property Arrival Checklist
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeStopDetail.checklists.filter(c => c.type.includes('Arrival')).map((c, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          style={{ marginTop: '3px' }}
                          checked={c.is_checked === 1}
                          onChange={(e) => handleToggleChecklist(c.id, e.target.checked, true)}
                        />
                        <span style={{ color: c.is_checked ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: c.is_checked ? 'line-through' : 'none' }}>
                          {c.item_text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sourced Items packing check */}
                <div className="card" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--info)', marginBottom: '10px' }}>
                    2. Inventory Placement Sourcing Checklist
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {activeStopDetail.sourcing.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <span>{item.item_name} ({item.attribute || 'Default'})</span>
                        <strong>Qty: {item.required_quantity}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Departure Checklist */}
                <div className="card" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--warning)', marginBottom: '10px' }}>
                    3. Property Departure Checklist
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {activeStopDetail.checklists.filter(c => c.type.includes('Departure')).map((c, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          style={{ marginTop: '3px' }}
                          checked={c.is_checked === 1}
                          onChange={(e) => handleToggleChecklist(c.id, e.target.checked, true)}
                        />
                        <span style={{ color: c.is_checked ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: c.is_checked ? 'line-through' : 'none' }}>
                          {c.item_text}
                        </span>
                      </label>
                    ))}
                  </div>

                  <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%', gap: '6px' }} onClick={() => setShowDamageForm(true)}>
                    <AlertTriangle size={14} color="var(--danger)" /> Report Property / Stock Damage...
                  </button>
                </div>

                {/* Big Departure Button (US-5.4) */}
                {activeStopDetail.status === 'Arrived' && (
                  <button 
                    className="btn btn-success" 
                    style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                    onClick={handleDepartStop}
                  >
                    Complete Stop & Depart Property
                  </button>
                )}
              </div>
            )}
          </div>
        )
      )}

      {/* Damage Logging Modal */}
      {showDamageForm && (
        <div className="modal-backdrop">
          <form onSubmit={handleAddDamage} className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Damage Record</h3>
              <button type="button" className="modal-close" onClick={() => setShowDamageForm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Damage Description *</label>
                <textarea 
                  className="input-control" 
                  required 
                  rows="3" 
                  placeholder="Describe property/item damage on-site..."
                  value={damageForm.description}
                  onChange={(e) => setDamageForm(prev => ({ ...prev, description: e.target.value }))}
                ></textarea>
              </div>

              <div className="form-group">
                <label className="form-label">Est. Repair Cost ($)</label>
                <input 
                  type="number" 
                  className="input-control"
                  value={damageForm.repair_cost}
                  onChange={(e) => setDamageForm(prev => ({ ...prev, repair_cost: parseFloat(e.target.value) }))}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="recharged"
                  checked={damageForm.recharged_to_client}
                  onChange={(e) => setDamageForm(prev => ({ ...prev, recharged_to_client: e.target.checked }))}
                />
                <label htmlFor="recharged" style={{ fontSize: '13px', cursor: 'pointer' }}>Recharge cost to client invoice?</label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDamageForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-danger">Log Damage</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
