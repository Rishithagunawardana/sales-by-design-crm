import React, { useState, useEffect } from 'react';
import { Calendar, Filter, Users, Truck, CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function CalendarView({ onNavigateToJob, onNavigateToQuote }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [quotes, setQuotes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  // Filters
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('');

  // Modals
  const [selectedEvent, setSelectedEvent] = useState(null);

  const fetchData = () => {
    fetch('/api/quotes').then(res => res.json()).then(data => setQuotes(data));
    fetch('/api/jobs').then(res => res.json()).then(data => setJobs(data));
    fetch('/api/staff').then(res => res.json()).then(data => setStaff(data));
    fetch('/api/vehicles').then(res => res.json()).then(data => setVehicles(data));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter events
  const getFilteredEvents = () => {
    const events = [];

    // Add quote site visits
    for (const q of quotes) {
      if (q.status === 'Scheduled' && q.visit_date) {
        if (selectedStaffFilter && parseInt(selectedStaffFilter) !== q.visit_assigned_to) continue;
        events.push({
          type: 'visit',
          date: q.visit_date,
          label: `Visit: ${q.client_name || q.agent_name}`,
          color: 'var(--warning)',
          details: { ...q, visit_inspector_name: staff.find(s => s.id === q.visit_assigned_to)?.name }
        });
      }
    }

    // Add job installs & pickups
    for (const j of jobs) {
      if (j.status === 'Cancelled') continue;
      
      // Filter by crew/stylist/vehicle
      if (selectedStaffFilter && parseInt(selectedStaffFilter) !== j.stylist_id) continue;
      if (selectedVehicleFilter && parseInt(selectedVehicleFilter) !== j.vehicle_id) continue;

      if (j.installation_date) {
        events.push({
          type: 'install',
          date: j.installation_date,
          label: `Install: ${j.client_name}`,
          color: 'var(--success)',
          details: j
        });
      }

      if (j.hire_end_date && ['De-install Scheduled', 'Completed', 'Ended'].includes(j.status)) {
        events.push({
          type: 'pickup',
          date: j.hire_end_date,
          label: `De-stage: ${j.client_name}`,
          color: 'var(--info)',
          details: j
        });
      }
    }

    return events;
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Calendar Days Math
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    
    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        dateString: new Date(year, month - 1, prevMonthDays - i).toISOString().split('T')[0],
        inactive: true
      });
    }

    // Active month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        dateString: new Date(year, month, i).toISOString().split('T')[0],
        inactive: false
      });
    }

    // Next month padding
    const nextPadding = 42 - days.length;
    for (let i = 1; i <= nextPadding; i++) {
      days.push({
        day: i,
        dateString: new Date(year, month + 1, i).toISOString().split('T')[0],
        inactive: true
      });
    }

    return days;
  };

  const activeEvents = getFilteredEvents();
  const calendarDays = getDaysInMonth();

  // Find TBC flexible bookings (no dates)
  const tbcBookings = jobs.filter(j => j.is_tbc === 1 && j.status !== 'Cancelled');

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div style={{ display: 'flex', gap: '32px' }}>
      {/* Sidebar - TBC Bookings Placeholder lists (US-6.1, Section 8) */}
      <div style={{ width: '280px', flexShrink: 0 }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          TBC Bookings (Flexible)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
          {tbcBookings.map((tbc, idx) => (
            <div 
              key={idx} 
              className="card" 
              style={{ padding: '12px', cursor: 'pointer', background: 'rgba(115, 98, 255, 0.03)' }}
              onClick={() => onNavigateToJob(tbc.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-warning" style={{ fontSize: '9px' }}>TBC Date</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Job-{tbc.id}</span>
              </div>
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginTop: '6px' }}>{tbc.client_name}</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{tbc.client_address || 'Address pending'}</p>
            </div>
          ))}
          {tbcBookings.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No active TBC placeholders.</p>
          )}
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div style={{ flexGrow: 1 }}>
        {/* Toolbar Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px' }} onClick={prevMonth}><ChevronLeft size={16} /></button>
            <h3 style={{ fontSize: '18px', fontWeight: '700', minWidth: '150px', textAlign: 'center' }}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px' }} onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Staff Filter */}
            <div className="role-switcher-container">
              <Users size={12} color="var(--text-muted)" />
              <select 
                className="role-select" 
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
              >
                <option value="">All Staff</option>
                {staff.map((s, i) => (
                  <option key={i} value={s.id}>{s.name} ({s.role.split('/')[0]})</option>
                ))}
              </select>
            </div>

            {/* Vehicle Filter */}
            <div className="role-switcher-container">
              <Truck size={12} color="var(--text-muted)" />
              <select 
                className="role-select" 
                value={selectedVehicleFilter}
                onChange={(e) => setSelectedVehicleFilter(e.target.value)}
              >
                <option value="">All Vehicles</option>
                {vehicles.map((v, i) => (
                  <option key={i} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Days Header */}
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dName, idx) => (
            <div className="calendar-header-day" key={idx}>{dName}</div>
          ))}

          {/* Grid Cells */}
          {calendarDays.map((cell, idx) => {
            const dateStr = cell.dateString;
            const events = activeEvents.filter(e => e.date === dateStr);
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            return (
              <div 
                key={idx} 
                className={`calendar-cell ${cell.inactive ? 'inactive' : ''} ${isToday ? 'today' : ''}`}
              >
                <span className="calendar-day-num">{cell.day}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', flexGrow: 1 }}>
                  {events.map((ev, eIdx) => (
                    <div 
                      key={eIdx}
                      className="calendar-event"
                      style={{ background: ev.color, color: 'var(--bg-main)' }}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      {ev.label}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Details Dialog Modal */}
      {selectedEvent && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ width: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Calendar Event Details</h3>
              <button className="modal-close" onClick={() => setSelectedEvent(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span className="stat-label">Event Type</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: selectedEvent.color }}></div>
                    <strong style={{ textTransform: 'capitalize' }}>{selectedEvent.type}</strong>
                  </div>
                </div>

                <div>
                  <span className="stat-label">Client / Agent Name</span>
                  <p style={{ fontSize: '15px', fontWeight: '600' }}>
                    {selectedEvent.type === 'visit' ? (selectedEvent.details.client_name || selectedEvent.details.agent_name) : selectedEvent.details.client_name}
                  </p>
                </div>

                <div>
                  <span className="stat-label">Scheduled Date</span>
                  <p style={{ fontSize: '14px' }}>{selectedEvent.date}</p>
                </div>

                {selectedEvent.type === 'visit' ? (
                  <>
                    <div>
                      <span className="stat-label">Inspector Assigned</span>
                      <p style={{ fontSize: '14px' }}>{selectedEvent.details.visit_inspector_name || 'Emma Stylist'}</p>
                    </div>
                    <div>
                      <span className="stat-label">Visit Type</span>
                      <span className="badge badge-secondary" style={{ marginTop: '4px' }}>{selectedEvent.details.visit_type}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="stat-label">Property Address</span>
                      <p style={{ fontSize: '14px' }}>{selectedEvent.details.client_address}</p>
                    </div>
                    <div>
                      <span className="stat-label">Job Sourcing Status</span>
                      <p style={{ fontSize: '14px' }}>{selectedEvent.details.status}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)}>Close</button>
              {selectedEvent.type === 'visit' ? (
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    onNavigateToQuote(selectedEvent.details.id);
                    setSelectedEvent(null);
                  }}
                >
                  Edit Quote Visit
                </button>
              ) : (
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    onNavigateToJob(selectedEvent.details.id);
                    setSelectedEvent(null);
                  }}
                >
                  Manage Job Sourcing
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
