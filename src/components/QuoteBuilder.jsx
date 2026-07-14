import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Edit2, Calendar, FileText, UserCheck, AlertTriangle, Send, X, Copy } from 'lucide-react';

export default function QuoteBuilder({ onNavigateToJob }) {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [roomTemplates, setRoomTemplates] = useState([]);
  
  const [activeQuoteId, setActiveQuoteId] = useState(null);
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  // New Quote Wizard states
  const [wizardStep, setWizardStep] = useState(1);
  const [newQuote, setNewQuote] = useState({
    creation_type: 'Send from Floorplan/Online Photos',
    recipient_type: 'Client',
    client_id: '',
    agent_id: '',
    bill_to: 'Client',
    hire_duration: '6 Weeks',
    flat_price: 2500,
    visit_date: '',
    visit_time: '',
    visit_type: 'Viewing with Client',
    visit_assigned_to: '',
    rooms: []
  });

  // Edit Quote / Room Sourcing Sizing States
  const [editRooms, setEditRooms] = useState([]);
  const [flatPriceEdit, setFlatPriceEdit] = useState('');
  const [hireDurationEdit, setHireDurationEdit] = useState('');
  const [lostReason, setLostReason] = useState('Quoted Too High');
  const [lostOtherReason, setLostOtherReason] = useState('');
  const [ccAgentToggle, setCcAgentToggle] = useState(false);

  // Scheduling states
  const [scheduleData, setScheduleData] = useState({
    installation_date: '',
    is_tbc: false
  });

  const fetchData = () => {
    fetch('/api/quotes').then(res => res.json()).then(data => setQuotes(data));
    fetch('/api/clients').then(res => res.json()).then(data => setClients(data));
    fetch('/api/agents').then(res => res.json()).then(data => setAgents(data));
    fetch('/api/staff').then(res => res.json()).then(data => setStaff(data));
    fetch('/api/room-templates').then(res => res.json()).then(data => setRoomTemplates(data));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openQuoteDetails = (quoteId) => {
    fetch(`/api/quotes/${quoteId}`)
      .then(res => res.json())
      .then(data => {
        setActiveQuoteId(quoteId);
        setEditRooms(data.rooms || []);
        setFlatPriceEdit(data.flat_price);
        setHireDurationEdit(data.hire_duration);
      });
  };

  // Add Room from Templates or Custom (US-2.1, 2.2)
  const handleAddRoom = (templateName) => {
    let newRoom = {
      room_type: templateName,
      label: templateName,
      notes: '',
      line_items: []
    };

    if (templateName !== 'Custom') {
      const template = roomTemplates.find(t => t.name === templateName);
      if (template) {
        newRoom.line_items = template.default_items.map(item => ({
          item_name: item.item_name,
          attribute: item.attribute || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0
        }));
      }
    } else {
      newRoom.label = 'Office';
      newRoom.room_type = 'Custom';
    }

    setEditRooms([...editRooms, newRoom]);
  };

  const handleDuplicateRoom = (idx) => {
    const original = editRooms[idx];
    const copy = {
      ...original,
      label: `${original.label} (Copy)`,
      line_items: original.line_items.map(li => ({ ...li }))
    };
    setEditRooms([...editRooms, copy]);
  };

  const handleRemoveRoom = (idx) => {
    setEditRooms(editRooms.filter((_, i) => i !== idx));
  };

  const handleRoomLabelChange = (idx, value) => {
    const updated = [...editRooms];
    updated[idx].label = value;
    setEditRooms(updated);
  };

  const handleRoomNotesChange = (idx, value) => {
    const updated = [...editRooms];
    updated[idx].notes = value;
    setEditRooms(updated);
  };

  // Item Changes within Room
  const handleItemChange = (roomIdx, itemIdx, field, value) => {
    const updated = [...editRooms];
    updated[roomIdx].line_items[itemIdx][field] = value;
    setEditRooms(updated);
  };

  const handleAddItemToRoom = (roomIdx) => {
    const updated = [...editRooms];
    updated[roomIdx].line_items.push({
      item_name: 'New Custom Item',
      attribute: '',
      quantity: 1,
      unit_price: 0
    });
    setEditRooms(updated);
  };

  const handleRemoveItemFromRoom = (roomIdx, itemIdx) => {
    const updated = [...editRooms];
    updated[roomIdx].line_items = updated[roomIdx].line_items.filter((_, i) => i !== itemIdx);
    setEditRooms(updated);
  };

  const handleSaveQuoteChanges = () => {
    fetch(`/api/quotes/${activeQuoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flat_price: parseFloat(flatPriceEdit),
        hire_duration: hireDurationEdit,
        rooms: editRooms
      })
    })
      .then(res => res.json())
      .then(() => {
        fetchData();
        alert('Quote changes saved successfully.');
      });
  };

  // Submit New Quote Wizard (US-1.2, 1.3, 1.4)
  const handleSubmitNewQuote = () => {
    fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQuote)
    })
      .then(res => res.json())
      .then(res => {
        fetchData();
        setShowNewQuoteModal(false);
        setWizardStep(1);
        setNewQuote({
          creation_type: 'Send from Floorplan/Online Photos',
          recipient_type: 'Client',
          client_id: '',
          agent_id: '',
          bill_to: 'Client',
          hire_duration: '6 Weeks',
          flat_price: 2500,
          visit_date: '',
          visit_time: '',
          visit_type: 'Viewing with Client',
          visit_assigned_to: '',
          rooms: []
        });
        openQuoteDetails(res.quoteId);
      });
  };

  const handleSendQuote = () => {
    fetch(`/api/quotes/${activeQuoteId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cc_agent_on_send: ccAgentToggle })
    })
      .then(res => res.json())
      .then(() => {
        fetchData();
        setShowSendModal(false);
        openQuoteDetails(activeQuoteId);
        alert('Quote sent! Simulation notifications generated in Inbox.');
      });
  };

  const handleMarkLost = () => {
    const reason = lostReason === 'Other' ? lostOtherReason : lostReason;
    fetch(`/api/quotes/${activeQuoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Declined', lost_reason: reason })
    })
      .then(res => res.json())
      .then(() => {
        fetchData();
        setShowLostModal(false);
        openQuoteDetails(activeQuoteId);
      });
  };

  const handleConvertToJob = () => {
    if (scheduleData.is_tbc) {
      // Mark as TBC (Status -> Confirmed, is_tbc -> 1)
      fetch(`/api/jobs/${activeQuoteId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_tbc: true, installation_date: null })
      })
        .then(res => res.json())
        .then(res => {
          fetchData();
          setShowConvertModal(false);
          setActiveQuoteId(null);
          if (onNavigateToJob) onNavigateToJob();
        });
    } else {
      // Confirmed Date
      fetch(`/api/jobs/${activeQuoteId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_tbc: false, installation_date: scheduleData.installation_date })
      })
        .then(res => res.json())
        .then(res => {
          fetchData();
          setShowConvertModal(false);
          setActiveQuoteId(null);
          if (onNavigateToJob) onNavigateToJob();
        });
    }
  };

  const activeQuote = quotes.find(q => q.id === activeQuoteId);

  return (
    <div style={{ display: 'flex', gap: '32px', height: 'calc(100vh - 140px)' }}>
      {/* Sidebar Quotes List */}
      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Staging Quotes</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewQuoteModal(true)}>+ New Quote</button>
        </div>

        <div className="table-container" style={{ flexGrow: 1, overflowY: 'auto', background: 'var(--bg-card)' }}>
          {quotes.map((q, idx) => (
            <div 
              key={idx}
              onClick={() => openQuoteDetails(q.id)}
              style={{
                padding: '16px',
                borderBottom: '1px solid var(--border-light)',
                cursor: 'pointer',
                background: activeQuoteId === q.id ? 'var(--primary-glow)' : 'transparent',
                transition: 'background 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Q-{q.id}</span>
                <span className={`badge ${
                  q.status === 'Signed' ? 'badge-success' :
                  q.status === 'Sent' ? 'badge-primary' :
                  q.status === 'Draft' ? 'badge-secondary' :
                  q.status === 'Scheduled' ? 'badge-info' :
                  'badge-danger'
                }`}>{q.status}</span>
              </div>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                {q.recipient_type === 'Client' ? q.client_name : `${q.agent_name} (Agent)`}
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>{q.hire_duration} hire</span>
                <strong style={{ color: 'var(--text-main)' }}>${q.flat_price.toLocaleString()}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quote Workstation Area */}
      <div style={{ flexGrow: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {activeQuote ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header Details */}
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: '700' }}>Quote Q-{activeQuote.id} Details</h3>
                  <span className="badge badge-secondary">{activeQuote.status}</span>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  For: <strong>{activeQuote.client_name}</strong> {activeQuote.client_address && `• Address: ${activeQuote.client_address}`}
                </p>
                {activeQuote.agent_name && (
                  <p style={{ fontSize: '13px', color: 'var(--primary)', marginTop: '4px' }}>
                    Referred by Agent: <strong>{activeQuote.agent_name} ({activeQuote.agent_agency})</strong>
                  </p>
                )}
              </div>

              {/* Action buttons depending on state */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {activeQuote.status === 'Draft' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setCcAgentToggle(false);
                    setShowSendModal(true);
                  }}>
                    <Send size={14} /> Send to Client
                  </button>
                )}
                {activeQuote.status === 'Sent' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    // Simulate Client Portal click by triggering signing endpoint directly in demo
                    fetch(`/api/quotes/${activeQuote.id}/sign`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: activeQuote.client_name, signature_data: 'demo-sig' })
                    })
                      .then(res => res.json())
                      .then(() => {
                        fetchData();
                        openQuoteDetails(activeQuote.id);
                        alert('Simulated client signing completed.');
                      });
                  }}>
                    Sign as Client (Demo)
                  </button>
                )}
                {activeQuote.status === 'Signed' && (
                  <button className="btn btn-success btn-sm" onClick={() => setShowConvertModal(true)}>
                    <UserCheck size={14} /> Schedule Job
                  </button>
                )}
                {['Draft', 'Sent', 'Viewed', 'Scheduled'].includes(activeQuote.status) && (
                  <button className="btn btn-danger btn-sm" onClick={() => setShowLostModal(true)}>
                    Mark Lost
                  </button>
                )}
              </div>
            </div>

            {/* Room Workstation Builder Grid */}
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600' }}>Rooms Furniture Allocation</h4>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {['Bedroom – Master', 'Bedroom – Standard', 'Bedroom – Single/Study', 'Living Room – Front', 'Living Room – Main', 'Kitchen & Meals', 'Bathroom & Laundry', 'Outdoor Setting', 'Custom'].map((tName, i) => (
                    <button 
                      key={i} 
                      className="btn btn-secondary btn-sm" 
                      style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                      onClick={() => handleAddRoom(tName)}
                    >
                      + {tName.split(' – ').pop()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quote Rooms Forms */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {editRooms.map((room, rIdx) => (
                  <div key={rIdx} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                      <input 
                        type="text" 
                        className="input-control" 
                        style={{ width: '220px', padding: '6px 12px', fontWeight: '600', fontSize: '14px' }}
                        value={room.label}
                        onChange={(e) => handleRoomLabelChange(rIdx, e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDuplicateRoom(rIdx)}>
                          Duplicate
                        </button>
                        <button className="btn btn-danger btn-sm" style={{ padding: '6px' }} onClick={() => handleRemoveRoom(rIdx)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Room Notes */}
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <input 
                        type="text" 
                        placeholder="Room notes/styling constraints (e.g. Scandi wood only)"
                        className="input-control"
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                        value={room.notes}
                        onChange={(e) => handleRoomNotesChange(rIdx, e.target.value)}
                      />
                    </div>

                    {/* Line Items List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {room.line_items.map((item, iIdx) => (
                        <div key={iIdx} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input 
                            type="text" 
                            placeholder="Item Name" 
                            className="input-control" 
                            style={{ flexGrow: 2, minWidth: '150px', padding: '6px 10px', fontSize: '13px' }}
                            value={item.item_name}
                            onChange={(e) => handleItemChange(rIdx, iIdx, 'item_name', e.target.value)}
                          />
                          <input 
                            type="text" 
                            placeholder="Size/Attribute" 
                            className="input-control" 
                            style={{ flexGrow: 1, minWidth: '100px', padding: '6px 10px', fontSize: '13px' }}
                            value={item.attribute}
                            onChange={(e) => handleItemChange(rIdx, iIdx, 'attribute', e.target.value)}
                          />
                          {/* Quantity Counter Stepper (US-2.1) */}
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                            <button 
                              type="button" 
                              className="btn btn-secondary btn-sm" 
                              style={{ border: 'none', padding: '6px 10px' }}
                              onClick={() => handleItemChange(rIdx, iIdx, 'quantity', Math.max(1, item.quantity - 1))}
                            >
                              -
                            </button>
                            <span style={{ minWidth: '32px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>{item.quantity}</span>
                            <button 
                              type="button" 
                              className="btn btn-secondary btn-sm" 
                              style={{ border: 'none', padding: '6px 10px' }}
                              onClick={() => handleItemChange(rIdx, iIdx, 'quantity', item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <button 
                            type="button" 
                            className="btn btn-danger btn-sm" 
                            style={{ padding: '8px' }}
                            onClick={() => handleRemoveItemFromRoom(rIdx, iIdx)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm" 
                        style={{ alignSelf: 'flex-start', padding: '4px 8px', fontSize: '11px', marginTop: '4px' }}
                        onClick={() => handleAddItemToRoom(rIdx)}
                      >
                        + Add Custom Item Line
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Section (Option A Pricing - US-2.4) */}
            <div style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Flat Job Quote Price ($) *</label>
                  <input 
                    type="number" 
                    className="input-control" 
                    style={{ width: '120px', padding: '8px 12px' }}
                    value={flatPriceEdit}
                    onChange={(e) => setFlatPriceEdit(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Hire Duration</label>
                  <select 
                    className="input-control select-control" 
                    style={{ width: '140px', padding: '8px 30px 8px 12px' }}
                    value={hireDurationEdit}
                    onChange={(e) => setHireDurationEdit(e.target.value)}
                  >
                    <option value="6 Weeks">6 Weeks</option>
                    <option value="8 Weeks">8 Weeks</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>
              
              <button className="btn btn-primary" onClick={handleSaveQuoteChanges}>
                Save Quote Sourcing Sheet
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '12px' }}>
            <FileText size={48} strokeWidth={1} />
            <p>Select a quote from the sidebar or create a new quote to start building.</p>
          </div>
        )}
      </div>

      {/* New Quote Wizard Modal */}
      {showNewQuoteModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ width: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Quote Wizard</h3>
              <button className="modal-close" onClick={() => { setShowNewQuoteModal(false); setWizardStep(1); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {wizardStep === 1 ? (
                /* Step 1: Remote vs Site Visit Creation Type (US-1.2, 3.2 step 2) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label className="form-label">How will this quote be created?</label>
                  <div 
                    onClick={() => setNewQuote(prev => ({ ...prev, creation_type: 'Send from Floorplan/Online Photos' }))}
                    style={{
                      padding: '16px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: newQuote.creation_type === 'Send from Floorplan/Online Photos' ? 'var(--primary-glow)' : 'transparent',
                      cursor: 'pointer',
                      borderColor: newQuote.creation_type === 'Send from Floorplan/Online Photos' ? 'var(--primary)' : 'var(--border)'
                    }}
                  >
                    <h4 style={{ fontWeight: '700', fontSize: '14px' }}>Send from Floorplan/Online Photos</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Remote quote generated instantly from online marketing photos or drafts.</p>
                  </div>

                  <div 
                    onClick={() => setNewQuote(prev => ({ ...prev, creation_type: 'Schedule a Quote Day' }))}
                    style={{
                      padding: '16px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: newQuote.creation_type === 'Schedule a Quote Day' ? 'var(--primary-glow)' : 'transparent',
                      cursor: 'pointer',
                      borderColor: newQuote.creation_type === 'Schedule a Quote Day' ? 'var(--primary)' : 'var(--border)'
                    }}
                  >
                    <h4 style={{ fontWeight: '700', fontSize: '14px' }}>Schedule a Quote Day</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>In-person site inspection to document room configurations before pricing.</p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setWizardStep(2)}>Next Step</button>
                </div>
              ) : wizardStep === 2 ? (
                /* Step 2: Recipient Type and Selector (US-1.3, 3.2 step 3-5) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Who is this quote for?</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button"
                        className={`btn ${newQuote.recipient_type === 'Client' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => setNewQuote(prev => ({ ...prev, recipient_type: 'Client', agent_id: '' }))}
                      >
                        Client (Owner)
                      </button>
                      <button 
                        type="button"
                        className={`btn ${newQuote.recipient_type === 'Real Estate Agent' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1 }}
                        onClick={() => setNewQuote(prev => ({ ...prev, recipient_type: 'Real Estate Agent', client_id: '' }))}
                      >
                        Real Estate Agent
                      </button>
                    </div>
                  </div>

                  {newQuote.recipient_type === 'Client' ? (
                    <div className="form-group">
                      <label className="form-label">Select Client *</label>
                      <select 
                        className="input-control select-control" 
                        required
                        value={newQuote.client_id}
                        onChange={(e) => setNewQuote(prev => ({ ...prev, client_id: e.target.value }))}
                      >
                        <option value="">Choose...</option>
                        {clients.map((c, i) => (
                          <option key={i} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Select Referring Agent *</label>
                      <select 
                        className="input-control select-control" 
                        required
                        value={newQuote.agent_id}
                        onChange={(e) => setNewQuote(prev => ({ ...prev, agent_id: e.target.value }))}
                      >
                        <option value="">Choose...</option>
                        {agents.map((a, i) => (
                          <option key={i} value={a.id}>{a.name} ({a.agency})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Bill To</label>
                    <select 
                      className="input-control select-control"
                      value={newQuote.bill_to}
                      onChange={(e) => setNewQuote(prev => ({ ...prev, bill_to: e.target.value }))}
                    >
                      <option value="Client">Client</option>
                      <option value="Agent">Agent</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep(1)}>Back</button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1 }} 
                      disabled={newQuote.recipient_type === 'Client' ? !newQuote.client_id : !newQuote.agent_id}
                      onClick={() => {
                        if (newQuote.creation_type === 'Schedule a Quote Day') {
                          setWizardStep(3);
                        } else {
                          handleSubmitNewQuote();
                        }
                      }}
                    >
                      {newQuote.creation_type === 'Schedule a Quote Day' ? 'Next: Schedule Visit' : 'Create Quote'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 3: Schedule site visit inputs (US-1.4, 3.4) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Visit Inspection Date *</label>
                    <input 
                      type="date" 
                      className="input-control" 
                      required 
                      value={newQuote.visit_date}
                      onChange={(e) => setNewQuote(prev => ({ ...prev, visit_date: e.target.value }))}
                    />
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Visit Time (approx)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 10:30 AM" 
                        className="input-control" 
                        value={newQuote.visit_time}
                        onChange={(e) => setNewQuote(prev => ({ ...prev, visit_time: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Visit Type</label>
                      <select 
                        className="input-control select-control"
                        value={newQuote.visit_type}
                        onChange={(e) => setNewQuote(prev => ({ ...prev, visit_type: e.target.value }))}
                      >
                        <option value="Viewing with Client">Viewing with Client</option>
                        <option value="Keysafe Access">Keysafe Access</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assign Inspector Staff *</label>
                    <select 
                      className="input-control select-control" 
                      required
                      value={newQuote.visit_assigned_to}
                      onChange={(e) => setNewQuote(prev => ({ ...prev, visit_assigned_to: e.target.value }))}
                    >
                      <option value="">Select Inspector...</option>
                      {staff.filter(s => ['Admin', 'Head Stylist/Management', 'Stylist'].includes(s.role)).map((s, i) => (
                        <option key={i} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep(2)}>Back</button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1 }}
                      disabled={!newQuote.visit_date || !newQuote.visit_assigned_to}
                      onClick={handleSubmitNewQuote}
                    >
                      Schedule & Create
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark Lost Modal (US-1.6, 3.5) */}
      {showLostModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Mark Quote as Lost</h3>
              <button className="modal-close" onClick={() => setShowLostModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Why was this quote lost? *</label>
                <select 
                  className="input-control select-control"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                >
                  <option value="Quoted Too High">Quoted Too High</option>
                  <option value="Client Went With Agent's Own Stylist">Client Went With Agent's Own Stylist</option>
                  <option value="Other">Other Reason...</option>
                </select>
              </div>

              {lostReason === 'Other' && (
                <div className="form-group">
                  <label className="form-label">Details *</label>
                  <input 
                    type="text" 
                    className="input-control" 
                    placeholder="Enter lost reason details..." 
                    required 
                    value={lostOtherReason}
                    onChange={(e) => setLostOtherReason(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLostModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleMarkLost}>Mark Lost</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Quote Modal (US-1.5, 3.2 step 7) */}
      {showSendModal && activeQuote && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Review Recipients List</h3>
              <button className="modal-close" onClick={() => setShowSendModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Verify recipient list. The system will generate a secure magic link for immediate signing.</p>
              
              <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>To: </span>
                  <strong>{activeQuote.client_email}</strong> (Client Primary)
                </div>
                {activeQuote.client_secondary && (
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>CC: </span>
                    <strong>{activeQuote.client_secondary}</strong> (Client Secondary)
                  </div>
                )}
              </div>

              {activeQuote.agent_email && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="ccAgent" 
                    checked={ccAgentToggle} 
                    onChange={(e) => setCcAgentToggle(e.target.checked)}
                  />
                  <label htmlFor="ccAgent" style={{ fontSize: '13px', cursor: 'pointer' }}>
                    Also CC referring agent <strong>{activeQuote.agent_email}</strong>?
                  </label>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSendModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSendQuote}>Confirm & Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Job Modal (US-1.7, 3.6) */}
      {showConvertModal && activeQuote && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ width: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Schedule Job & Installation</h3>
              <button className="modal-close" onClick={() => setShowConvertModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="scheduleType" 
                    checked={!scheduleData.is_tbc}
                    onChange={() => setScheduleData(prev => ({ ...prev, is_tbc: false }))}
                  />
                  Set Installation Date
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="scheduleType" 
                    checked={scheduleData.is_tbc}
                    onChange={() => setScheduleData(prev => ({ ...prev, is_tbc: true, installation_date: '' }))}
                  />
                  Mark as TBC (Flexible)
                </label>
              </div>

              {!scheduleData.is_tbc && (
                <div className="form-group">
                  <label className="form-label">Installation Date *</label>
                  <input 
                    type="date" 
                    className="input-control" 
                    required 
                    value={scheduleData.installation_date}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, installation_date: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
              <button 
                className="btn btn-success" 
                disabled={!scheduleData.is_tbc && !scheduleData.installation_date}
                onClick={handleConvertToJob}
              >
                Schedule & Convert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
