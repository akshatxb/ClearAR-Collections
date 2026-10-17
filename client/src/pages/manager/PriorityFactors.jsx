import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  RotateCcw,
  Sparkles,
  Save,
  RotateCw,
  ExternalLink,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Sliders,
  Scale,
  Zap,
  Shield,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import AgingBadge from '../../components/AgingBadge';
import './PriorityFactors.css';

const money = (v) =>
  Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const FACTOR_DESCRIPTIONS = {
  overdue_days: 'Prioritizes accounts based on dollar-weighted days past due across open invoices.',
  invoice_value: 'Scales urgency with outstanding balance ($/10k) to accelerate high-dollar cash recovery.',
  broken_ptp_count: 'Heavily penalizes broken promises-to-pay to address defaulted commitments immediately.',
  dispute_count: 'Surfaces accounts with disputed invoices requiring collector investigation.',
  active_ptp_grace: 'Suppresses urgency for accounts with active, non-expired commitments to prevent harassment.',
  ptp_kept_ratio: 'Rewards reliable payers with high historical commitment fulfillment rates.',
  recent_payment_value: 'Provides credit for payments completed in the last 14 days ($/5k).',
};

const FACTOR_COLORS = {
  overdue_days: '#f97316',
  invoice_value: '#0f766e',
  broken_ptp_count: '#e11d48',
  dispute_count: '#8b5cf6',
  active_ptp_grace: '#10b981',
  ptp_kept_ratio: '#059669',
  recent_payment_value: '#0284c7',
};

const PRESETS = [
  {
    id: 'balanced',
    name: 'Balanced Model',
    icon: Scale,
    description: 'Calibrated weighting across risk, commitment history, active grace, and cash recovery.',
    weights: {
      overdue_days: 1.5,
      invoice_value: 1.5,
      broken_ptp_count: 2.0,
      dispute_count: 1.0,
      active_ptp_grace: 2.5,
      ptp_kept_ratio: 1.5,
      recent_payment_value: 1.0,
    },
  },
  {
    id: 'aggressive_cash',
    name: 'Aggressive Cash Recovery',
    icon: Zap,
    description: 'Prioritizes high balances and aging while maintaining active promise grace.',
    weights: {
      overdue_days: 2.5,
      invoice_value: 3.5,
      broken_ptp_count: 1.5,
      dispute_count: 0.5,
      active_ptp_grace: 2.0,
      ptp_kept_ratio: 1.0,
      recent_payment_value: 0.5,
    },
  },
  {
    id: 'risk_mitigation',
    name: 'Risk & Broken Commitments',
    icon: Shield,
    description: 'Emphasizes broken promises, disputes, and rewards proven fulfillment reliability.',
    weights: {
      overdue_days: 1.0,
      invoice_value: 1.0,
      broken_ptp_count: 3.5,
      dispute_count: 2.0,
      active_ptp_grace: 3.0,
      ptp_kept_ratio: 2.5,
      recent_payment_value: 1.5,
    },
  },
];

