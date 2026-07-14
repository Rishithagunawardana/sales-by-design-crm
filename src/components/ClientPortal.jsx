import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle2, Image, Send, FileText, Download } from 'lucide-react';

export default function ClientPortal({ portalType, id, onBackToStaff }) {
  const [data, setData] = useState(null);
  const [signedName, setSignedName] = useState('');
  const [isDrawn, setIsDrawn] = useState(false);
  const [success, setSuccess] = useState(false);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const fetchPortalData = () => {
    const url = portalType === 'quote' ? `/api/quotes/${id}` : `/api/jobs/${id}`;
    fetch(url)
      .then(res => res.json())
      .then(data => setData(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchPortalData();
  }, [portalType, id]);

  // Sign canvas controls
  useEffect(() => {
    if (portalType === 'quote' && !success && data && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = 'var(--primary)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
    }
  }, [portalType, success, data]);

  const startDrawing = (e) => {
    isDrawing.current = true;
    setIsDrawn(true);
    draw(e);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const draw = (e) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Support mouse and touch
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    setIsDrawn(false);
  };

  const handleSignQuoteSubmit = (e) => {
    e.preventDefault();
    if (!signedName) return;

    fetch(`/api/quotes/${id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: signedName,
        signature_data: isDrawn ? canvasRef.current.toDataURL() : 'typed'
      })
    })
      .then(res => res.json())
      .then(() => {
        setSuccess(true);
      })
      .catch(err => console.error(err));
  };

  if (!data) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px' }}>Accessing secure portal...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090b11', color: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
      {/* Sandbox client-facing header */}
      <header style={{ height: '70px', background: 'rgba(13, 16, 26, 0.9)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="logo-icon">S</div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '18px' }}>Sales by Design Portal</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onBackToStaff}>
          Back to Staff Panel (Demo Mode)
        </button>
      </header>

      <main style={{ flexGrow: 1, padding: '40px 16px', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
        {success ? (
          /* Agreement Confirmed Screen */
          <div className="card" style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <CheckCircle2 size={64} color="var(--success)" />
            <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Agreement Signed & Confirmed!</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '500px' }}>
              Dear {data.client_name}, thank you for accepting our staging quote. We have logged your digital signature. Your booking has been locked in, and our team will coordinate the logistics schedule shortly.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '16px', width: '100%', maxWidth: '400px' }}>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}>Staging Property: <strong>{data.client_address}</strong></div>
              <div style={{ fontSize: '14px' }}>Hire Period: <strong>{data.hire_duration}</strong></div>
            </div>
          </div>
        ) : portalType === 'quote' ? (
          /* Quote Contract Form (US-0.2, 1.3, 2.4) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px' }}>Staging Quote Agreement</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Quote Reference: Q-{data.id} • Prepared for {data.client_name}</p>
              
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <span className="stat-label">Hire Duration</span>
                  <p style={{ fontWeight: '600' }}>{data.hire_duration}</p>
                </div>
                <div>
                  <span className="stat-label">Property Address</span>
                  <p style={{ fontWeight: '600' }}>{data.client_address}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="stat-label">Fixed Quote Total</span>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--success)' }}>${data.flat_price.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Sourced Items list showcase */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--primary)" /> Furniture & Styling Inclusions
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.rooms?.map((room, rIdx) => (
                  <div key={rIdx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px' }}>{room.label}</h4>
                    <ul style={{ paddingLeft: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {room.line_items?.map((item, iIdx) => (
                        <li key={iIdx}>
                          {item.item_name} {item.attribute && `(${item.attribute})`} — <strong>Qty: {item.quantity}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Terms and Signature pad (US-0.2) */}
            <form onSubmit={handleSignQuoteSubmit} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Terms & Conditions Agreement</h3>
                <div style={{ height: '120px', overflowY: 'auto', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  <p>1. <strong>Hire Period:</strong> The hire period begins on the day of delivery/installation and extends for the duration selected (6 or 8 weeks) unless extended in writing by Sales by Design.</p>
                  <p style={{ marginTop: '8px' }}>2. <strong>Inventory Care:</strong> The Client agrees to maintain the staged furniture in pristine condition. Any damage, stains, or missing items will trigger replacement recharge fees logged by staff.</p>
                  <p style={{ marginTop: '8px' }}>3. <strong>Access:</strong> The Client must arrange property keys safe access codes for removalist crews on both installation and de-installation pickup days.</p>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Type Your Full Name *</label>
                  <input 
                    type="text" 
                    className="input-control" 
                    required 
                    placeholder="Signature Name" 
                    value={signedName}
                    onChange={(e) => setSignedName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Draw Your Signature</label>
                    {isDrawn && (
                      <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '9px', padding: '2px 6px' }} onClick={clearSignature}>
                        Clear
                      </button>
                    )}
                  </div>
                  
                  {/* Canvas Signature Pad */}
                  <div className="signature-pad-container">
                    <canvas 
                      ref={canvasRef} 
                      className="signature-pad-canvas"
                      onMouseDown={startDrawing}
                      onMouseUp={stopDrawing}
                      onMouseMove={draw}
                      onTouchStart={startDrawing}
                      onTouchEnd={stopDrawing}
                      onTouchMove={draw}
                      width={350}
                      height={198}
                    ></canvas>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '16px', fontSize: '16px', gap: '8px' }}>
                <ShieldCheck size={18} /> Sign Agreement & Authorize Installation
              </button>
            </form>
          </div>
        ) : (
          /* Job Styled Photos Completion Portal (US-4.2) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 12px auto' }} />
              <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Your Property has been Styled!</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Staged Location: {data.client_address}</p>
            </div>

            {/* Visual Gallery Showcase */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image size={18} color="var(--primary)" /> Staging Completion Photos Gallery
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {data.photos?.filter(p => p.type === 'After/Completed').map((photo, pIdx) => (
                  <div key={pIdx} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-light)', position: 'relative' }}>
                    <img 
                      src={photo.url} 
                      alt="Styled Room" 
                      style={{ width: '100%', height: '240px', objectFit: 'cover' }} 
                    />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px', background: 'rgba(0,0,0,0.6)', fontSize: '12px', fontWeight: '600' }}>
                      {photo.room_name || 'Styled Room'}
                    </div>
                  </div>
                ))}
              </div>
              
              {(!data.photos || data.photos.filter(p => p.type === 'After/Completed').length === 0) && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Styling photos will appear here once the stylist uploads them.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
