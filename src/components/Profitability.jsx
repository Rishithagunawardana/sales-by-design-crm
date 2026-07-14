import React, { useState, useEffect } from 'react';
import { DollarSign, Percent, AlertTriangle, TrendingDown, RefreshCw, Layers } from 'lucide-react';

export default function Profitability() {
  const [profitRecords, setProfitRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfitRecords = () => {
    setLoading(true);
    fetch('/api/profitability/jobs')
      .then(res => res.json())
      .then(data => {
        setProfitRecords(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProfitRecords();
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading profitability ledger...</div>;
  }

  // Calculate aggregates
  const totalRevenue = profitRecords.reduce((acc, r) => acc + r.revenue, 0);
  const totalCost = profitRecords.reduce((acc, r) => acc + r.costs.total, 0);
  const totalProfit = totalRevenue - totalCost;
  const averageMargin = profitRecords.length > 0 
    ? Math.round((profitRecords.reduce((acc, r) => acc + r.margin, 0) / profitRecords.length) * 10) / 10
    : 0;

  // Count low margins
  const lowMarginJobs = profitRecords.filter(r => r.margin < 20);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Job Profitability Analyzer</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Roll up real-time logged removalist hours, vehicle fees, and inventory depreciation rates to inspect margins.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchProfitRecords}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Aggregate Cards */}
      <div className="grid-4 dashboard-stats">
        <div className="card">
          <span className="stat-label">Staging Revenue</span>
          <div className="stat-value">${totalRevenue.toLocaleString()}</div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--danger)' }}>
          <span className="stat-label">Staging Costs</span>
          <div className="stat-value" style={{ background: 'linear-gradient(to right, #ef4444, #f87171)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ${totalCost.toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--success)' }}>
          <span className="stat-label">Net Gross Profit</span>
          <div className="stat-value" style={{ background: 'linear-gradient(to right, #10b981, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ${totalProfit.toLocaleString()}
          </div>
        </div>
        <div className="card">
          <span className="stat-label">Average Margin %</span>
          <div className="stat-value">{averageMargin}%</div>
        </div>
      </div>

      {/* Low Margin Alert Banner (US-9.2) */}
      {lowMarginJobs.length > 0 && (
        <div className="conflict-warning-badge" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={18} />
          <div>
            <strong>Low Margin Warning!</strong>
            <p style={{ fontSize: '12px', marginTop: '2px' }}>
              We detected {lowMarginJobs.length} active job(s) yielding margins below the company <strong>20% threshold</strong>. Consider reviewing labor assignments or package valuations.
            </p>
          </div>
        </div>
      )}

      {/* Profitability Ledger Table (US-9.1) */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Staging Job Ledger</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Client Name</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Labour Cost</th>
                <th style={{ textAlign: 'right' }}>Vehicle Cost</th>
                <th style={{ textAlign: 'right' }}>Inventory Cost</th>
                <th style={{ textAlign: 'right' }}>Damage Cost</th>
                <th style={{ textAlign: 'right' }}>Total Cost</th>
                <th style={{ textAlign: 'right' }}>Gross Profit</th>
                <th style={{ textAlign: 'right' }}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {profitRecords.map((record, idx) => {
                const isLow = record.margin < 20;
                return (
                  <tr key={idx} style={{ background: isLow ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                    <td>Job-{record.id}</td>
                    <td style={{ fontWeight: '600' }}>
                      {record.client}
                      {isLow && (
                        <span className="badge badge-danger" style={{ fontSize: '9px', marginLeft: '6px', padding: '2px 6px' }}>
                          Low Margin
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '500' }}>${record.revenue.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>${record.costs.labour}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>${record.costs.vehicle}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>${record.costs.inventory}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>${record.costs.damage}</td>
                    <td style={{ textAlign: 'right', fontWeight: '500', color: 'var(--danger)' }}>${record.costs.total}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--success)' }}>${record.profit.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: isLow ? 'var(--danger)' : 'var(--success)' }}>
                      {record.margin}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
