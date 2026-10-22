import { useMemo, useState, useEffect } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, Award, BadgeCheck, BarChart3, Bell, Blocks, Check,
  ChevronDown, CircleHelp, ClipboardCheck, Cloud, Copy, Download, ExternalLink, FileCheck2,
  FileSearch, FileText, Fingerprint, FlaskConical, Globe2, HelpCircle, Info, Leaf, Menu,
  Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Sparkles, Terminal, Trash2, Upload,
  UploadCloud, Wallet, X, Zap
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Claim, ClaimStatus, TelemetryPoint, AiAuditReport, OnChainTransaction } from './types';
import { SAMPLE_DATASETS } from './data/sampleDatasets';
import { parseTelemetryCsv, runAiAudit, EMISSION_FACTORS } from './ai/dmrvEngine';
import { Web3Service, WalletState } from './services/web3Service';

const initialClaims: Claim[] = [
  {
    id: 'CT-2026-0042',
    name: 'Rajasthan 250kW Solar Microgrid',
    type: 'Renewable energy',
    location: 'Bikaner, Rajasthan, India',
    claimed: 128.4,
    estimated: 121.7,
    confidenceScore: 94.7,
    status: 'Verified',
    date: 'Oct 22, 2026',
    hash: '0x8f3a8b27c19f04e76a91d52e391b4c8a9f0e1d2c3b4a59687e1f2a3b4c5d91c',
    txHash: '0x9a3e4f1b8c2d7e6a5f0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f',
    blockNumber: 412845,
    submitter: '0x8fB431D95e2Ca041078B449A322d8D74C37Ad72E',
    note: 'SMA Inverter telemetry matched clear-sky irradiance profile. 5.2% transmission variance within permissible IEEE grid threshold.',
    evidence: 'bikaner_inverter_q3_metering.csv'
  },
  {
    id: 'CT-2026-0041',
    name: 'Pune Municipal Electric Bus Fleet',
    type: 'Transport',
    location: 'Pune, Maharashtra, India',
    claimed: 82.0,
    estimated: 74.6,
    confidenceScore: 88.5,
    status: 'AI Audited',
    date: 'Oct 21, 2026',
    hash: '0xa2d1947b19ce8234850fa9b10283e74b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9b77',
    txHash: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    blockNumber: 412847,
    submitter: '0x8fB431D95e2Ca041078B449A322d8D74C37Ad72E',
    note: 'AMS-III.C methodology validated. 18 electric buses replacing Bharat Stage IV diesel transit lines.',
    evidence: 'pune_ev_bus_telemetry_oct.csv'
  },
  {
    id: 'CT-2026-0040',
    name: 'Nashik Agro-Waste Biogas Co-op',
    type: 'Waste management',
    location: 'Nashik, Maharashtra, India',
    claimed: 46.2,
    estimated: 44.9,
    confidenceScore: 96.1,
    status: 'Verified',
    date: 'Oct 20, 2026',
    hash: '0x44c93a8d10b7e6f5a4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e30ea2',
    txHash: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
    blockNumber: 412841,
    submitter: '0x32A45C8f6B09187e1a3D4B678c9E1F0A2B3C4D5E',
    note: 'Ultrasonic flow meter data and methane gas chromatography consistent with IPCC AR6 GWP=28 factors.',
    evidence: 'nashik_biogas_ch4_sensor.csv'
  },
  {
    id: 'CT-2026-0039',
    name: 'Solar Microgrid — Double Spend Attempt',
    type: 'Renewable energy',
    location: 'Rajasthan, India',
    claimed: 128.4,
    estimated: 121.7,
    confidenceScore: 0.0,
    status: 'Duplicate blocked',
    date: 'Oct 20, 2026',
    hash: '0x8f3a8b27c19f04e76a91d52e391b4c8a9f0e1d2c3b4a59687e1f2a3b4c5d91c',
    submitter: '0x99994c8e7A123f0aB3C4D5E6F7A8B9C0D1E2F3A4',
    note: 'Double-counting attack detected. Evidence hash already exists on-chain; smart contract reverted transaction with DuplicateEvidence().',
    evidence: 'meter_readings_q3_resubmission.csv'
  }
];

const trendData = [
  { month: 'May', tonnes: 220, verified: 195 },
  { month: 'Jun', tonnes: 286, verified: 260 },
  { month: 'Jul', tonnes: 310, verified: 295 },
  { month: 'Aug', tonnes: 348, verified: 335 },
  { month: 'Sep', tonnes: 392, verified: 380 },
  { month: 'Oct', tonnes: 431, verified: 420 },
];

const navItems = [
  { label: 'Overview', icon: BarChart3, badge: '' },
  { label: 'AI dMRV Studio', icon: FileSearch, badge: 'AI' },
  { label: 'Proof registry', icon: Blocks, badge: 'On-Chain' },
  { label: 'Marketplace & Retirement', icon: Award, badge: 'Tokens' },
  { label: 'Climate Copilot', icon: Sparkles, badge: 'IEEE' }
];

