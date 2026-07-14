import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Clock, ArrowRight, Eye, RefreshCw } from 'lucide-react';

export default function EmailSimulator({ onOpenMagicLink }) {
  const [comms, setComms] = useState([]);
  const [activeCommId, setActiveCommId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchComms = () => {
    setLoading(true);
    fetch('/api/communications')
      .then(res => res.json())
      .then(data => {
        setComms(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchComms();
  }, []);

  const activeComm = comms.find(c => c.id === activeCommId);

  return (
    <div style={{ display: 'flex', gap: '32px', height: 'calc(100vh - 140px)' }}>
      {/* List */}
      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Outbound Communication Log</h2>
          <button className="btn btn-secondary btn-sm" style={{ padding: '6px' }} onClick={fetchComms} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>

        <div className="table-container" style={{ flexGrow: 1, overflowY: 'auto', background: 'var(--bg-card)' }}>
          {comms.map((c, idx) => (
            <div 
              key={idx}
              onClick={() => setActiveCommId(c.id)}
              style={{
                padding: '16px',
                borderBottom: '1px solid var(--border-light)',
                cursor: 'pointer',
                background: activeCommId === c.id ? 'var(--primary-glow)' : 'transparent',
                transition: 'background 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {c.type === 'Email' ? <Mail size={12} /> : <MessageSquare size={12} />} {c.type}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.sent_at.split(' ')[0]}</span>
              </div>
              <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.subject}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To: {c.recipient}</p>
            </div>
          ))}
          {comms.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>No communications sent yet.</p>
          )}
        </div>
      </div>

      {/* Simulator Workspace */}
      <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '24px' }}>
        {activeComm ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header info */}
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{activeComm.subject}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '10px' }}>
                <div>Recipient: <strong style={{ color: 'var(--text-main)' }}>{activeComm.recipient}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {activeComm.sent_at}</div>
              </div>
            </div>

            {/* Simulated Email Body Frame */}
            <div style={{ flexGrow: 1, background: '#090b11', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '24px', whiteSpace: 'pre-line', fontSize: '14px', color: '#e2e8f0', fontFamily: 'monospace', overflowY: 'auto' }}>
              {activeComm.body}
            </div>

            {/* Portal Action Trigger (US-0.2) */}
            {activeComm.body.includes('http://localhost:3000/portal/') && (
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    const isQuote = activeComm.body.includes('/portal/quote/');
                    const id = activeComm.body.split(isQuote ? '/portal/quote/' : '/portal/job/')[1].split('\n')[0];
                    onOpenMagicLink(isQuote ? 'quote' : 'job', id);
                  }}
                  style={{ gap: '8px' }}
                >
                  <Eye size={16} /> Open Client Portal Magic Link <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '12px' }}>
            <Mail size={48} strokeWidth={1} />
            <p>Select a simulated message from the logger list to view client content.</p>
          </div>
        )}
      </div>
    </div>
  );
}
