import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Search, HelpCircle, AlertTriangle, ArrowRight, Clipboard, Copy, Undo, Plus, X } from 'lucide-react';

export default function JobAssembly({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [sourcingLines, setSourcingLines] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [pickupsList, setPickupsList] = useState([]);
  const [activeLineId, setActiveLineId] = useState(null);
  
  // Tabs for sourcing picker
  const [sourceTab, setSourceTab] = useState('warehouse'); // 'warehouse' | 'pickup'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Availability check states
  const [availDetails, setAvailDetails] = useState(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  
  // Modals/dialogs
  const [showNeedsAttentionModal, setShowNeedsAttentionModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [needsAttentionForm, setNeedsAttentionForm] = useState({
    reason: 'No Stock Available',
    notes: ''
  });

  // Quick Add Item Type
  const [quickAddItem, setQuickAddItem] = useState({
    name: '',
    category: 'Beds',
    room_tags: '',
    style_tags: '',
    total_quantity: 5,
    replacement_value: 500,
    useful_life_uses: 15
  });

  const fetchJobSourcing = () => {
    fetch(`/api/jobs/${jobId}`)
      .then(res => res.json())
      .then(data => {
        setJob(data);
        setSourcingLines(data.sourcing || []);
      })
      .catch(err => console.error(err));
  };

  const fetchCatalogAndPickups = () => {
    fetch('/api/inventory/catalog')
      .then(res => res.json())
      .then(data => setCatalog(data));

    // Fetch other jobs that are staging/unstaging to act as pickups
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => {
        // filter other live/styled jobs that are scheduled to end
        setPickupsList(data.filter(j => j.id !== parseInt(jobId) && j.hire_end_date));
      });
  };

  useEffect(() => {
    if (jobId) {
      fetchJobSourcing();
      fetchCatalogAndPickups();
    }
  }, [jobId]);

  const handleSelectLine = (lineId) => {
    setActiveLineId(lineId);
    setAvailDetails(null);
    setSearchQuery('');
  };

  // Run Sourcing Availability Check (US-3.3)
  const handleCheckAvailability = (itemTypeId) => {
    if (!job) return;
    setCheckingAvail(true);
    const start = job.installation_date || new Date().toISOString().split('T')[0];
    const end = job.hire_end_date || new Date().toISOString().split('T')[0];
    
    fetch(`/api/inventory/availability?item_type_id=${itemTypeId}&start_date=${start}&end_date=${end}&current_job_id=${job.id}`)
      .then(res => res.json())
      .then(data => {
        setAvailDetails(data);
        setCheckingAvail(false);
      })
      .catch(err => {
        console.error(err);
        setCheckingAvail(false);
      });
  };

  const handleAllocateSource = (itemTypeId, sourceType, sourceJobId = null) => {
    fetch(`/api/jobs/${jobId}/source-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcing_id: activeLineId,
        item_type_id: itemTypeId,
        source_type: sourceType,
        source_job_id: sourceJobId
      })
    })
      .then(res => res.json())
      .then(() => {
        fetchJobSourcing();
        setActiveLineId(null);
        setAvailDetails(null);
      })
      .catch(err => console.error(err));
  };

  // Mark Needs Attention (US-3.4)
  const handleFlagNeedsAttention = (e) => {
    e.preventDefault();
    fetch(`/api/jobs/${jobId}/needs-attention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcing_id: activeLineId,
        reason: needsAttentionForm.reason,
        notes: needsAttentionForm.notes
      })
    })
      .then(res => res.json())
      .then(() => {
        fetchJobSourcing();
        setShowNeedsAttentionModal(false);
        setActiveLineId(null);
        setNeedsAttentionForm({ reason: 'No Stock Available', notes: '' });
      });
  };

  const handleResolveNeedsAttention = (lineId) => {
    fetch(`/api/jobs/${jobId}/resolve-attention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcing_id: lineId,
        resolver_id: 3, //Emma Stylist
        note: 'Resolved and sourced'
      })
    })
      .then(res => res.json())
      .then(() => {
        fetchJobSourcing();
        alert('Item marked as resolved.');
      });
  };

  // Inline Quick Add Item Type (US-3.2 step 4)
  const handleQuickAddItemType = (e) => {
    e.preventDefault();
    fetch('/api/inventory/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quickAddItem)
    })
      .then(res => res.json())
      .then(res => {
        fetchCatalogAndPickups();
        setShowQuickAddModal(false);
        setQuickAddItem({
          name: '',
          category: 'Beds',
          room_tags: '',
          style_tags: '',
          total_quantity: 5,
          replacement_value: 500,
          useful_life_uses: 15
        });
        // Select newly created line
        handleCheckAvailability(res.itemTypeId);
      });
  };

  // Smart Sourcing Sizing Helpers (US-3.5)
  const handleCopyRoomSourcing = (roomName) => {
    const targetRoom = prompt("Which room do you want to copy this sourcing to? (e.g. Bedroom 2)");
    if (!targetRoom) return;

    // Find all sourced items for this room
    const sourcedItems = sourcingLines.filter(s => s.room_name === roomName && s.item_type_id);
    if (sourcedItems.length === 0) {
      alert('No sourced items found in this room to copy.');
      return;
    }

    // Allocate in database for matching items in the target room
    const targets = sourcingLines.filter(s => s.room_name === targetRoom && s.status === 'Not Sourced');
    if (targets.length === 0) {
      alert(`No empty 'Not Sourced' lines found in room: ${targetRoom}.`);
      return;
    }

    const promises = targets.map((target, idx) => {
      // Find matching item by name or category
      const match = sourcedItems[idx] || sourcedItems[0];
      return fetch(`/api/jobs/${jobId}/source-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcing_id: target.id,
          item_type_id: match.item_type_id,
          source_type: match.source_type,
          source_job_id: match.source_job_id
        })
      });
    });

    Promise.all(promises).then(() => {
      fetchJobSourcing();
      alert(`Copied room sourcing successfully to ${targetRoom}.`);
    });
  };

  if (!job) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading job assembly...</div>;
  }

  // Group sourcing lines by room
  const roomsMap = {};
  for (const line of sourcingLines) {
    if (!roomsMap[line.room_name]) {
      roomsMap[line.room_name] = [];
    }
    roomsMap[line.room_name].push(line);
  }

  const activeLine = sourcingLines.find(l => l.id === activeLineId);

  // Filter Catalog / Pickups
  const filteredCatalog = catalog.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPickups = pickupsList.filter(p => 
    p.client_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back to Jobs</button>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginTop: '12px' }}>Inventory Sourcing Workstation</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sourcing details for: {job.client_name} at {job.client_address}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-secondary">Install Date: {job.installation_date || 'TBC'}</span>
          <span className={`badge ${
            sourcingLines.every(l => l.status === 'Sourced') ? 'badge-success' : 'badge-warning'
          }`}>
            Status: {sourcingLines.every(l => l.status === 'Sourced') ? 'Sourcing Ready' : 'Incomplete Sourcing'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '32px', height: 'calc(100vh - 200px)' }}>
        {/* Left Side: Room items Sourcing Checklist */}
        <div className="card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(roomsMap).map(([roomName, lines], rIdx) => (
            <div key={rIdx} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)' }}>{roomName}</h3>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  style={{ fontSize: '10px', padding: '4px 8px' }}
                  onClick={() => handleCopyRoomSourcing(roomName)}
                >
                  <Copy size={10} /> Duplicate Sourcing To Room...
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lines.map((line, lIdx) => {
                  const matchedCatalog = catalog.find(c => c.id === line.item_type_id);
                  return (
                    <div 
                      key={lIdx} 
                      onClick={() => handleSelectLine(line.id)}
                      style={{
                        padding: '12px 16px',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        background: activeLineId === line.id ? 'var(--primary-glow)' : 'rgba(255,255,255,0.01)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600' }}>{line.item_name}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Size: {line.attribute || 'Default'} • Qty: {line.required_quantity}
                        </p>
                        {line.item_type_id && (
                          <p style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px', fontWeight: '500' }}>
                            Sourced: {matchedCatalog?.name} ({line.source_type === 'warehouse' ? 'Warehouse' : 'Pickup Job'})
                          </p>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${
                          line.status === 'Sourced' ? 'badge-success' :
                          line.status === 'Pending Arrival' ? 'badge-info' :
                          line.status === 'Needs Attention' ? 'badge-danger' :
                          'badge-secondary'
                        }`}>{line.status}</span>
                        {line.status === 'Needs Attention' && (
                          <button 
                            type="button" 
                            className="btn btn-secondary btn-sm" 
                            style={{ fontSize: '10px', padding: '4px 8px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolveNeedsAttention(line.id);
                            }}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Side: Sourcing Panel (Warehouse vs Pickups Picker) */}
        <div style={{ width: '450px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeLine ? (
            <div className="card" style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Source: {activeLine.item_name}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Required: {activeLine.required_quantity} • Size: {activeLine.attribute || 'Default'}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="btn btn-danger btn-sm" onClick={() => setShowNeedsAttentionModal(true)}>Can't Source This</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowQuickAddModal(true)}>+ Quick Add Catalog</button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '4px' }}>
                <button 
                  className={`btn btn-sm ${sourceTab === 'warehouse' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                  onClick={() => { setSourceTab('warehouse'); setAvailDetails(null); }}
                >
                  Warehouse Stock
                </button>
                <button 
                  className={`btn btn-sm ${sourceTab === 'pickup' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                  onClick={() => { setSourceTab('pickup'); setAvailDetails(null); }}
                >
                  Existing Pickups (De-stage)
                </button>
              </div>

              {/* Search Picker */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder={`Search ${sourceTab}...`} 
                  className="input-control" 
                  style={{ padding: '6px 12px 6px 32px', fontSize: '12px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Selection Catalog */}
              <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sourceTab === 'warehouse' ? (
                  filteredCatalog.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleCheckAvailability(item.id)}
                      style={{
                        padding: '12px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center'
                      }}
                    >
                      {item.photo_url && (
                        <img 
                          src={item.photo_url} 
                          alt={item.name} 
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' }} 
                        />
                      )}
                      <div style={{ flexGrow: 1 }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '600' }}>{item.name}</h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Owned: {item.total_quantity}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  filteredPickups.map((p, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        // Sourcing from pickup requires an Item Type ID. For simplicity in demo, we query availability of first bed/couch matching Category
                        const matches = catalog.filter(c => c.name.toLowerCase().includes(activeLine.item_name.toLowerCase()) || c.category.toLowerCase().includes(activeLine.item_name.toLowerCase()));
                        const itemTypeId = matches[0]?.id || 1;
                        handleAllocateSource(itemTypeId, 'pickup', p.id);
                      }}
                      style={{
                        padding: '12px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                      }}
                    >
                      <h4 style={{ fontSize: '13px', fontWeight: '600' }}>Pickup from: {p.client_name}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Address: {p.client_address}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--primary)', marginTop: '6px' }}>
                        <span>De-install Date: {p.hire_end_date}</span>
                        <span>Staged Status: {p.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Sourcing Availability Panel (US-3.3) */}
              {availDetails && (
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700' }}>Availability Details</h4>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Company Stock:</span>
                    <strong>{availDetails.total_owned} units</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Overlapping Allocations:</span>
                    <strong>{availDetails.allocated_count} units</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Available Stock:</span>
                    <strong style={{ color: availDetails.available_count >= activeLine.required_quantity ? 'var(--success)' : 'var(--danger)' }}>
                      {availDetails.available_count} units
                    </strong>
                  </div>

                  {/* Conflict Check warnings */}
                  {availDetails.allocations.length > 0 && (
                    <div className="conflict-warning-badge">
                      <AlertTriangle size={14} />
                      <div>
                        <strong>Reservation overlaps:</strong>
                        <ul style={{ paddingLeft: '14px', marginTop: '4px', fontSize: '11px' }}>
                          {availDetails.allocations.map((alloc, i) => (
                            <li key={i}>
                              Job-{alloc.job_id} ({alloc.client_name}) - {alloc.job_status} [{alloc.qty} units]
                            </li>
                          ))}
                        </ul>
                        {availDetails.available_count < activeLine.required_quantity && (
                          <p style={{ marginTop: '6px', fontSize: '10px', color: 'var(--danger)', fontWeight: '700' }}>
                            WARNING: Hard conflicts detected. Stock unavailable.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <button 
                    className="btn btn-primary btn-sm"
                    disabled={availDetails.available_count < activeLine.required_quantity}
                    onClick={() => handleAllocateSource(availDetails.item_type_id, 'warehouse')}
                  >
                    Confirm Sourcing from Warehouse
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
              <HelpCircle size={40} strokeWidth={1} />
              <p style={{ textAlign: 'center', fontSize: '13px' }}>Click a room required item line on the left checklist to source it.</p>
            </div>
          )}
        </div>
      </div>

      {/* Flag Needs Attention Modal (US-3.4) */}
      {showNeedsAttentionModal && (
        <div className="modal-backdrop">
          <form onSubmit={handleFlagNeedsAttention} className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Flag as Needs Attention</h3>
              <button type="button" className="modal-close" onClick={() => setShowNeedsAttentionModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Needs Attention Reason *</label>
                <select 
                  className="input-control select-control"
                  value={needsAttentionForm.reason}
                  onChange={(e) => setNeedsAttentionForm(prev => ({ ...prev, reason: e.target.value }))}
                >
                  <option value="No Stock Available">No Stock Available</option>
                  <option value="Wrong Size">Wrong Size</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Details / Internal Notes</label>
                <textarea 
                  className="input-control" 
                  rows="3" 
                  placeholder="Explain why this item can't be sourced..."
                  value={needsAttentionForm.notes}
                  onChange={(e) => setNeedsAttentionForm(prev => ({ ...prev, notes: e.target.value }))}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNeedsAttentionModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-danger">Flag Item</button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Catalog Modal */}
      {showQuickAddModal && (
        <div className="modal-backdrop">
          <form onSubmit={handleQuickAddItemType} className="modal-content" style={{ width: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Quick Add Catalog Item Type</h3>
              <button type="button" className="modal-close" onClick={() => setShowQuickAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Item Type Name *</label>
                <input 
                  type="text" 
                  className="input-control" 
                  required
                  placeholder="e.g. King Bed - Walnut Frame"
                  value={quickAddItem.name}
                  onChange={(e) => setQuickAddItem(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select 
                    className="input-control select-control"
                    value={quickAddItem.category}
                    onChange={(e) => setQuickAddItem(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="Beds">Beds</option>
                    <option value="Sofas">Sofas</option>
                    <option value="Chairs">Chairs</option>
                    <option value="Tables">Tables</option>
                    <option value="Rugs">Rugs</option>
                    <option value="Lighting">Lighting</option>
                    <option value="Decor">Decor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Company Owned Quantity *</label>
                  <input 
                    type="number" 
                    className="input-control" 
                    required 
                    value={quickAddItem.total_quantity}
                    onChange={(e) => setQuickAddItem(prev => ({ ...prev, total_quantity: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Replacement Value ($) *</label>
                  <input 
                    type="number" 
                    className="input-control" 
                    required 
                    value={quickAddItem.replacement_value}
                    onChange={(e) => setQuickAddItem(prev => ({ ...prev, replacement_value: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Useful Life (Uses) *</label>
                  <input 
                    type="number" 
                    className="input-control" 
                    required 
                    value={quickAddItem.useful_life_uses}
                    onChange={(e) => setQuickAddItem(prev => ({ ...prev, useful_life_uses: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowQuickAddModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save to Catalog</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