export default function App() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTab = params?.get('tab') || 'Overview';
  const initialSample = params?.get('sample') || 'solarClean';
  const initialSampleData = SAMPLE_DATASETS[initialSample] || SAMPLE_DATASETS.solarClean;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(params?.get('drawer') ? initialClaims[0] : null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNotice, setShowNotice] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  // Web3 & Blockchain State
  const web3 = useMemo(() => Web3Service.getInstance(), []);
  const [wallet, setWallet] = useState<WalletState>(web3.getWallet());
  const [txHistory, setTxHistory] = useState<OnChainTransaction[]>(web3.getTransactions());
  const [blockHeight, setBlockHeight] = useState<number>(web3.getBlockHeight());

  // dMRV Studio State
  const [selectedDatasetKey, setSelectedDatasetKey] = useState<string>(initialSample);
  const [studioType, setStudioType] = useState<'Renewable energy' | 'Transport' | 'Waste management'>(initialSampleData.type);
  const [studioClaimed, setStudioClaimed] = useState<number>(initialSampleData.claimedTonnes);
  const [studioProjectName, setStudioProjectName] = useState<string>(initialSampleData.name);
  const [studioLocation, setStudioLocation] = useState<string>(initialSampleData.location);
  const [studioCsv, setStudioCsv] = useState<string>(initialSampleData.csvContent);
  const [telemetryPoints, setTelemetryPoints] = useState<TelemetryPoint[]>([]);
  const [auditReport, setAuditReport] = useState<AiAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isRegisteringOnChain, setIsRegisteringOnChain] = useState<boolean>(false);

  // Retirement modal
  const [retireClaimTarget, setRetireClaimTarget] = useState<Claim | null>(null);
  const [beneficiaryName, setBeneficiaryName] = useState<string>('IEEE Climate Action Initiative');
  const [retirementReason, setRetirementReason] = useState<string>('COP31 Scope 2 Neutralization');
  const [activeRetirementCert, setActiveRetirementCert] = useState<Claim | null>(
    params?.get('cert') === 'true'
      ? {
          ...initialClaims[0],
          status: 'Retired',
          retirement: {
            beneficiary: 'IEEE Climate Action Initiative',
            reason: 'COP31 Scope 2 Neutralization Q3',
            timestamp: '2026-10-22 14:30:00 UTC',
            certificateHash: '0x7f8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
            retiredBy: '0x8fB4...d72E'
          }
        }
      : null
  );

  // Copilot State
  const [copilotQuestion, setCopilotQuestion] = useState<string>('How does the smart contract prevent double-counting under Paris Agreement Article 6?');
  const [copilotHistory, setCopilotHistory] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    {
      sender: 'bot',
      text: 'Welcome to the VeriClimate IEEE Copilot! I can analyze carbon methodologies (ACM0002, AMS-III.C, ACM0010), explain AI sensor anomaly models, and verify cryptographic evidence integrity. Ask me anything!'
    }
  ]);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  // Run AI analysis on dataset change
  useEffect(() => {
    const points = parseTelemetryCsv(studioCsv, studioType);
    setTelemetryPoints(points);
    const report = runAiAudit(studioClaimed, studioType, points);
    setAuditReport(report);
  }, [studioCsv, studioType, studioClaimed]);

  const handleSelectSample = (key: string) => {
    setSelectedDatasetKey(key);
    const sample = SAMPLE_DATASETS[key];
    if (sample) {
      setStudioProjectName(sample.name);
      setStudioType(sample.type);
      setStudioLocation(sample.location);
      setStudioClaimed(sample.claimedTonnes);
      setStudioCsv(sample.csvContent);
      notify(`Loaded dataset: ${sample.name}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setStudioCsv(text);
        setStudioProjectName(file.name.replace(/\.[^/.]+$/, ''));
        notify(`Custom telemetry file "${file.name}" uploaded and parsed!`);
      }
    };
    reader.readAsText(file);
  };

  const handleConnectWallet = async () => {
    try {
      const w = await web3.connectMetaMask();
      setWallet(w);
      notify(`Wallet connected: ${w.address.slice(0, 6)}...${w.address.slice(-4)}`);
    } catch {
      notify('Using local in-browser EVM node.');
    }
  };

  // Anchor & Register Claim on Blockchain
  const handleRegisterOnChain = async () => {
    if (!auditReport) return;
    setIsRegisteringOnChain(true);

    try {
      const evidenceHash = await web3.computeEvidenceHash(studioCsv);
      const claimId = `CT-2026-${String(43 + claims.length - initialClaims.length).padStart(4, '0')}`;

      // Call on-chain registry
      const regTx = await web3.registerClaimOnChain(
        claimId,
        evidenceHash,
        Math.round(studioClaimed * 1000),
        studioType,
        studioLocation
      );

      // Record AI Audit on-chain
      await web3.recordAiAuditOnChain(
        claimId,
        Math.round(auditReport.overallConfidence * 100),
        Math.round(auditReport.aiEstimatedTonnes * 1000)
      );

      const newClaim: Claim = {
        id: claimId,
        name: studioProjectName,
        type: studioType,
        location: studioLocation,
        claimed: studioClaimed,
        estimated: auditReport.aiEstimatedTonnes,
        confidenceScore: auditReport.overallConfidence,
        status: auditReport.verdict === 'PASS' ? 'Verified' : auditReport.verdict === 'REVIEW_FLAGGED' ? 'AI Audited' : 'Duplicate blocked',
        date: 'Oct 22, 2026',
        hash: evidenceHash,
        txHash: regTx.txHash,
        blockNumber: regTx.blockNumber,
        submitter: wallet.address,
        note: auditReport.verdictSummary,
        evidence: `${studioProjectName.toLowerCase().replace(/\s+/g, '_')}_telemetry.csv`,
        telemetryData: telemetryPoints,
        auditReport
      };

      setClaims(prev => [newClaim, ...prev]);
      setSelectedClaim(newClaim);
      setTxHistory(web3.getTransactions());
      setBlockHeight(web3.getBlockHeight());
      notify(`Claim registered on-chain in Block #${regTx.blockNumber}! Evidence hash anchored.`);
      setActiveTab('Proof registry');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(msg);
    } finally {
      setIsRegisteringOnChain(false);
    }
  };

  // Permanent Offset Retirement
  const handleExecuteRetirement = async () => {
    if (!retireClaimTarget) return;

    try {
      const res = await web3.retireClaimOnChain(
        retireClaimTarget.id,
        beneficiaryName,
        retirementReason,
        retireClaimTarget.estimated
      );

      const updated = claims.map(c => {
        if (c.id === retireClaimTarget.id) {
          return {
            ...c,
            status: 'Retired' as ClaimStatus,
            retirement: {
              beneficiary: beneficiaryName,
              reason: retirementReason,
              timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
              certificateHash: res.certificateHash,
              retiredBy: wallet.address
            }
          };
        }
        return c;
      });

      setClaims(updated);
      setTxHistory(web3.getTransactions());
      setBlockHeight(web3.getBlockHeight());

      const retiredItem = updated.find(c => c.id === retireClaimTarget.id) || null;
      setActiveRetirementCert(retiredItem);
      setRetireClaimTarget(null);
      notify(`Offsets permanently burned & retired on-chain! Certificate minted.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`Retirement failed: ${msg}`);
    }
  };

  // Simulate Double Spend Attack
  const handleSimulateDoubleSpend = async () => {
    const existingClaim = claims[0];
    try {
      await web3.registerClaimOnChain(
        'CT-ATTACK-0099',
        existingClaim.hash,
        50000,
        existingClaim.type,
        existingClaim.location
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`Smart Contract Blocked Attack: ${msg}`);
      setTxHistory(web3.getTransactions());
    }
  };

  // Copilot Q&A
  const handleAskCopilot = (questionText?: string) => {
    const q = questionText || copilotQuestion;
    if (!q.trim()) return;

    const newHistory = [...copilotHistory, { sender: 'user' as const, text: q }];
    setCopilotHistory(newHistory);
    setCopilotQuestion('');

    let answer = '';
    const qLower = q.toLowerCase();

    if (qLower.includes('double') || qLower.includes('paris') || qLower.includes('article 6')) {
      answer = 'Under Article 6.2 and 6.4 of the Paris Agreement, double counting (e.g. issuing credits to both the host country NDC and an international buyer) is prohibited. VeriClimate AI prevents double counting by anchoring the SHA-256 / Keccak-256 content hash of raw telemetry on-chain. If an actor attempts to resubmit identical meter data, the ClimateTraceRegistry.sol contract reverts with DuplicateEvidence(). Additionally, when an offset is claimed, the tokens are burned and assigned a unique single-use Retirement Certificate.';
    } else if (qLower.includes('acm0002') || qLower.includes('solar') || qLower.includes('renewable')) {
      answer = 'UNFCCC ACM0002 governs grid-connected electricity generation from renewable sources. VeriClimate calculates baseline emissions averted using the equation: BE = EG * EF_grid, where EG is verified net generation (kWh) and EF_grid is the official regional grid emission factor (e.g. 0.716 kg CO2e/kWh for CEA India). The AI layer filters out nighttime generation and sensor flatlines before multiplying by EF_grid.';
    } else if (qLower.includes('fleet') || qLower.includes('transport') || qLower.includes('ams-iii.c')) {
      answer = 'UNFCCC AMS-III.C covers electrification of transit fleets. Reductions are determined by: ER = Total_Km * (EF_diesel - EF_EV_grid), accounting for charging loss. VeriClimate checks vehicle-kilometer logs against battery state-of-charge (SoC) cycles to detect phantom distance reporting.';
    } else if (qLower.includes('anomaly') || qLower.includes('ai') || qLower.includes('model')) {
      answer = 'VeriClimate AI uses a dual statistical and physical model: 1) Physical Clear-Sky Irradiance Model to predict theoretical peak power given solar angle and location; 2) Moving Z-Score & Interquartile Range (IQR) detection for sensor variance. Telemetry with Z-score > 2.5 or impossible nighttime generation is flagged and penalized in the Trust Score.';
    } else {
      answer = `Based on IEEE ClimateChain and GHG Protocol standards, your project qualifies for digital Measurement, Reporting, and Verification (dMRV). Key prerequisites include meter-level interval logging, published emission factors, and verifiable on-chain anchoring. VeriClimate automated screening achieved a ${auditReport?.overallConfidence}% confidence score on current parameters.`;
    }

    setTimeout(() => {
      setCopilotHistory(prev => [...prev, { sender: 'bot', text: answer }]);
    }, 400);
  };

  const filtered = useMemo(() =>
    claims.filter(c => `${c.name} ${c.location} ${c.id} ${c.status}`.toLowerCase().includes(search.toLowerCase())),
    [claims, search]
  );

  const verifiedTonnes = claims.filter(c => c.status === 'Verified' || c.status === 'Retired').reduce((n, c) => n + c.estimated, 0);
  const retiredTonnes = claims.filter(c => c.status === 'Retired').reduce((n, c) => n + c.estimated, 0);
  const avgTrustScore = Math.round(claims.reduce((acc, c) => acc + c.confidenceScore, 0) / (claims.length || 1));

  function exportReport(c: Claim) {
    const report = {
      ...c,
      generatedAt: new Date().toISOString(),
      standard: 'IEEE ClimateChain dMRV & GHG Protocol Scope 1/2/3',
      disclaimer: 'Cryptographically anchored dMRV proof certificate on EVM smart contract.'
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${c.id}-vericlimate-audit-certificate.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Leaf size={22} /></div>
          <div>
            <b>VeriClimate AI</b>
            <span>IEEE CLIMATECHAIN</span>
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-icon"><Globe2 size={17} /></div>
          <div>
            <b>COP31 Carbon Ledger</b>
            <small>Decentralized dMRV</small>
          </div>
          <ChevronDown size={15} className="muted" />
        </div>

        <div className="nav-label">PLATFORM</div>
        <nav>
          {navItems.map(n => (
            <button
              key={n.label}
              className={`nav-item ${activeTab === n.label ? 'active' : ''}`}
              onClick={() => setActiveTab(n.label)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.badge && <i>{n.badge}</i>}
            </button>
          ))}
        </nav>

        <div className="nav-label registry-label">NETWORK & WALLET</div>
        <div style={{ padding: '0 8px', marginBottom: '14px' }}>
          <div className="wallet-indicator" onClick={handleConnectWallet} title="Click to connect or switch wallet">
            <span className="node-dot" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
              {wallet.isSimulated ? 'Local EVM: ' : 'Web3: '}
              {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
            </span>
          </div>
          <small style={{ display: 'block', fontSize: '9px', color: '#88968b', marginTop: '4px', paddingLeft: '4px' }}>
            Block #{blockHeight} · Gas: 21 Gwei
          </small>
        </div>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={18} /></div>
            <b>IEEE ClimateChain</b>
            <p>Empowering COP31 goals with AI-verified dMRV and anti-double-counting smart contracts.</p>
            <button onClick={() => setActiveTab('Climate Copilot')}>Open Copilot <ExternalLink size={13} /></button>
          </div>
          <div className="profile">
            <div className="avatar">VC</div>
            <div>
              <b>Lead Verifier</b>
              <small>IEEE Senior Member</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            <span>ClimateChain Workspace</span>
            <span className="slash">/</span>
            <b>{activeTab}</b>
          </div>
          <div className="top-actions">
            <div className="wallet-indicator" onClick={handleConnectWallet}>
              <span className="node-dot" />
              <span>{wallet.network}</span>
            </div>
            <button className="icon-btn" aria-label="Notifications" onClick={() => notify('Audit node active and synced.')}>
              <Bell size={18} /><i />
            </button>
            <div className="avatar small-avatar">IEEE</div>
          </div>
        </header>

        <div className="content">
          {/* Page Heading */}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <Sparkles size={14} /> AI-POWERED DECENTRALIZED MRV (dMRV)
              </div>
              <h1>
                {activeTab === 'Overview' && 'Decentralized Carbon Ledger'}
                {activeTab === 'AI dMRV Studio' && 'AI Sensor Telemetry & Anomaly Studio'}
                {activeTab === 'Proof registry' && 'On-Chain Proof & Double-Counting Registry'}
                {activeTab === 'Marketplace & Retirement' && 'Tokenized Offsets & Permanent Retirement'}
                {activeTab === 'Climate Copilot' && 'IEEE Climate & Methodology Copilot'}
              </h1>
              <p>
                {activeTab === 'Overview' && 'Real-time verified emissions reductions, cryptographic evidence fingerprints, and carbon credit pipeline.'}
                {activeTab === 'AI dMRV Studio' && 'Ingest high-frequency sensor feeds, model clear-sky baselines, and detect telemetry manipulation.'}
                {activeTab === 'Proof registry' && 'Inspect immutable EVM contract transactions, evidence hashes, and anti-greenwashing protections.'}
                {activeTab === 'Marketplace & Retirement' && 'Trade verified carbon offsets and execute permanent on-chain retirements for corporate ESG.'}
                {activeTab === 'Climate Copilot' && 'Interactive AI assistant for UNFCCC ACM0002, AMS-III.C, and Article 6 Paris Agreement standards.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="outline-btn" onClick={() => setActiveTab('AI dMRV Studio')}>
                <FileSearch size={16} /> Audit Telemetry
              </button>
              <button className="primary-btn" onClick={() => setShowNewModal(true)}>
                <Plus size={17} /> New Submission
              </button>
            </div>
          </div>

          {/* Quick Notice */}
          {showNotice && (
            <div className="notice">
              <div className="notice-icon"><FlaskConical size={18} /></div>
              <div>
                <b>IEEE ClimateChain Hackathon Live Production Demo</b>
                <p>
                  Equipped with real time-series anomaly detection, GHG Protocol formula evaluation,
                  and live Solidity EVM contract interaction to prevent double counting.
                </p>
              </div>
              <button onClick={() => setShowNotice(false)} aria-label="Dismiss notice"><X size={17} /></button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'Overview' && (
            <div className="tab-content">
              {/* Metric Grid */}
              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-top">
                    <span>Verified Reductions</span>
                    <span className="metric-icon mint"><Leaf size={17} /></span>
                  </div>
                  <div className="metric-value">{verifiedTonnes.toFixed(1)} <small>tCO₂e</small></div>
                  <div className="metric-foot">
                    <span className="trend"><ArrowUpRight size={14} /> +18.4%</span>
                    <span>anchored on-chain</span>
                  </div>
                  <div className="sparkline">
                    <span style={{ height: '35%' }} /><span style={{ height: '45%' }} /><span style={{ height: '39%' }} /><span style={{ height: '62%' }} /><span style={{ height: '56%' }} /><span style={{ height: '77%' }} /><span style={{ height: '68%' }} /><span style={{ height: '95%' }} />
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Active Claims</span>
                    <span className="metric-icon blue"><FileCheck2 size={17} /></span>
                  </div>
                  <div className="metric-value">{claims.length.toString().padStart(2, '0')} <small>claims</small></div>
                  <div className="metric-foot">
                    <span className="trend"><ArrowUpRight size={14} /> +4</span>
                    <span>in current reporting cycle</span>
                  </div>
                  <div className="mini-bars">
                    <span /><span /><span /><span /><span /><span /><span /><span /><span />
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Mean Trust Score</span>
                    <span className="metric-icon green-bg"><ShieldCheck size={17} /></span>
                  </div>
                  <div className="metric-value">{avgTrustScore}% <small>confidence</small></div>
                  <div className="progress-line">
                    <span style={{ width: `${avgTrustScore}%` }} />
                  </div>
                  <div className="progress-caption">
                    <span>AI Model Confidence</span>
                    <b>High Quality</b>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Offsets Permanently Retired</span>
                    <span className="metric-icon amber-bg"><Award size={17} /></span>
                  </div>
                  <div className="metric-value">{retiredTonnes.toFixed(1)} <small>tCO₂e</small></div>
                  <div className="metric-foot">
                    <span className="attention"><Activity size={13} /> Zero Double-Counting</span>
                  </div>
                  <div className="attention-line">
                    <span /><span /><span /><span /><span /><span /><span /><span />
                  </div>
                </div>
              </div>

              {/* Middle Charts */}
              <div className="middle-grid">
                <section className="panel impact-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Verified Carbon Reduction Trend</h2>
                      <p>Time-series emissions averted (tCO₂e) vs. baseline</p>
                    </div>
                    <button className="select-btn" onClick={() => notify('Filtering by 2026 reporting cycle.')}>
                      FY 2026 <ChevronDown size={14} />
                    </button>
                  </div>

                  <div className="chart-key">
                    <span />
                    <span>Verified tCO₂e Offset</span>
                  </div>

                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="fillGreen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2b8a62" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#2b8a62" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#edf1ed" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#89948c', fontSize: 11 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#89948c', fontSize: 11 }} />
                        <Tooltip contentStyle={{ border: '1px solid #e6ece7', borderRadius: 12, fontSize: 12 }} />
                        <Area type="monotone" dataKey="tonnes" stroke="#25865b" strokeWidth={2.5} fill="url(#fillGreen)" activeDot={{ r: 5, strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-footer">
                    <span>
                      <span className="dot-green" /> Aggregated telemetry audited via UNFCCC ACM0002 & AMS-III.C protocols.
                    </span>
                    <button onClick={() => setActiveTab('AI dMRV Studio')}>
                      Inspect Inverter Feeds <ArrowUpRight size={14} />
                    </button>
                  </div>
                </section>

                <section className="panel readiness-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Verification Pipeline</h2>
                      <p>Claim validation status</p>
                    </div>
                    <button className="more-btn" onClick={() => setActiveTab('Proof registry')}>•••</button>
                  </div>

                  <div className="donut-area">
                    <div className="donut">
                      <div>
                        <strong>{claims.length}</strong>
                        <small>Total Claims</small>
                      </div>
                    </div>
                    <div className="donut-legend">
                      <div>
                        <i className="legend-dot verified-dot" />
                        <span>Verified / Retired</span>
                        <b>{claims.filter(c => c.status === 'Verified' || c.status === 'Retired').length}</b>
                      </div>
                      <div>
                        <i className="legend-dot review-dot" />
                        <span>AI Audited</span>
                        <b>{claims.filter(c => c.status === 'AI Audited').length}</b>
                      </div>
                      <div>
                        <i className="legend-dot duplicate-dot" />
                        <span>Duplicates Blocked</span>
                        <b>{claims.filter(c => c.status === 'Duplicate blocked').length}</b>
                      </div>
                    </div>
                  </div>

                  <div className="readiness-note">
                    <ShieldCheck size={17} />
                    <p>
                      <b>Anti-Greenwashing Guarantee:</b><br />
                      Every claim is bound to an immutable Keccak-256 evidence fingerprint. Double-claim attempts are automatically rejected by smart contracts.
                    </p>
                  </div>
                </section>
              </div>

              {/* Claims Ledger Table */}
              <section className="panel claims-panel">
                <div className="panel-head claims-head">
                  <div>
                    <h2>Verified Claims & Proof Ledger</h2>
                    <p>Searchable carbon credits and telemetry evidence registry</p>
                  </div>
                  <div className="table-actions">
                    <div className="search-box">
                      <Search size={15} />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search project, hash..."
                      />
                    </div>
                    <button
                      className="outline-btn"
                      onClick={() => {
                        const csv = [
                          'id,name,type,location,claimed_tco2e,estimated_tco2e,confidence,status,evidence_hash,tx_hash',
                          ...claims.map(c => [
                            c.id,
                            `"${c.name}"`,
                            c.type,
                            `"${c.location}"`,
                            c.claimed,
                            c.estimated,
                            c.confidenceScore,
                            c.status,
                            c.hash,
                            c.txHash || ''
                          ].join(','))
                        ].join('\n');
                        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'vericlimate-carbon-ledger.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download size={15} /> Export Ledger CSV
                    </button>
                  </div>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>PROJECT / ASSET</th>
                        <th>CLAIMED REDUCTION</th>
                        <th>AUDITED REDUCTION</th>
                        <th>AI TRUST SCORE</th>
                        <th>STATUS</th>
                        <th>EVIDENCE HASH</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(c => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedClaim(c)}
                          className={selectedClaim?.id === c.id ? 'selected-row' : ''}
                        >
                          <td>
                            <div className="project-cell">
                              <div className={`project-icon ${c.type === 'Renewable energy' ? 'solar' : c.type === 'Transport' ? 'transport' : 'waste'}`}>
                                {c.type === 'Renewable energy' ? <Zap size={17} /> : c.type === 'Transport' ? <Cloud size={17} /> : <Leaf size={17} />}
                              </div>
                              <div>
                                <b>{c.name}</b>
                                <small>{c.id} <span>·</span> {c.location}</small>
                              </div>
                            </div>
                          </td>
                          <td><b>{c.claimed.toFixed(1)}</b> <small>tCO₂e</small></td>
                          <td><b>{c.estimated.toFixed(1)}</b> <small>tCO₂e</small></td>
                          <td>
                            <strong style={{ color: c.confidenceScore > 80 ? '#2c8352' : c.confidenceScore > 50 ? '#b47b2e' : '#b75c5c' }}>
                              {c.confidenceScore}%
                            </strong>
                          </td>
                          <td>
                            <span className={`status ${c.status === 'Verified' || c.status === 'Retired' ? 'green' : c.status === 'AI Audited' ? 'amber' : 'red'}`}>
                              {c.status === 'Verified' ? <BadgeCheck size={13} /> : c.status === 'Retired' ? <Award size={13} /> : c.status === 'AI Audited' ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
                              {c.status}
                            </span>
                          </td>
                          <td>
                            <code style={{ fontSize: '10px', background: '#f3f6f3', padding: '3px 6px', borderRadius: '4px' }}>
                              {c.hash.slice(0, 8)}...{c.hash.slice(-6)}
                            </code>
                          </td>
                          <td>
                            <button className="row-arrow" onClick={(e) => { e.stopPropagation(); setSelectedClaim(c); }}>
                              ↗
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && <div className="empty-state">No claims match your query.</div>}
                </div>

                <div className="table-footer">
                  <span>Showing <b>{filtered.length}</b> of <b>{claims.length}</b> anchored records</span>
                  <button onClick={() => setActiveTab('Proof registry')}>
                    View Blockchain Transactions <ArrowUpRight size={14} />
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: AI dMRV STUDIO */}
          {activeTab === 'AI dMRV Studio' && (
            <div className="tab-content">
              {/* Dataset Picker */}
              <div className="panel" style={{ padding: '20px' }}>
                <div className="panel-head">
                  <div>
                    <h2>Select Benchmark Telemetry or Upload Sensor Logs</h2>
                    <p>Test real-world renewable, EV fleet, and biogas datasets or simulate fraud detection</p>
                  </div>
                  <label className="primary-btn" style={{ cursor: 'pointer' }}>
                    <Upload size={15} /> Upload Inverter / Meter CSV
                    <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>

                <div className="dataset-picker">
                  <div
                    className={`dataset-chip ${selectedDatasetKey === 'solarClean' ? 'active' : ''}`}
                    onClick={() => handleSelectSample('solarClean')}
                  >
                    <Zap size={14} /> Clean Solar Microgrid (Pass)
                  </div>
                  <div
                    className={`dataset-chip ${selectedDatasetKey === 'fleetTransit' ? 'active' : ''}`}
                    onClick={() => handleSelectSample('fleetTransit')}
                  >
                    <Cloud size={14} /> Urban EV Bus Fleet (Pass)
                  </div>
                  <div
                    className={`dataset-chip ${selectedDatasetKey === 'biogasWaste' ? 'active' : ''}`}
                    onClick={() => handleSelectSample('biogasWaste')}
                  >
                    <Leaf size={14} /> Agro-Waste Biogas Digester (Pass)
                  </div>
                  <div
                    className={`dataset-chip fraud ${selectedDatasetKey === 'fraudulentSolar' ? 'active' : ''}`}
                    onClick={() => handleSelectSample('fraudulentSolar')}
                  >
                    <ShieldAlert size={14} /> Tampered / Fraudulent Meter Log (Anomaly Alert!)
                  </div>
                </div>

                <div className="studio-grid">
                  {/* Left: Time-series Chart */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#384d3e' }}>
                        24-Hour Telemetry vs. AI Physical Clear-Sky Baseline
                      </span>
                      <span style={{ fontSize: '10px', color: '#7a8c80' }}>
                        Methodology: {auditReport?.methodology.split('(')[0]}
                      </span>
                    </div>

                    <div style={{ height: '260px', background: '#fafcfa', borderRadius: '10px', padding: '10px', border: '1px solid #ebf1eb' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={telemetryPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="telemetryActual" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3ca266" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3ca266" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="telemetryExpected" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4a8ec9" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#4a8ec9" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e8ece8" />
                          <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: '#808f84' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#808f84' }} />
                          <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Area type="monotone" dataKey="actualKWh" name="Reported Generation / Activity" stroke="#25865b" strokeWidth={2} fill="url(#telemetryActual)" />
                          <Area type="monotone" dataKey="expectedKWh" name="AI Clear-Sky Physical Model" stroke="#3778a8" strokeDasharray="4 4" strokeWidth={2} fill="url(#telemetryExpected)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Telemetry Anomalies */}
                    {auditReport && auditReport.anomalyCount > 0 && (
                      <div style={{ marginTop: '14px', background: '#fdf3f3', border: '1px solid #f8c8c8', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c43232', fontSize: '11px', fontWeight: 700 }}>
                          <ShieldAlert size={16} /> {auditReport.anomalyCount} Critical Telemetry Anomalies Flagged by AI:
                        </div>
                        <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '10px', color: '#8b2b2b', lineHeight: 1.6 }}>
                          {auditReport.anomalies.map((a, idx) => (
                            <li key={idx}>
                              <b>Hour {a.hour}:00</b> - {a.reason} (Reported: {a.actual} vs Expected: {a.expected})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Right: AI Scorecard & On-Chain Action */}
                  <div>
                    {auditReport && (
                      <div>
                        <div className={`scorecard-banner ${auditReport.verdict === 'PASS' ? 'pass' : auditReport.verdict === 'REVIEW_FLAGGED' ? 'review' : 'fraud'}`}>
                          <div className="score-circle">
                            {auditReport.overallConfidence}%
                          </div>
                          <div>
                            <strong style={{ display: 'block', fontSize: '14px' }}>
                              {auditReport.verdict === 'PASS' ? 'Audit Passed · Ready to Mint' : auditReport.verdict === 'REVIEW_FLAGGED' ? 'Audit Flagged for Human Review' : 'Fraud Alert · Tampering Detected'}
                            </strong>
                            <p style={{ margin: '4px 0 0', fontSize: '10px', opacity: 0.9 }}>
                              {auditReport.verdictSummary}
                            </p>
                          </div>
                        </div>

                        <div className="audit-details-grid">
                          <div className="audit-metric-box">
                            <span>Claimed Reduction</span>
                            <strong>{auditReport.claimedTonnes} <small style={{ fontSize: '9px' }}>tCO₂e</small></strong>
                          </div>
                          <div className="audit-metric-box">
                            <span>AI Audited Output</span>
                            <strong>{auditReport.aiEstimatedTonnes} <small style={{ fontSize: '9px' }}>tCO₂e</small></strong>
                          </div>
                          <div className="audit-metric-box">
                            <span>Variance Delta</span>
                            <strong style={{ color: auditReport.variancePercentage > 20 ? '#ba3232' : '#287546' }}>
                              {auditReport.variancePercentage}%
                            </strong>
                          </div>
                        </div>

                        <div style={{ background: '#f8faf8', border: '1px solid #e7eee7', borderRadius: '8px', padding: '12px', fontSize: '11px', marginBottom: '14px' }}>
                          <div style={{ fontWeight: 700, color: '#384d3e', marginBottom: '4px' }}>GHG Protocol Calculation Factors:</div>
                          <div style={{ color: '#68776d', fontSize: '10px', lineHeight: 1.5 }}>
                            • Factor: {auditReport.emissionFactorUsed}<br />
                            • Protocol: {auditReport.methodology}
                          </div>
                        </div>

                        <button
                          className="primary-btn"
                          style={{ width: '100%', padding: '12px', fontSize: '12px' }}
                          onClick={handleRegisterOnChain}
                          disabled={isRegisteringOnChain || auditReport.verdict === 'FRAUD_SUSPECTED'}
                        >
                          {isRegisteringOnChain ? (
                            <><span className="spinner" /> Anchoring Proof on Blockchain...</>
                          ) : (
                            <><Blocks size={16} /> Anchor Proof & Register Claim On-Chain</>
                          )}
                        </button>
                        {auditReport.verdict === 'FRAUD_SUSPECTED' && (
                          <small style={{ display: 'block', color: '#c43232', fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>
                            Smart contract minting disabled for fraud-flagged sensor submissions.
                          </small>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROOF REGISTRY & BLOCKCHAIN EXPLORER */}
          {activeTab === 'Proof registry' && (
            <div className="tab-content">
              {/* Network Stats Bar */}
              <div className="action-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="blockchain-badge"><Blocks size={14} /> EVM Smart Contract</span>
                    <strong style={{ fontSize: '13px' }}>ClimateTraceRegistry.sol</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#748378' }}>
                    Contract Address: <code>0x12c49A4B8b03e22543B1f2a3E4F5a6B7c8D9E80b</code> · Network: {wallet.network} · Block Height: #{blockHeight}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="outline-btn" onClick={handleSimulateDoubleSpend}>
                    <ShieldAlert size={14} /> Simulate Double-Counting Attack
                  </button>
                  <button className="primary-btn" onClick={() => notify('EVM Contract synced with all mining nodes.')}>
                    <RefreshCw size={14} /> Refresh Node
                  </button>
                </div>
              </div>

              {/* Transactions Table */}
              <section className="panel">
                <div className="panel-head" style={{ padding: '18px 20px' }}>
                  <div>
                    <h2>Live Blockchain Ledger & Evidence Transactions</h2>
                    <p>Tamper-evident log of all registered claims, AI audits, and permanent retirements</p>
                  </div>
                  <span className="env-pill"><span /> EVM Paris Consensus</span>
                </div>

                <div className="table-scroll">
                  <table className="tx-table">
                    <thead>
                      <tr>
                        <th>TX HASH</th>
                        <th>BLOCK</th>
                        <th>ACTION / EVENT</th>
                        <th>CLAIM ID</th>
                        <th>FROM SENDER</th>
                        <th>GAS USED</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txHistory.map((tx, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className="tx-hash-link" title={tx.hash}>
                              {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                            </span>
                          </td>
                          <td><b>#{tx.blockNumber}</b></td>
                          <td>
                            <span className="blockchain-badge">
                              {tx.action}
                            </span>
                          </td>
                          <td><b>{tx.claimId}</b></td>
                          <td>
                            <code style={{ fontSize: '10px' }}>{tx.from}</code>
                          </td>
                          <td>{tx.gasUsed.toLocaleString()}</td>
                          <td>
                            <span className={`status ${tx.status === 'Success' ? 'green' : 'red'}`}>
                              {tx.status === 'Success' ? <BadgeCheck size={12} /> : <ShieldAlert size={12} />}
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: CARBON MARKETPLACE & RETIREMENT */}
          {activeTab === 'Marketplace & Retirement' && (
            <div className="tab-content">
              <div className="action-card" style={{ background: '#f4fbf6', border: '1px solid #cce8d5' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="blockchain-badge" style={{ background: '#e0f3e6', color: '#1f7543' }}>
                      <Award size={14} /> Anti-Double Counting Module
                    </span>
                    <strong style={{ fontSize: '14px', color: '#1d5c34' }}>
                      Permanent Offset Retirement (Burn to Neutralize)
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#497357' }}>
                    When corporate or community stakeholders purchase offsets, burning them on-chain generates a verifiable, non-transferable Certificate of Retirement.
                  </p>
                </div>
              </div>

              <div className="panel" style={{ padding: '20px' }}>
                <h2>Verified Offsets Available for Retirement</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px', marginTop: '16px' }}>
                  {claims.map(c => (
                    <div
                      key={c.id}
                      style={{
                        border: '1px solid #e5eee6',
                        borderRadius: '10px',
                        padding: '16px',
                        background: c.status === 'Retired' ? '#fdfefe' : '#fff',
                        opacity: c.status === 'Duplicate blocked' ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '13px', display: 'block', color: '#2b3b2f' }}>{c.name}</strong>
                          <small style={{ color: '#88988e' }}>{c.id} · {c.location}</small>
                        </div>
                        <span className={`status ${c.status === 'Verified' ? 'green' : c.status === 'Retired' ? 'mint' : c.status === 'AI Audited' ? 'amber' : 'red'}`}>
                          {c.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '14px 0', background: '#f8faf8', padding: '10px', borderRadius: '6px' }}>
                        <div>
                          <span style={{ fontSize: '9px', color: '#8a998f', display: 'block' }}>AUDITED CARBON</span>
                          <strong style={{ fontSize: '16px', color: '#27382d' }}>{c.estimated.toFixed(1)} <small style={{ fontSize: '10px' }}>tCO₂e</small></strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '9px', color: '#8a998f', display: 'block' }}>CONFIDENCE</span>
                          <strong style={{ fontSize: '16px', color: '#2c8756' }}>{c.confidenceScore}%</strong>
                        </div>
                      </div>

                      {c.status === 'Verified' && (
                        <button
                          className="primary-btn"
                          style={{ width: '100%' }}
                          onClick={() => setRetireClaimTarget(c)}
                        >
                          <Award size={15} /> Permanently Retire Offset
                        </button>
                      )}

                      {c.status === 'Retired' && (
                        <button
                          className="outline-btn"
                          style={{ width: '100%', borderColor: '#3ca266', color: '#207844' }}
                          onClick={() => setActiveRetirementCert(c)}
                        >
                          <Check size={15} /> View Retirement Certificate
                        </button>
                      )}

                      {c.status === 'AI Audited' && (
                        <button className="outline-btn" style={{ width: '100%' }} onClick={() => setActiveTab('AI dMRV Studio')}>
                          Verify in dMRV Studio
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CLIMATE COPILOT */}
          {activeTab === 'Climate Copilot' && (
            <div className="tab-content">
              <div className="copilot-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div className="brand-mark" style={{ width: '36px', height: '36px' }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '15px' }}>IEEE ClimateChain Copilot</h2>
                    <p style={{ margin: 0, fontSize: '11px', color: '#7a8c80' }}>
                      Trained on UNFCCC methodologies, IPCC AR6 metrics, and Article 6 carbon accounting
                    </p>
                  </div>
                </div>

                {/* Chat History */}
                <div style={{ height: '340px', overflowY: 'auto', border: '1px solid #edf2ed', borderRadius: '10px', padding: '16px', background: '#fafcfa', marginBottom: '14px' }}>
                  {copilotHistory.map((item, idx) => (
                    <div key={idx} className={`copilot-bubble ${item.sender}`}>
                      {item.text}
                    </div>
                  ))}
                </div>

                {/* Suggested Prompt Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <button className="dataset-chip" onClick={() => handleAskCopilot('How does the smart contract prevent double-counting under Paris Agreement Article 6?')}>
                    🛡️ Double Counting Prevention
                  </button>
                  <button className="dataset-chip" onClick={() => handleAskCopilot('What equation does ACM0002 use for solar microgrid emission reductions?')}>
                    ☀️ ACM0002 Solar Methodology
                  </button>
                  <button className="dataset-chip" onClick={() => handleAskCopilot('How are EV fleet emission reductions calculated under AMS-III.C?')}>
                    🚌 AMS-III.C Fleet Calculation
                  </button>
                  <button className="dataset-chip" onClick={() => handleAskCopilot('How does the AI model detect night-time phantom solar generation?')}>
                    🔍 Telemetry Anomaly Detection
                  </button>
                </div>

                {/* Input Area */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAskCopilot(); }}
                  style={{ display: 'flex', gap: '10px' }}
                >
                  <input
                    value={copilotQuestion}
                    onChange={e => setCopilotQuestion(e.target.value)}
                    placeholder="Ask about carbon methodologies, smart contracts, or emission factors..."
                    style={{ flex: 1, height: '42px', borderRadius: '8px', border: '1px solid #d8e2d9', padding: '0 14px', fontSize: '12px' }}
                  />
                  <button className="primary-btn" type="submit">
                    Send Query
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="footer">
            <span>© 2026 VeriClimate AI · IEEE ClimateChain Global Hackathon Edition</span>
            <span>
              <span className="footer-dot" /> Built for COP31 Environmental Transparency & UN SDG 13
            </span>
          </footer>
        </div>
      </main>

      {/* DETAIL DRAWER */}
      {selectedClaim && (
        <div className="detail-backdrop" onClick={() => setSelectedClaim(null)}>
          <aside className="detail-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span className="eyebrow">ASSET / CLAIM AUDIT TRAIL</span>
                <h2>{selectedClaim.name}</h2>
                <small>{selectedClaim.id} · {selectedClaim.location}</small>
              </div>
              <button className="icon-btn" onClick={() => setSelectedClaim(null)}><X size={18} /></button>
            </div>

            <div className="drawer-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`status ${selectedClaim.status === 'Verified' || selectedClaim.status === 'Retired' ? 'green' : selectedClaim.status === 'AI Audited' ? 'amber' : 'red'}`}>
                  {selectedClaim.status}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#25865b' }}>
                  AI Confidence: {selectedClaim.confidenceScore}%
                </span>
              </div>

              <div className="drawer-stat-grid">
                <div>
                  <small>Claimed Reduction</small>
                  <b>{selectedClaim.claimed.toFixed(1)} <i>tCO₂e</i></b>
                </div>
                <div>
                  <small>Audited Reduction</small>
                  <b>{selectedClaim.estimated.toFixed(1)} <i>tCO₂e</i></b>
                </div>
              </div>

              <div className="drawer-section">
                <h3><Sparkles size={16} /> AI Screening & Physical Model Findings</h3>
                <p>{selectedClaim.note}</p>
              </div>

              <div className="drawer-section">
                <h3><FileText size={16} /> Raw Evidence Ingested</h3>
                <div className="evidence-file">
                  <div className="file-icon"><FileCheck2 size={18} /></div>
                  <div>
                    <b>{selectedClaim.evidence}</b>
                    <small>High-frequency CSV telemetry · Ingested & Parsed</small>
                  </div>
                  <Check size={16} className="check-icon" />
                </div>
              </div>

              <div className="drawer-section">
                <h3><Fingerprint size={16} /> Cryptographic Evidence Fingerprint</h3>
                <div className="hash-box">
                  <code>{selectedClaim.hash}</code>
                  <button onClick={() => { navigator.clipboard?.writeText(selectedClaim.hash); notify('Hash copied to clipboard!'); }}>
                    Copy
                  </button>
                </div>
                <p className="fine-print">
                  Anchored via Keccak-256 in ClimateTraceRegistry.sol on-chain mapping. Any tampering with raw sensor rows will invalidate this hash.
                </p>
              </div>

              {selectedClaim.txHash && (
                <div className="drawer-section">
                  <h3><Blocks size={16} /> Blockchain Proof</h3>
                  <div style={{ fontSize: '11px', color: '#55665a', lineHeight: 1.6 }}>
                    • Tx Hash: <code>{selectedClaim.txHash.slice(0, 14)}...</code><br />
                    • Block: #{selectedClaim.blockNumber}<br />
                    • Submitter: <code>{selectedClaim.submitter.slice(0, 10)}...</code>
                  </div>
                </div>
              )}

              <button className="primary-btn full-btn" onClick={() => exportReport(selectedClaim)}>
                <Download size={16} /> Download Verification Report (JSON)
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* NEW CLAIM MODAL */}
      {showNewModal && (
        <div className="modal-backdrop" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">NEW SUBMISSION</span>
                <h2>Submit Telemetry for AI dMRV Audit</h2>
                <p>Register high-resolution sensor logs for cryptographic anchoring.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowNewModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              setShowNewModal(false);
              setActiveTab('AI dMRV Studio');
              notify('Switched to dMRV Studio to audit telemetry!');
            }}>
              <label>
                Project / Asset Name
                <input required value={studioProjectName} onChange={e => setStudioProjectName(e.target.value)} placeholder="e.g. Gujarat Solar Phase 4" />
              </label>

              <div className="form-row">
                <label>
                  Sector / Type
                  <select value={studioType} onChange={e => setStudioType(e.target.value as any)}>
                    <option value="Renewable energy">Renewable energy (Solar/Wind)</option>
                    <option value="Transport">Transport (EV Fleets)</option>
                    <option value="Waste management">Waste management (Biogas)</option>
                  </select>
                </label>
                <label>
                  Geographic Location
                  <input value={studioLocation} onChange={e => setStudioLocation(e.target.value)} placeholder="City, Country" />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Claimed Reduction (tCO₂e)
                  <input required type="number" step="0.1" value={studioClaimed} onChange={e => setStudioClaimed(parseFloat(e.target.value) || 0)} />
                </label>
                <label>
                  Telemetry Dataset
                  <select value={selectedDatasetKey} onChange={e => handleSelectSample(e.target.value)}>
                    <option value="solarClean">Clean Solar Telemetry</option>
                    <option value="fleetTransit">EV Fleet Transit Telemetry</option>
                    <option value="biogasWaste">Agro Biogas Digester</option>
                    <option value="fraudulentSolar">Simulated Tampered Telemetry</option>
                  </select>
                </label>
              </div>

              <button className="primary-btn full-btn" type="submit">
                <FileSearch size={16} /> Open in AI dMRV Studio & Run Analysis
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RETIREMENT MODAL */}
      {retireClaimTarget && (
        <div className="modal-backdrop" onClick={() => setRetireClaimTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">PERMANENT OFFSET RETIREMENT</span>
                <h2>Retire {retireClaimTarget.estimated.toFixed(1)} tCO₂e Carbon Credits</h2>
                <p>This action permanently burns the tokens on-chain to prevent double counting.</p>
              </div>
              <button className="icon-btn" onClick={() => setRetireClaimTarget(null)}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '11px', fontWeight: 700 }}>
                Beneficiary Organization / Individual
                <input
                  style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #d4ddd5', marginTop: '6px', padding: '0 10px' }}
                  value={beneficiaryName}
                  onChange={e => setBeneficiaryName(e.target.value)}
                  placeholder="e.g. IEEE Orange County Chapter"
                />
              </label>

              <label style={{ display: 'block', marginBottom: '14px', fontSize: '11px', fontWeight: 700 }}>
                Retirement Purpose / ESG Goal
                <input
                  style={{ width: '100%', height: '38px', borderRadius: '7px', border: '1px solid #d4ddd5', marginTop: '6px', padding: '0 10px' }}
                  value={retirementReason}
                  onChange={e => setRetirementReason(e.target.value)}
                  placeholder="e.g. Scope 2 Data Center Neutralization Q3"
                />
              </label>

              <div style={{ background: '#fdf6e9', border: '1px solid #f2dbb3', padding: '12px', borderRadius: '8px', fontSize: '11px', color: '#976114', marginBottom: '18px' }}>
                ⚠️ <b>Permanent & Irreversible:</b> Once executed, this credit cannot be resold, transferred, or re-claimed. An immutable Certificate of Retirement will be issued on the blockchain.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="outline-btn" onClick={() => setRetireClaimTarget(null)}>Cancel</button>
                <button className="primary-btn" onClick={handleExecuteRetirement}>
                  <Award size={16} /> Confirm On-Chain Retirement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RETIREMENT CERTIFICATE VIEW MODAL */}
      {activeRetirementCert && activeRetirementCert.retirement && (
        <div className="modal-backdrop" onClick={() => setActiveRetirementCert(null)}>
          <div className="modal" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
            <div className="certificate-card">
              <button
                className="icon-btn"
                style={{ position: 'absolute', top: '16px', right: '16px' }}
                onClick={() => setActiveRetirementCert(null)}
              >
                <X size={18} />
              </button>

              <div className="cert-seal">
                <Award size={34} />
              </div>

              <div className="cert-header">
                <span className="eyebrow" style={{ justifyContent: 'center' }}>
                  OFFICIAL DECENTRALIZED CERTIFICATE OF RETIREMENT
                </span>
                <h3>{activeRetirementCert.estimated.toFixed(1)} Metric Tonnes CO₂e Retired</h3>
                <p>Issued under IEEE ClimateChain Decentralized MRV Standards for UN COP31</p>
              </div>

              <div className="cert-grid">
                <div>
                  <span>Beneficiary</span>
                  <strong>{activeRetirementCert.retirement.beneficiary}</strong>
                </div>
                <div>
                  <span>Reason / Purpose</span>
                  <strong>{activeRetirementCert.retirement.reason}</strong>
                </div>
                <div>
                  <span>Project Origin</span>
                  <strong>{activeRetirementCert.name}</strong>
                </div>
                <div>
                  <span>Date of Retirement</span>
                  <strong>{activeRetirementCert.retirement.timestamp}</strong>
                </div>
              </div>

              <div style={{ background: '#f3f7f4', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6d7f72', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Certificate Hash (Keccak-256 On-Chain Proof)
                </span>
                <code style={{ fontSize: '10px', color: '#257042', wordBreak: 'break-all' }}>
                  {activeRetirementCert.retirement.certificateHash}
                </code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button className="primary-btn" onClick={() => exportReport(activeRetirementCert)}>
                  <Download size={16} /> Download Cryptographic Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast">
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
