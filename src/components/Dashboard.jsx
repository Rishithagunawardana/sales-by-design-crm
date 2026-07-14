import React, { useState, useEffect } from 'react';
import { DollarSign, Briefcase, TrendingUp, XCircle, ArrowUpRight, BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState({
    revenueBooked: 0,
    jobsCount: 0,
    pipelineValue: 0,
    pipelineCount: 0,
    lostQuoteCount: 0,
    lostQuoteValue: 0,
    lostBookingCount: 0,
    leadSources: [],
    agentLeaderboard: []
  });
  const [timeframe, setTimeframe] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?range=${timeframe}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [timeframe]);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading analytics...</div>;
  }

  // Calculate Win/Loss ratio
  const totalClosed = data.jobsCount + data.lostQuoteCount;
  const winRate = totalClosed > 0 ? Math.round((data.jobsCount / totalClosed) * 100) : 100;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Admin Analytics</h2>
        <div className="role-switcher-container">
          <span className="role-switcher-label">Timeframe:</span>
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)} 
            className="role-select"
          >
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4 dashboard-stats">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">Revenue Booked</span>
              <div className="stat-value">${data.revenueBooked.toLocaleString()}</div>
            </div>
            <div style={{ padding: '8px', background: 'var(--success-glow)', color: 'var(--success)', borderRadius: 'var(--radius-sm)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpRight size={14} /> From Confirmed jobs
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">Sales Pipeline</span>
              <div className="stat-value">${data.pipelineValue.toLocaleString()}</div>
            </div>
            <div style={{ padding: '8px', background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)' }}>
              <Briefcase size={20} />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {data.pipelineCount} active quotes
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">Win Rate</span>
              <div className="stat-value">{winRate}%</div>
            </div>
            <div style={{ padding: '8px', background: 'var(--info-glow)', color: 'var(--info)', borderRadius: 'var(--radius-sm)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {data.jobsCount} wins vs {data.lostQuoteCount} losses
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="stat-label">Staged Cancellations</span>
              <div className="stat-value">{data.lostBookingCount}</div>
            </div>
            <div style={{ padding: '8px', background: 'var(--danger-glow)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)' }}>
              <XCircle size={20} />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Cancelled after booking confirmed
          </p>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid-2" style={{ marginBottom: '32px' }}>
        {/* Custom SVG Pipeline Chart */}
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="var(--primary)" /> Lead Sourcing (Revenue)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '240px', justifyContent: 'center' }}>
            {data.leadSources.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No lead source data for this period.</p>
            ) : (
              data.leadSources.map((source, index) => {
                const maxVal = Math.max(...data.leadSources.map(s => s.value), 1);
                const percent = Math.round((source.value / maxVal) * 100);
                return (
                  <div key={index}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '500' }}>{source.lead_source}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {source.count} jobs • <strong>${source.value.toLocaleString()}</strong>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${percent}%`, 
                        height: '100%', 
                        background: `linear-gradient(90deg, var(--primary), var(--info))`,
                        borderRadius: '4px',
                        transition: 'width 1s ease-out'
                      }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Custom SVG Revenue Gauge & Pipeline Breakdown */}
        <div className="card">
          <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>Pipeline Distribution</h3>
          <div style={{ display: 'flex', height: '240px', alignItems: 'flex-end', gap: '16px', padding: '10px 20px 20px 20px', borderBottom: '1px solid var(--border)' }}>
            {/* Custom SVG Bar Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
              <div style={{ 
                width: '32px', 
                height: `${Math.min(100, Math.round((data.pipelineValue / (data.revenueBooked + data.pipelineValue || 1)) * 150))}px`,
                background: 'var(--primary-glow)',
                border: '1px solid var(--primary)',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.8s ease'
              }}></div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pipeline</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
              <div style={{ 
                width: '32px', 
                height: `${Math.min(150, Math.round((data.revenueBooked / (data.revenueBooked + data.pipelineValue || 1)) * 150))}px`,
                background: 'var(--success-glow)',
                border: '1px solid var(--success)',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.8s ease'
              }}></div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Won</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
              <div style={{ 
                width: '32px', 
                height: `${Math.min(100, Math.round((data.lostQuoteValue / (data.revenueBooked + data.lostQuoteValue || 1)) * 150))}px`,
                background: 'var(--danger-glow)',
                border: '1px solid var(--danger)',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.8s ease'
              }}></div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lost</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
            <span>Pipeline: ${data.pipelineValue.toLocaleString()}</span>
            <span>Booked: ${data.revenueBooked.toLocaleString()}</span>
            <span>Lost: ${data.lostQuoteValue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Agent Referrals Leaderboard */}
      <div className="card">
        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Agent Referral Leaderboard</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Agency</th>
                <th style={{ textAlign: 'center' }}>Referrals Count</th>
                <th style={{ textAlign: 'right' }}>Total Value Generated</th>
              </tr>
            </thead>
            <tbody>
              {data.agentLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                    No agent referral data found.
                  </td>
                </tr>
              ) : (
                data.agentLeaderboard.map((agent, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: '600' }}>{agent.name}</td>
                    <td>{agent.agency}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-info">{agent.jobs_count} Referrals</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>
                      ${agent.total_revenue.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
