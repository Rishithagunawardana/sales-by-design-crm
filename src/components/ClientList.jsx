import React, { useState, useEffect } from 'react';
import { Plus, Search, User, Phone, Mail, MapPin, Building, ChevronRight, X } from 'lucide-react';

export default function ClientList() {
  const [activeTab, setActiveTab] = useState('clients'); // 'clients' | 'agents'
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState('');
  
  // Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showInlineAgentForm, setShowInlineAgentForm] = useState(false);

  // Client form states
  const [clientForm, setClientForm] = useState({
    name: '',
    primary_email: '',
    phone: '',
    address: '',
    lead_source: 'Google Advertising',
    referring_agent_id: '',
    notes: '',
    secondary_emails: ['']
  });

  // Agent form states
  const [agentForm, setAgentForm] = useState({
    name: '',
    agency: '',
    phone: '',
    email: ''
  });

  const fetchData = () => {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => setClients(data));

    fetch('/api/agents')
      .then(res => res.json())
      .then(data => setAgents(data));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSecondaryEmail = () => {
    setClientForm(prev => ({
      ...prev,
      secondary_emails: [...prev.secondary_emails, '']
    }));
  };

  const handleSecondaryEmailChange = (index, value) => {
    const updated = [...clientForm.secondary_emails];
    updated[index] = value;
    setClientForm(prev => ({
      ...prev,
      secondary_emails: updated
    }));
  };

  const handleRemoveSecondaryEmail = (index) => {
    const updated = clientForm.secondary_emails.filter((_, i) => i !== index);
    setClientForm(prev => ({
      ...prev,
      secondary_emails: updated.length > 0 ? updated : ['']
    }));
  };

  const submitClient = (e) => {
    e.preventDefault();
    const data = {
      ...clientForm,
      secondary_emails: clientForm.secondary_emails.filter(e => e.trim() !== '').join(',')
    };

    fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(() => {
        fetchData();
        setShowClientModal(false);
        setClientForm({
          name: '',
          primary_email: '',
          phone: '',
          address: '',
          lead_source: 'Google Advertising',
          referring_agent_id: '',
          notes: '',
          secondary_emails: ['']
        });
      })
      .catch(err => console.error(err));
  };

  const submitAgent = (e) => {
    e.preventDefault();
    fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentForm)
    })
      .then(res => res.json())
      .then(newAgent => {
        fetchData();
        // If created from within client modal, bind it automatically
        if (showClientModal) {
          setClientForm(prev => ({
            ...prev,
            referring_agent_id: newAgent.id
          }));
          setShowInlineAgentForm(false);
        } else {
          setShowAgentModal(false);
        }
        setAgentForm({ name: '', agency: '', phone: '', email: '' });
      })
      .catch(err => console.error(err));
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.address && c.address.toLowerCase().includes(search.toLowerCase())) ||
    c.primary_email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    (a.agency && a.agency.toLowerCase().includes(search.toLowerCase())) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Directory Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${activeTab === 'clients' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('clients'); setSearch(''); }}
          >
            Clients Directory
          </button>
          <button 
            className={`btn ${activeTab === 'agents' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('agents'); setSearch(''); }}
          >
            Agents Directory
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexGrow: 1, maxWidth: '500px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder={`Search ${activeTab}...`} 
              className="input-control" 
              style={{ paddingLeft: '40px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => activeTab === 'clients' ? setShowClientModal(true) : setShowAgentModal(true)}
          >
            <Plus size={16} /> Add New
          </button>
        </div>
      </div>

      {/* Directory Lists */}
      {activeTab === 'clients' ? (
        <div className="grid-2">
          {filteredClients.map((client, idx) => (
            <div className="card" key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{client.name}</h3>
                  <span className="badge badge-secondary" style={{ marginTop: '4px' }}>Source: {client.lead_source}</span>
                </div>
                {client.referring_agent_name && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Referred By</span>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>{client.referring_agent_name}</p>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', margin: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <Mail size={14} /> {client.primary_email}
                </div>
                {client.secondary_emails && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '22px', marginBottom: '6px' }}>
                    <span>CC: {client.secondary_emails}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <Phone size={14} /> {client.phone || 'No phone'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <MapPin size={14} /> {client.address || 'No address logged'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Notes</span>
                <p style={{ fontSize: '13px', color: 'var(--text-main)' }}>{client.notes || 'No notes added.'}</p>
              </div>
            </div>
          ))}
          {filteredClients.length === 0 && (
            <p style={{ color: 'var(--text-muted)', gridColumn: 'span 2', textAlign: 'center', padding: '40px' }}>No clients found.</p>
          )}
        </div>
      ) : (
        <div className="grid-3">
          {filteredAgents.map((agent, idx) => (
            <div className="card" key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>{agent.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <Building size={14} /> {agent.agency || 'Independent'}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <Mail size={14} /> {agent.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <Phone size={14} /> {agent.phone}
                </div>
              </div>
            </div>
          ))}
          {filteredAgents.length === 0 && (
            <p style={{ color: 'var(--text-muted)', gridColumn: 'span 3', textAlign: 'center', padding: '40px' }}>No agents found.</p>
          )}
        </div>
      )}

      {/* Add Client Modal */}
      {showClientModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ width: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Client</h3>
              <button className="modal-close" onClick={() => { setShowClientModal(false); setShowInlineAgentForm(false); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitClient}>
              <div className="modal-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Client Name *</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      required 
                      value={clientForm.name}
                      onChange={(e) => setClientForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Primary Email *</label>
                    <input 
                      type="email" 
                      className="input-control" 
                      required 
                      value={clientForm.primary_email}
                      onChange={(e) => setClientForm(prev => ({ ...prev, primary_email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={clientForm.phone}
                      onChange={(e) => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lead Source *</label>
                    <select 
                      className="input-control select-control" 
                      value={clientForm.lead_source}
                      onChange={(e) => setClientForm(prev => ({ ...prev, lead_source: e.target.value }))}
                    >
                      <option value="Google Advertising">Google Advertising</option>
                      <option value="Facebook Lead">Facebook Lead</option>
                      <option value="Instagram Lead">Instagram Lead</option>
                      <option value="Other Social Media">Other Social Media</option>
                      <option value="Previous Customer / Word of Mouth">Word of Mouth</option>
                      <option value="Referred by Agent">Referred by Agent</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Property Address</label>
                  <input 
                    type="text" 
                    className="input-control" 
                    value={clientForm.address}
                    onChange={(e) => setClientForm(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                {/* Conditional Referring Agent Field (US-1.1, 3.1 step 4) */}
                {clientForm.lead_source === 'Referred by Agent' && (
                  <div className="form-group" style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Which referring agent? *</label>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowInlineAgentForm(!showInlineAgentForm)}
                      >
                        {showInlineAgentForm ? 'Cancel Inline Agent' : '+ Add New Agent Inline'}
                      </button>
                    </div>

                    {showInlineAgentForm ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                        <div className="grid-2">
                          <input 
                            type="text" 
                            placeholder="Agent Name" 
                            className="input-control"
                            value={agentForm.name}
                            onChange={(e) => setAgentForm(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                          <input 
                            type="text" 
                            placeholder="Agency (e.g. McGrath)" 
                            className="input-control"
                            value={agentForm.agency}
                            onChange={(e) => setAgentForm(prev => ({ ...prev, agency: e.target.value }))}
                          />
                        </div>
                        <div className="grid-2">
                          <input 
                            type="text" 
                            placeholder="Phone" 
                            className="input-control"
                            value={agentForm.phone}
                            onChange={(e) => setAgentForm(prev => ({ ...prev, phone: e.target.value }))}
                          />
                          <input 
                            type="email" 
                            placeholder="Email" 
                            className="input-control"
                            value={agentForm.email}
                            onChange={(e) => setAgentForm(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <button type="button" className="btn btn-success btn-sm" onClick={submitAgent}>
                          Save Agent Inline
                        </button>
                      </div>
                    ) : (
                      <select 
                        className="input-control select-control"
                        required
                        value={clientForm.referring_agent_id}
                        onChange={(e) => setClientForm(prev => ({ ...prev, referring_agent_id: e.target.value }))}
                      >
                        <option value="">Select Agent...</option>
                        {agents.map((a, i) => (
                          <option key={i} value={a.id}>{a.name} ({a.agency})</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Secondary Emails Repeaters (US-1.1, 3.1 step 5) */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Secondary Emails (CC on Quoting)</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddSecondaryEmail}>
                      + Add Email
                    </button>
                  </div>
                  {clientForm.secondary_emails.map((email, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        type="email" 
                        placeholder="secondary.email@domain.com"
                        className="input-control"
                        value={email}
                        onChange={(e) => handleSecondaryEmailChange(idx, e.target.value)}
                      />
                      <button 
                        type="button" 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveSecondaryEmail(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label className="form-label">Internal Client Notes</label>
                  <textarea 
                    className="input-control" 
                    rows="3"
                    value={clientForm.notes}
                    onChange={(e) => setClientForm(prev => ({ ...prev, notes: e.target.value }))}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowClientModal(false); setShowInlineAgentForm(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Agent Modal */}
      {showAgentModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ width: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Agent</h3>
              <button className="modal-close" onClick={() => setShowAgentModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitAgent}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Agent Name *</label>
                  <input 
                    type="text" 
                    className="input-control" 
                    required 
                    value={agentForm.name}
                    onChange={(e) => setAgentForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Agency / Brand *</label>
                  <input 
                    type="text" 
                    className="input-control" 
                    placeholder="e.g. McGrath Double Bay"
                    required 
                    value={agentForm.agency}
                    onChange={(e) => setAgentForm(prev => ({ ...prev, agency: e.target.value }))}
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input 
                      type="text" 
                      className="input-control" 
                      value={agentForm.phone}
                      onChange={(e) => setAgentForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input 
                      type="email" 
                      className="input-control" 
                      value={agentForm.email}
                      onChange={(e) => setAgentForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAgentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Agent</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
