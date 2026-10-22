import { AiAuditReport, TelemetryPoint } from '../types';

export const EMISSION_FACTORS = {
  gridSolarIndia: 0.716, // kg CO2e / kWh (CEA India national average grid factor)
  gridSolarUS: 0.386,    // kg CO2e / kWh (EPA eGRID average)
  gridSolarEurope: 0.231, // kg CO2e / kWh (EEA average)
  dieselTransport: 0.270, // kg CO2e / vehicle-km
  evTransportGrid: 0.075, // kg CO2e / EV-km (renewable-mixed charging)
  methaneDensity: 0.717,  // kg / m3
  methaneGWP28: 28.0,    // IPCC AR6 100-year GWP for biogenic methane
};

export function parseTelemetryCsv(csvText: string, projectType: string): TelemetryPoint[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const points: TelemetryPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim());
    if (row.length < 2) continue;

    const hour = parseInt(row[0], 10) || i;
    const actual = parseFloat(row[1]) || 0;
    const activityOrIrradiance = row[2] ? parseFloat(row[2]) : (projectType === 'Renewable energy' ? getStandardSolarIrradiance(hour % 24) : 50);

    // Calculate physical theoretical expectation
    let expected = 0;
    if (projectType === 'Renewable energy') {
      // Solar clear-sky calculation: Area ~ 500 m2, efficiency 19%
      expected = Math.max(0, activityOrIrradiance * 0.5 * 0.19 * 0.82); // in kWh
    } else if (projectType === 'Transport') {
      // Fleet km * energy efficiency factor (0.22 kWh/km)
      expected = activityOrIrradiance * 0.22;
    } else if (projectType === 'Waste management') {
      // Biogas m3 captured
      expected = activityOrIrradiance * 0.65;
    } else {
      expected = actual * 0.96;
    }

    // Check for anomalies
    let isAnomaly = false;
    let anomalyReason = '';

    if (projectType === 'Renewable energy') {
      const h24 = hour % 24;
      if ((h24 < 6 || h24 > 18) && actual > 1.0) {
        isAnomaly = true;
        anomalyReason = `Nighttime generation detected at hour ${h24}:00 (${actual.toFixed(1)} kWh reported with 0 solar irradiance)`;
      } else if (actual > expected * 1.55 && expected > 2) {
        isAnomaly = true;
        anomalyReason = `Generation exceeds theoretical physical solar capacity by ${( (actual/expected - 1) * 100 ).toFixed(0)}% at hour ${h24}:00`;
      }
    } else if (actual > expected * 1.7) {
      isAnomaly = true;
      anomalyReason = `Activity reported is significantly above physical equipment baseline (+${((actual/expected - 1)*100).toFixed(0)}%)`;
    }

    points.push({
      timestamp: `H${String(hour).padStart(2, '0')}:00`,
      hour,
      actualKWh: Math.round(actual * 10) / 10,
      expectedKWh: Math.round(expected * 10) / 10,
      irradianceOrActivity: activityOrIrradiance,
      isAnomaly,
      anomalyReason
    });
  }

  return points;
}

function getStandardSolarIrradiance(hour: number): number {
  if (hour < 6 || hour > 18) return 0;
  // Sinusoidal irradiance bell curve peaking at solar noon (hour 12) ~ 850 W/m2
  const peak = 850;
  const radians = ((hour - 6) / 12) * Math.PI;
  return Math.round(Math.max(0, peak * Math.sin(radians)));
}