export default function PriorityFactors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [factors, setFactors] = useState([]);
  const [originalFactors, setOriginalFactors] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [worklist, setWorklist] = useState([]);
  const [initialWorklist, setInitialWorklist] = useState([]);
  const [loadingWorklist, setLoadingWorklist] = useState(true);

  // Preview display limit: 10, 25, or 0 (all)
  const [previewLimit, setPreviewLimit] = useState(10);

  // AI Suggestions state
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [appliedFactors, setAppliedFactors] = useState({});

  const orgId = user?.orgId;

  const loadFactors = useCallback(async () => {
    if (!orgId) return;
    const { data } = await api.getPriorityFactors(orgId);
    setFactors(data || []);
    setOriginalFactors(data || []);
  }, [orgId]);

  const loadWorklist = useCallback(async () => {
    setLoadingWorklist(true);
    try {
      const { data } = await api.getWorklist();
      const list = data || [];
      setWorklist(list);
      setInitialWorklist(list);
    } finally {
      setLoadingWorklist(false);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    if (!orgId) return;
    setLoadingSuggestions(true);
    try {
      const { data } = await api.getWeightSuggestions(orgId);
      setSuggestions(data || []);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load AI weight suggestions.'));
    } finally {
      setLoadingSuggestions(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    loadFactors().catch((err) => toast.error(apiErrorMessage(err, 'Could not load priority factors.')));
    loadWorklist();
    loadSuggestions();
  }, [loadFactors, loadWorklist, loadSuggestions, toast]);

  function updateWeight(id, weight) {
    const val = Math.max(0, Math.min(5, Math.round(weight * 10) / 10));
    setFactors((fs) => fs.map((f) => (f.id === id ? { ...f, weight: val } : f)));
    setDirty(true);
  }

  function handleApplyPreset(preset) {
    setFactors((prev) =>
      prev.map((f) => {
        const target = preset.weights[f.factorKey];
        return target !== undefined ? { ...f, weight: target } : f;
      })
    );
    setDirty(true);
    setAppliedFactors({});
    toast.success(`Applied "${preset.name}" strategy preset.`);
  }

  function handleApplySuggestion(s) {
    const val = Math.max(0, Math.min(5, Math.round(Number(s.suggestedWeight) * 10) / 10));
    updateWeight(s.factorId, val);
    setAppliedFactors((prev) => ({ ...prev, [s.factorId]: true }));
    toast.success(`Applied: "${s.label}" → ${val.toFixed(1)}`);
  }

  function handleApplyAllSuggestions() {
    if (!suggestions || suggestions.length === 0) return;
    const updates = {};
    suggestions.forEach((s) => {
      updates[s.factorId] = Math.max(0, Math.min(5, Math.round(Number(s.suggestedWeight) * 10) / 10));
    });
    setFactors((prev) =>
      prev.map((f) => (updates[f.id] !== undefined ? { ...f, weight: updates[f.id] } : f))
    );
    const newApplied = {};
    suggestions.forEach((s) => {
      newApplied[s.factorId] = true;
    });
    setAppliedFactors(newApplied);
    setDirty(true);
    toast.success(`Applied all ${suggestions.length} AI suggestions.`);
  }

  function handleReset() {
    setFactors(originalFactors);
    setDirty(false);
    setAppliedFactors({});
    toast.info('Discarded unsaved weight changes.');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = factors.map((f) => ({ id: f.id, weight: f.weight }));
      const { data } = await api.updatePriorityFactors(user.orgId, payload);
      setFactors(data || []);
      setOriginalFactors(data || []);
      setDirty(false);
      setAppliedFactors({});
      toast.success('Scoring weights saved. Worklist reordered.');
      loadWorklist();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save weights.'));
    } finally {
      setSaving(false);
    }
  }

  // Saved baseline rank mapping (Account ID -> baseline rank #)
  const baselineRankMap = useMemo(() => {
    const map = new Map();
    initialWorklist.forEach((acc, idx) => {
      map.set(acc.id, idx + 1);
    });
    return map;
  }, [initialWorklist]);

  // Real-time recomputed worklist preview when sliders are tuned locally
  const recomputedWorklist = useMemo(() => {
    if (!dirty || factors.length === 0) {
      return worklist;
    }

    const weightMap = {};
    const dirMap = {};
    factors.forEach((f) => {
      weightMap[f.factorKey] = Number(f.weight) || 0;
      dirMap[f.factorKey] = f.direction !== undefined && f.direction < 0 ? -1 : (
        (f.factorKey === 'active_ptp_grace' || f.factorKey === 'ptp_kept_ratio' || f.factorKey === 'recent_payment_value') ? -1 : 1
      );
    });

    const agingDays = { '90+': 95, '61-90': 75, '31-60': 45, '0-30': 15, current: 0 };

    return [...worklist]
      .map((acc) => {
        const dpd = acc.weightedDpd !== undefined ? Number(acc.weightedDpd) : (agingDays[acc.agingBucket] ?? 0);
        const openBal = Number(acc.openBalance || 0);
        const brokenPtps = acc.brokenPtpCount !== undefined ? Number(acc.brokenPtpCount) : (acc.hasBrokenPtp ? 1 : 0);
        const disputes = acc.openDisputeCount !== undefined ? Number(acc.openDisputeCount) : (acc.disputeCount !== undefined ? Number(acc.disputeCount) : (acc.hasDispute ? 1 : 0));
        const activePtps = acc.activePtpCount !== undefined ? Number(acc.activePtpCount) : (acc.hasPendingPtp ? 1 : 0);
        const keptRatio = acc.ptpKeptRatio !== undefined ? Number(acc.ptpKeptRatio) : 0;
        const recentPayK = acc.recentPaymentsK !== undefined ? Number(acc.recentPaymentsK) : 0;

        // Exact normalization matching ScoringService.java (log-dampened to prevent outlier explosion)
        const normOverdue = Math.min(8.0, dpd / 30.0);
        const normInvoice = openBal <= 0 ? 0 : Math.min(10.0, Math.log10(1.0 + openBal / 1000.0));
        const normBroken = Math.min(10.0, brokenPtps * 2.0);
        const normDispute = Math.min(10.0, disputes * 1.5);
        const normGrace = Math.min(10.0, activePtps * 4.0);
        const normKeptRatio = keptRatio * 5.0;
        const normRecentPay = recentPayK <= 0 ? 0 : Math.min(8.0, Math.log10(1.0 + (recentPayK * 1000.0) / 1000.0));

        const total =
          (dirMap.overdue_days ?? 1) * (weightMap.overdue_days ?? 1.5) * normOverdue +
          (dirMap.invoice_value ?? 1) * (weightMap.invoice_value ?? 1.5) * normInvoice +
          (dirMap.broken_ptp_count ?? 1) * (weightMap.broken_ptp_count ?? 2.0) * normBroken +
          (dirMap.dispute_count ?? 1) * (weightMap.dispute_count ?? 1.0) * normDispute +
          (dirMap.active_ptp_grace ?? -1) * (weightMap.active_ptp_grace ?? 2.5) * normGrace +
          (dirMap.ptp_kept_ratio ?? -1) * (weightMap.ptp_kept_ratio ?? 1.5) * normKeptRatio +
          (dirMap.recent_payment_value ?? -1) * (weightMap.recent_payment_value ?? 1.0) * normRecentPay;

        const simulatedScore = Math.max(0, Math.min(100, Math.round(total * 10) / 10));

        return {
          ...acc,
          simulatedScore,
        };
      })
      .sort((a, b) => (b.simulatedScore || 0) - (a.simulatedScore || 0));
  }, [worklist, factors, dirty]);

  const displayedPreview = useMemo(() => {
    if (previewLimit === 0) return recomputedWorklist;
    return recomputedWorklist.slice(0, previewLimit);
  }, [recomputedWorklist, previewLimit]);

  // Relative weight sum and percentage share
  const totalWeight = useMemo(() => {
    return factors.reduce((sum, f) => sum + (Number(f.weight) || 0), 0);
  }, [factors]);

  return (
    <div className="priority-factors-container">
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'center' }}>
        <h1 className="page-title">Priority factors</h1>
        <div className="header-actions-row">
          {dirty && (
            <button
              type="button"
              className="btn"
              onClick={handleReset}
              disabled={saving}
              title="Revert to last saved weights"
            >
              <RotateCcw size={13} strokeWidth={2} />
              <span>Discard changes</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? (
              <RotateCw size={13} className="spin-anim" />
            ) : (
              <Save size={13} strokeWidth={2} />
            )}
            <span>{saving ? 'Saving weights…' : dirty ? 'Save scoring weights' : 'Weights up-to-date'}</span>
          </button>
        </div>
      </div>

      {/* 1-Click Strategy Presets Bar */}
      <div className="strategy-presets-bar">
        <div className="presets-label">
          <Sliders size={14} strokeWidth={2} />
          <span>Quick Strategy Presets:</span>
        </div>
        <div className="presets-list">
          {PRESETS.map((preset) => {
            const PresetIcon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                className="preset-btn"
                onClick={() => handleApplyPreset(preset)}
                title={preset.description}
              >
                <span className="preset-icon">
                  <PresetIcon size={13} strokeWidth={2.2} />
                </span>
                <span className="preset-name">{preset.name}</span>
              </button>
            );
          })}
          {suggestions && suggestions.length > 0 && (
            <button
              type="button"
              className="preset-btn preset-btn-ai"
              onClick={handleApplyAllSuggestions}
              title="Apply all recommended weights derived from historical recovery correlations"
            >
              <Sparkles size={13} strokeWidth={2.2} />
              <span>AI Recommended ({suggestions.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Two-Column Grid: Sliders vs AI Suggestions */}
      <div className="scoring-strategy-grid">
        {/* Column 1: Manual Tuning Sliders */}
        <div className="panel" style={{ margin: 0 }}>
          <div className="panel-title-row" style={{ marginBottom: 12 }}>
            <span className="panel-title">Active Factor Weights</span>
            {dirty && <span className="status-pill tone-warning">Unsaved changes</span>}
          </div>

          {/* Relative Weight Allocation Progress Bar */}
          {totalWeight > 0 && (
            <div className="allocation-bar-wrap">
              <div className="allocation-bar-header">
                <span className="allocation-label">Relative Model Allocation</span>
                <span className="allocation-total num">{totalWeight.toFixed(1)} total weight</span>
              </div>
              <div className="allocation-bar">
                {factors.map((f) => {
                  const pct = ((Number(f.weight) / totalWeight) * 100).toFixed(0);
                  if (Number(pct) <= 0) return null;
                  return (
                    <div
                      key={f.id}
                      className="allocation-segment"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: FACTOR_COLORS[f.factorKey] || 'var(--accent)',
                      }}
                      title={`${f.label}: ${pct}% (${Number(f.weight).toFixed(1)})`}
                    />
                  );
                })}
              </div>
              <div className="allocation-legend">
                {factors.map((f) => {
                  const pct = ((Number(f.weight) / totalWeight) * 100).toFixed(0);
                  const displayName = f.label.replace(/\s*\([^)]*\)/g, '');
                  return (
                    <div key={f.id} className="legend-item" title={`${f.label}: ${pct}%`}>
                      <span
                        className="legend-dot"
                        style={{ backgroundColor: FACTOR_COLORS[f.factorKey] || 'var(--accent)' }}
                      />
                      <span className="legend-name">{displayName}:</span>
                      <span className="legend-pct num">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="factor-list" style={{ marginTop: '14px' }}>
            {factors.map((f) => {
              const isRelief = f.direction !== undefined ? f.direction < 0 : (
                f.factorKey === 'active_ptp_grace' || f.factorKey === 'ptp_kept_ratio' || f.factorKey === 'recent_payment_value'
              );
              return (
                <div className="factor-row" key={f.id}>
                  <div className="factor-row-head">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="factor-label">{f.label}</span>
                        {isRelief ? (
                          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontSize: '11px', fontWeight: 600 }}>
                            Trust Relief (−)
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(255, 176, 121, 0.2)', color: '#d96f20', fontSize: '11px', fontWeight: 600 }}>
                            Risk Penalty (+)
                          </span>
                        )}
                      </div>
                      <span className="factor-desc">
                        {FACTOR_DESCRIPTIONS[f.factorKey] || 'Algorithmic ranking factor component.'}
                      </span>
                    </div>
                    <span className="factor-key num">{f.factorKey}</span>
                  </div>
                  <div className="factor-slider-row">
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={Number(f.weight) || 0}
                      onChange={(e) => updateWeight(f.id, parseFloat(e.target.value))}
                      aria-label={`Weight for ${f.label}`}
                    />
                    <div className="factor-weight-input-wrap">
                      <input
                        type="number"
                        className="factor-weight-input num"
                        min="0"
                        max="5"
                        step="0.1"
                        value={Number(f.weight).toFixed(1)}
                        onChange={(e) => updateWeight(f.id, parseFloat(e.target.value) || 0)}
                        aria-label={`Numeric weight for ${f.label}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {factors.length === 0 && <p className="empty-state">No factors configured yet.</p>}
          </div>
        </div>

        {/* Column 2: AI Suggestions Panel */}
        <div className="panel" style={{ margin: 0 }}>
          <div className="panel-title-row" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="panel-title">AI Weight Suggestions</span>
              <span className="badge badge-accent">Machine Learned</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {suggestions && suggestions.length > 0 && (
                <button
                  type="button"
                  className="tbl-btn tbl-btn-primary"
                  onClick={handleApplyAllSuggestions}
                  title="Apply all suggestions at once"
                >
                  <Sparkles size={12} strokeWidth={2.2} />
                  <span>Apply all ({suggestions.length})</span>
                </button>
              )}
              <button
                type="button"
                className="tbl-btn tbl-btn-secondary"
                onClick={loadSuggestions}
                disabled={loadingSuggestions}
                title="Re-run machine learning correlation analysis"
              >
                <RotateCw size={12} strokeWidth={2} className={loadingSuggestions ? 'spin-anim' : ''} />
                <span>{loadingSuggestions ? 'Analyzing…' : 'Re-run'}</span>
              </button>
            </div>
          </div>

          {loadingSuggestions && suggestions === null ? (
            <p className="empty-state">Analyzing historical collection correlations…</p>
          ) : !suggestions || suggestions.length === 0 ? (
            <div className="suggestions-empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
              <span>Current weights align optimally with recent collection outcomes. No adjustments recommended.</span>
            </div>
          ) : (
            <div className="suggestions-list">
              {suggestions.map((s) => {
                const isApplied = appliedFactors[s.factorId];
                const delta = Number(s.suggestedWeight) - Number(s.currentWeight);
                const deltaLabel = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);

                return (
                  <div className="suggestion-card" key={s.factorId}>
                    <div className="suggestion-card-header">
                      <div className="suggestion-factor-head">
                        <span className="suggestion-factor-name">{s.label}</span>
                        <div className="suggestion-weight-flow">
                          <span className="weight-current num">{Number(s.currentWeight).toFixed(1)}</span>
                          <span className="flow-arrow">→</span>
                          <span className="weight-suggested num">{Number(s.suggestedWeight).toFixed(1)}</span>
                          <span className={`delta-pill ${delta >= 0 ? 'delta-up' : 'delta-down'}`}>
                            {deltaLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`tbl-btn ${isApplied ? 'tbl-btn-success' : 'tbl-btn-primary'}`}
                        onClick={() => handleApplySuggestion(s)}
                      >
                        {isApplied ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                            <span>Applied</span>
                          </span>
                        ) : (
                          'Apply to slider'
                        )}
                      </button>
                    </div>

                    <p className="suggestion-rationale">{s.rationale}</p>

                    <div className="suggestion-footer">
                      <span className="suggestion-confidence-tag">
                        High confidence correlation
                      </span>
                      <span className="suggestion-sample-count">
                        Based on {s.sampleCount || 'historical'} outcome events
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Live Worklist Preview with Live Rank Movement */}
      <div className="panel" style={{ marginTop: '16px' }}>
        <div className="panel-title-row" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="panel-title">Live Queue Preview</span>
            {dirty ? (
              <span className="badge badge-accent">Live Simulated Order</span>
            ) : (
              <span className="badge badge-neutral">Saved Order</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="preview-limit-tabs">
              <button
                type="button"
                className={`preview-tab-btn ${previewLimit === 10 ? 'active' : ''}`}
                onClick={() => setPreviewLimit(10)}
              >
                Top 10
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${previewLimit === 25 ? 'active' : ''}`}
                onClick={() => setPreviewLimit(25)}
              >
                Top 25
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${previewLimit === 0 ? 'active' : ''}`}
                onClick={() => setPreviewLimit(0)}
              >
                All ({recomputedWorklist.length})
              </button>
            </div>

            <Link to="/worklist" className="btn-quiet" style={{ fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Open Worklist</span>
              <ExternalLink size={12} strokeWidth={2} />
            </Link>
          </div>
        </div>

        {loadingWorklist ? (
          <p className="empty-state">Loading worklist preview…</p>
        ) : displayedPreview.length === 0 ? (
          <p className="empty-state">No accounts found.</p>
        ) : (
          <table className="mini-table" style={{ marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Movement</th>
                <th>Account name</th>
                <th>Aging stage</th>
                <th className="align-right">Open balance</th>
                <th className="align-right">Calculated priority score</th>
                <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedPreview.map((row, idx) => {
                const currentRank = idx + 1;
                const baselineRank = baselineRankMap.get(row.id) || currentRank;
                const rankDelta = baselineRank - currentRank;

                return (
                  <tr key={row.id} className="preview-table-row" onClick={() => navigate(`/accounts/${row.id}`)}>
                    <td className="num align-center" style={{ fontWeight: 700, color: idx < 3 ? 'var(--accent)' : 'var(--ink)' }}>
                      #{currentRank}
                    </td>
                    <td className="align-center">
                      {rankDelta > 0 ? (
                        <span className="rank-movement rank-movement-up" title={`Moved up ${rankDelta} position${rankDelta === 1 ? '' : 's'}`}>
                          <TrendingUp size={11} strokeWidth={2.5} />
                          <span>+{rankDelta}</span>
                        </span>
                      ) : rankDelta < 0 ? (
                        <span className="rank-movement rank-movement-down" title={`Moved down ${Math.abs(rankDelta)} position${Math.abs(rankDelta) === 1 ? '' : 's'}`}>
                          <TrendingDown size={11} strokeWidth={2.5} />
                          <span>{rankDelta}</span>
                        </span>
                      ) : (
                        <span className="rank-movement rank-movement-same" title="Position unchanged">
                          <Minus size={11} strokeWidth={2.5} />
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="preview-account-name">{row.name}</span>
                      {row.hasBrokenPtp && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: '10px' }}>Broken PTP</span>}
                      {row.creditHold && <span className="hold-flag" style={{ marginLeft: 6, fontSize: '10px' }}>Hold</span>}
                    </td>
                    <td>
                      <AgingBadge bucket={row.agingBucket} />
                    </td>
                    <td className="align-right num">{money(row.openBalance)}</td>
                    <td className="align-right num" style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      {dirty && row.simulatedScore !== undefined
                        ? Number(row.simulatedScore).toFixed(1)
                        : Number(row.priorityScore).toFixed(1)}
                    </td>
                    <td className="align-right" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/accounts/${row.id}`} className="tbl-btn tbl-btn-secondary" style={{ height: 26, padding: '0 7px' }} title="View account">
                        <span>View</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
