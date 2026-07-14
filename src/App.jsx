import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, FileText, Briefcase, Calendar as CalendarIcon, 
  Truck, CheckSquare, Key, Mail, ShieldAlert, DollarSign, Plus, LogOut, ArrowRight,
  TrendingUp, Clock, AlertTriangle, Eye, ShieldCheck, Camera, MessageSquare, UserPlus, X
} from 'lucide-react';

// Sub-components
import Dashboard from './components/Dashboard';
import ClientList from './components/ClientList';
import QuoteBuilder from './components/QuoteBuilder';
import JobSourcing from './components/JobAssembly';
import Logistics from './components/Logistics';
import CrewView from './components/CrewView';
import CalendarView from './components/CalendarView';
import EndOfHire from './components/EndOfHire';
import EmailSimulator from './components/EmailSimulator';
import ClientPortal from './components/ClientPortal';
import Profitability from './components/Profitability';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';
import RegisterUser from './components/RegisterUser';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sbd_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeRole, setActiveRole] = useState(() => {
    const saved = localStorage.getItem('sbd_role');
    return saved || 'Admin';
  });
  const [activeView, setActiveView] = useState(() => {
    const saved = localStorage.getItem('sbd_view');
    return saved || 'dashboard';
  });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sbd_user', JSON.stringify(currentUser));
      localStorage.setItem('sbd_role', activeRole);
      localStorage.setItem('sbd_view', activeView);
    } else {
      localStorage.removeItem('sbd_user');
      localStorage.removeItem('sbd_role');
      localStorage.removeItem('sbd_view');
    }
  }, [currentUser, activeRole, activeView]);
  const [selectedJobIdForSourcing, setSelectedJobIdForSourcing] = useState(null);
  const [selectedQuoteIdForBuilder, setSelectedQuoteIdForBuilder] = useState(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    const handleUpdate = (e) => {
      setUnreadChatCount(e.detail);
    };
    window.addEventListener('chat-unread-updated', handleUpdate);
    return () => window.removeEventListener('chat-unread-updated', handleUpdate);
  }, []);
  
  // Client portal magic link states
  const [portalType, setPortalType] = useState('quote'); // 'quote' | 'job'
  const [portalId, setPortalId] = useState(null);

  // General Jobs List tab
  const [jobs, setJobs] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedJobForSchedule, setSelectedJobForSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    installation_date: '',
    is_tbc: false
  });

  const [showStylingModal, setShowStylingModal] = useState(false);
  const [selectedJobForStyling, setSelectedJobForStyling] = useState(null);
  const [stylingPhotoUrl, setStylingPhotoUrl] = useState('');

  const fetchJobs = () => {
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => setJobs(data))
      .catch(e => console.error(e));
  };

  useEffect(() => {
    fetchJobs();
  }, [activeView]);

  // Handle auto-routing when switching roles
  useEffect(() => {
    if (!isMounted) return;
    if (activeRole === 'Admin') {
      setActiveView('dashboard');
    } else if (activeRole === 'Head Stylist/Management') {
      setActiveView('quotes');
    } else if (activeRole === 'Stylist') {
      setActiveView('jobs-list'); // default to jobs list to start sourcing
    } else if (activeRole === 'Removalist Crew') {
      setActiveView('crew-run');
    }
  }, [activeRole, isMounted]);

  const handleOpenMagicLink = (type, id) => {
    setPortalType(type);
    setPortalId(id);
    setActiveRole('Client');
    setActiveView('client-portal');
  };

  const handleOpenJobSourcing = (jobId) => {
    setSelectedJobIdForSourcing(jobId);
    setActiveView('job-sourcing');
  };

  const handleOpenQuoteBuilder = (quoteId) => {
    setSelectedQuoteIdForBuilder(quoteId);
    setActiveView('quotes');
  };

  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    fetch(`/api/jobs/${selectedJobForSchedule.id}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduleForm)
    })
      .then(res => res.json())
      .then(() => {
        fetchJobs();
        setShowScheduleModal(false);
        setSelectedJobForSchedule(null);
      });
  };

  // CC mock sync to Xero (US-8.1)
  const handleSyncToXero = (jobId) => {
    fetch('/api/xero-mock/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: jobId, type: 'job' })
    })
      .then(res => res.json())
      .then(res => {
        alert(`Invoice synchronized with Xero!\nInvoice Code: ${res.invoice_number}\nAmount Synced: $${res.amount_synced}`);
      });
  };

  const handleStylingSubmit = (e) => {
    e.preventDefault();
    fetch(`/api/jobs/${selectedJobForStyling.id}/complete-styling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_url: stylingPhotoUrl || 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=500&auto=format&fit=crop'
      })
    })
      .then(res => res.json())
      .then(() => {
        fetchJobs();
        setShowStylingModal(false);
        setSelectedJobForStyling(null);
        setStylingPhotoUrl('');
        alert('Styling marked complete. Outbound completion notifications sent.');
      });
  };

  // Navigations Links per Role
  const renderSidebarLinks = () => {
    const links = [];

    if (activeRole === 'Admin') {
      links.push(
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { id: 'clients', label: 'Clients & Agents', icon: <Users size={18} /> },
        { id: 'quotes', label: 'Quotes & Builder', icon: <FileText size={18} /> },
        { id: 'proposals', label: 'Proposals', icon: <FileText size={18} />, external: true, url: '/Proposal system/dashboard.html' },
        { id: 'jobs-list', label: 'Jobs Directory', icon: <Briefcase size={18} /> },
        { id: 'logistics', label: 'Logistics Dispatch', icon: <Truck size={18} /> },
        { id: 'calendar', label: 'Shared Calendar', icon: <CalendarIcon size={18} /> },
        { id: 'end-of-hire', label: 'End of Hire Tracker', icon: <Clock size={18} /> },
        { id: 'profitability', label: 'Profit Analyzer', icon: <DollarSign size={18} /> },
        { id: 'emails', label: 'Communication Log', icon: <Mail size={18} /> },
        { id: 'register-staff', label: 'Register User', icon: <UserPlus size={18} /> },
        { id: 'chat', label: 'Company Chat', icon: <MessageSquare size={18} />, badge: unreadChatCount > 0 ? unreadChatCount : null }
      );
    } else if (activeRole === 'Head Stylist/Management') {
      links.push(
        { id: 'clients', label: 'Clients & Agents', icon: <Users size={18} /> },
        { id: 'quotes', label: 'Quotes & Builder', icon: <FileText size={18} /> },
        { id: 'proposals', label: 'Proposals', icon: <FileText size={18} />, external: true, url: '/Proposal system/dashboard.html' },
        { id: 'jobs-list', label: 'Jobs Directory', icon: <Briefcase size={18} /> },
        { id: 'logistics', label: 'Logistics Dispatch', icon: <Truck size={18} /> },
        { id: 'calendar', label: 'Shared Calendar', icon: <CalendarIcon size={18} /> },
        { id: 'end-of-hire', label: 'End of Hire Tracker', icon: <Clock size={18} /> },
        { id: 'emails', label: 'Communication Log', icon: <Mail size={18} /> },
        { id: 'chat', label: 'Company Chat', icon: <MessageSquare size={18} />, badge: unreadChatCount > 0 ? unreadChatCount : null }
      );
    } else if (activeRole === 'Stylist') {
      links.push(
        { id: 'jobs-list', label: 'Sourcing Workstation', icon: <Briefcase size={18} /> },
        { id: 'calendar', label: 'Shared Calendar', icon: <CalendarIcon size={18} /> },
        { id: 'chat', label: 'Company Chat', icon: <MessageSquare size={18} />, badge: unreadChatCount > 0 ? unreadChatCount : null }
      );
    } else if (activeRole === 'Removalist Crew') {
      links.push(
        { id: 'crew-run', label: 'My Run Sheets', icon: <Truck size={18} /> },
        { id: 'chat', label: 'Company Chat', icon: <MessageSquare size={18} />, badge: unreadChatCount > 0 ? unreadChatCount : null }
      );
    }

    return (
      <div className="nav-links">
        {links.map((link, idx) => (
          <div 
            key={idx} 
            className={`nav-link ${activeView === link.id ? 'active' : ''}`}
            onClick={() => {
              if (link.external) {
                window.open(link.url, '_blank');
              } else {
                setActiveView(link.id);
              }
            }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {link.icon}
              <span>{link.label}</span>
            </div>
            {link.badge && (
              <span 
                style={{ 
                  borderRadius: '50%', 
                  width: '18px', 
                  height: '18px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '9px', 
                  fontWeight: '700',
                  backgroundColor: 'var(--danger)',
                  color: '#fff',
                  boxShadow: '0 0 6px var(--danger)',
                  flexShrink: 0
                }}
              >
                {link.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render Page Content based on Active View
  const renderViewContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <ClientList />;
      case 'quotes':
        return (
          <QuoteBuilder 
            onNavigateToJob={() => setActiveView('jobs-list')} 
            onNavigateToQuote={(id) => handleOpenQuoteBuilder(id)}
          />
        );
      case 'job-sourcing':
        return <JobSourcing jobId={selectedJobIdForSourcing} onBack={() => setActiveView('jobs-list')} />;
      case 'logistics':
        return <Logistics />;
      case 'calendar':
        return (
          <CalendarView 
            onNavigateToJob={handleOpenJobSourcing}
            onNavigateToQuote={handleOpenQuoteBuilder}
          />
        );
      case 'end-of-hire':
        return <EndOfHire onNavigateToJob={handleOpenJobSourcing} />;
      case 'profitability':
        return <Profitability />;
      case 'emails':
        return <EmailSimulator onOpenMagicLink={handleOpenMagicLink} />;
      case 'crew-run':
        return <CrewView />;
      case 'chat':
        return <ChatRoom currentUser={currentUser} />;
      case 'register-staff':
        return <RegisterUser />;
      case 'jobs-list':
      default:
        return renderJobsDirectory();
    }
  };

  // Renders a generic checklist directory of jobs for stylists and admins
  const renderJobsDirectory = () => {
    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Active Jobs Directory</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Central operations list of staging jobs, scheduling dates, and stylist sourcing handoffs.</p>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Client</th>
                  <th>Property Address</th>
                  <th>Installation Date</th>
                  <th>Status</th>
                  <th>Stylist Assigned</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, idx) => (
                  <tr key={idx}>
                    <td>Job-{job.id}</td>
                    <td style={{ fontWeight: '600' }}>{job.client_name}</td>
                    <td>{job.client_address}</td>
                    <td>{job.is_tbc ? <span className="badge badge-warning">TBC Date</span> : job.installation_date}</td>
                    <td>
                      <span className={`badge ${
                        job.status === 'Styled/Live' ? 'badge-success' :
                        job.status === 'Confirmed' ? 'badge-info' :
                        job.status === 'In Progress' ? 'badge-primary' :
                        'badge-secondary'
                      }`}>{job.status}</span>
                    </td>
                    <td>{job.stylist_name || 'Unassigned'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {/* Mock sync invoice button */}
                        {activeRole === 'Admin' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleSyncToXero(job.id)}>
                            Xero Invoice
                          </button>
                        )}
                        {['Booked', 'Confirmed', 'Install Scheduled', 'In Progress'].includes(job.status) && (
                          <button className="btn btn-success btn-sm" onClick={() => {
                            setSelectedJobForStyling(job);
                            setStylingPhotoUrl('');
                            setShowStylingModal(true);
                          }}>
                            Complete Styling
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          setSelectedJobForSchedule(job);
                          setScheduleForm({ installation_date: job.installation_date || '', is_tbc: !!job.is_tbc });
                          setShowScheduleModal(true);
                        }}>
                          Date/Schedule
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenJobSourcing(job.id)}>
                          Source Items
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // If Client role is active, render Sandboxed Client Magic Portal
  if (activeRole === 'Client' && activeView === 'client-portal') {
    return (
      <ClientPortal 
        portalType={portalType} 
        id={portalId} 
        onBackToStaff={() => {
          if (currentUser) {
            setActiveRole(currentUser.role);
            if (currentUser.role === 'Admin') setActiveView('emails');
            else if (currentUser.role === 'Head Stylist/Management') setActiveView('emails');
            else if (currentUser.role === 'Stylist') setActiveView('jobs-list');
            else setActiveView('crew-run');
          } else {
            setActiveRole('Admin');
            setActiveView('emails');
          }
        }}
      />
    );
  }

  // If no user is logged in, render the login page
  if (!currentUser) {
    return (
      <Login 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setActiveRole(user.role);
        }} 
      />
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <div className="logo-section">
            <div className="logo-icon">S</div>
            <div className="logo-text">Design Staging</div>
          </div>
          {renderSidebarLinks()}
        </div>
      </aside>

      {/* Main app panel */}
      <div className="main-content">
        <header className="top-bar">
          <div className="page-title-section">
            <h1 style={{ textTransform: 'capitalize' }}>
              {activeView === 'jobs-list' ? 'Jobs Directory' : activeView.replace('-', ' ')}
            </h1>
          </div>

          <div className="top-bar-actions">
            {/* Live progress pulse */}
            {activeRole === 'Admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.05)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.15)', fontSize: '12px' }}>
                <span className="pulse-indicator"></span>
                <span style={{ color: 'var(--success)', fontWeight: '600' }}>Logistics Crews Live</span>
              </div>
            )}

            {/* Logged in User Profile & Log Out */}
            {currentUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{currentUser.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{currentUser.role}</span>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                  onClick={() => {
                    setCurrentUser(null);
                    setActiveRole('Admin');
                  }}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="page-body">
          {renderViewContent()}
        </main>
      </div>

      {/* Schedule Job Date Modal */}
      {showScheduleModal && selectedJobForSchedule && (
        <div className="modal-backdrop">
          <form onSubmit={handleScheduleSubmit} className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Schedule Staging Dates</h3>
              <button type="button" className="modal-close" onClick={() => { setShowScheduleModal(false); setSelectedJobForSchedule(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="scheduleType" 
                    checked={!scheduleForm.is_tbc}
                    onChange={() => setScheduleForm(prev => ({ ...prev, is_tbc: false }))}
                  />
                  Set Installation Date
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="scheduleType" 
                    checked={scheduleForm.is_tbc}
                    onChange={() => setScheduleForm(prev => ({ ...prev, is_tbc: true, installation_date: '' }))}
                  />
                  Mark as TBC (Flexible)
                </label>
              </div>

              {!scheduleForm.is_tbc && (
                <div className="form-group">
                  <label className="form-label">Installation Date *</label>
                  <input 
                    type="date" 
                    className="input-control" 
                    required 
                    value={scheduleForm.installation_date}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, installation_date: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowScheduleModal(false); setSelectedJobForSchedule(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!scheduleForm.is_tbc && !scheduleForm.installation_date}>Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* Complete Styling Modal */}
      {showStylingModal && selectedJobForStyling && (
        <div className="modal-backdrop">
          <form onSubmit={handleStylingSubmit} className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Mark Styling Complete</h3>
              <button type="button" className="modal-close" onClick={() => { setShowStylingModal(false); setSelectedJobForStyling(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Complete styling visit for <strong>{selectedJobForStyling.client_name}</strong>. This triggers the client photo gallery completion email.
              </p>
              
              <div className="form-group">
                <label className="form-label">Completion Photo URL (Default pre-seeded if blank)</label>
                <input 
                  type="text" 
                  placeholder="https://images.unsplash.com/photo-..." 
                  className="input-control"
                  value={stylingPhotoUrl}
                  onChange={(e) => setStylingPhotoUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowStylingModal(false); setSelectedJobForStyling(null); }}>Cancel</button>
              <button type="submit" className="btn btn-success">Complete & Notify Client</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