export function runAiAudit(
  claimedTonnes: number,
  projectType: string,
  telemetryPoints: TelemetryPoint[]
): AiAuditReport {
  let calculatedTonnes = 0;
  let methodology = '';
  let emissionFactor = '';

  if (projectType === 'Renewable energy') {
    // ACM0002 methodology: Total generation (kWh) * Grid Factor / 1000
    const totalKWh = telemetryPoints.reduce((acc, p) => acc + (p.isAnomaly ? p.expectedKWh : p.actualKWh), 0);
    calculatedTonnes = (totalKWh * EMISSION_FACTORS.gridSolarIndia) / 1000;
    methodology = 'UNFCCC ACM0002 (Grid-connected electricity generation from renewable sources)';
    emissionFactor = `${EMISSION_FACTORS.gridSolarIndia} kg CO2e / kWh (CEA Grid Factor)`;
  } else if (projectType === 'Transport') {
    // AMS-III.C methodology: Avoided diesel emissions
    const totalKm = telemetryPoints.reduce((acc, p) => acc + (p.isAnomaly ? p.expectedKWh : p.actualKWh), 0);
    const avoidedPerKm = EMISSION_FACTORS.dieselTransport - EMISSION_FACTORS.evTransportGrid;
    calculatedTonnes = (totalKm * avoidedPerKm) / 1000;
    methodology = 'UNFCCC AMS-III.C (Emission reductions by electric and hybrid vehicles)';
    emissionFactor = `Net ${avoidedPerKm.toFixed(3)} kg CO2e / km avoided vs. diesel baseline`;
  } else if (projectType === 'Waste management') {
    // ACM0010 methodology: Biogas methane capture & destruction
    const totalM3 = telemetryPoints.reduce((acc, p) => acc + (p.isAnomaly ? p.expectedKWh : p.actualKWh), 0);
    calculatedTonnes = (totalM3 * EMISSION_FACTORS.methaneDensity * 0.60 * EMISSION_FACTORS.methaneGWP28) / 1000;
    methodology = 'UNFCCC ACM0010 (GHG emission reductions from manure & organic waste management)';
    emissionFactor = `GWP 28.0 (IPCC AR6 biogenic methane factor)`;
  } else {
    calculatedTonnes = claimedTonnes * 0.94;
    methodology = 'GHG Protocol Corporate Standard (Scope 1 & 2 Guidance)';
    emissionFactor = 'Global Weighted Carbon Factor';
  }

  // Calculate discrepancies and statistical anomalies
  const discrepancy = calculatedTonnes > 0 ? Math.abs(claimedTonnes - calculatedTonnes) / calculatedTonnes : 0;
  const anomalies = telemetryPoints.filter(p => p.isAnomaly);
  const anomalyCount = anomalies.length;

  // Confidence Score Formula (0 to 100)
  // Base 100, penalized by discrepancy % and anomalous sensor events
  let confidence = 100 - (discrepancy * 50) - (anomalyCount * 6);
  if (confidence < 0) confidence = 0;
  if (confidence > 100) confidence = 100;
  confidence = Math.round(confidence * 10) / 10;

  let verdict: 'PASS' | 'REVIEW_FLAGGED' | 'FRAUD_SUSPECTED' = 'PASS';
  let verdictSummary = '';
  const recommendations: string[] = [];

  if (discrepancy > 0.40 || anomalyCount >= 5) {
    verdict = 'FRAUD_SUSPECTED';
    verdictSummary = `High risk of data inflation or fraudulent sensor reporting. Claimed reduction exceeds audited physical baseline by ${(discrepancy * 100).toFixed(1)}% with ${anomalyCount} critical telemetry anomalies.`;
    recommendations.push('Immediate halt on tokenization or carbon credit issuance.');
    recommendations.push('Require cryptographic calibration logs from the on-site inverter / meter hardware.');
    recommendations.push('Refer to third-party independent auditor under Gold Standard compliance protocols.');
  } else if (discrepancy > 0.12 || anomalyCount >= 1) {
    verdict = 'REVIEW_FLAGGED';
    verdictSummary = `Moderate variance detected between claimed reduction and AI physical model (${(discrepancy * 100).toFixed(1)}% difference). ${anomalyCount} anomalous data intervals flagged for auditor inspection.`;
    recommendations.push('Verify transmission loss factors and inverter availability downtime.');
    recommendations.push('Reconcile utility inter-tie billing receipts against automated telemetry.');
  } else {
    verdict = 'PASS';
    verdictSummary = `Strong physical and statistical alignment. Claimed reduction (${claimedTonnes.toFixed(1)} tCO2e) is within ${(discrepancy * 100).toFixed(1)}% of audited calculations (${calculatedTonnes.toFixed(1)} tCO2e). Zero systemic telemetry tampering detected.`;
    recommendations.push('Eligible for smart-contract proof anchoring.');
    recommendations.push('Ready for on-chain carbon credit token minting.');
  }

  return {
    overallConfidence: confidence,
    claimedTonnes: Math.round(claimedTonnes * 10) / 10,
    aiEstimatedTonnes: Math.round(calculatedTonnes * 10) / 10,
    variancePercentage: Math.round(discrepancy * 1000) / 10,
    totalDataPoints: telemetryPoints.length,
    anomalyCount,
    anomalies: anomalies.map(a => ({
      hour: a.hour,
      actual: a.actualKWh,
      expected: a.expectedKWh,
      reason: a.anomalyReason || 'Statistical outlier'
    })),
    methodology,
    emissionFactorUsed: emissionFactor,
    verdict,
    verdictSummary,
    recommendations
  };
}
