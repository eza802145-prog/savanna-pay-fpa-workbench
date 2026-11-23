import {
  BALANCE_SHEET_STRUCTURE,
  DIM_PERIOD_TABLE,
  ENTITY_PROFILE,
} from '../data/savannaPayData';
import {
  BSMapEntry,
  CleanedTrialBalanceRow,
  DisplayScale,
  FinancialPositionSummary,
  PowerQueryStepSummary,
  TrialBalanceValidationResult,
} from '../types/fpa';

// ============================================================================
// Pure TypeScript OOXML (.xlsx) Generator (Store-mode ZIP + SpreadsheetML)
// Produces a valid multi-sheet Microsoft Excel .xlsx workbook with zero dependencies
// ============================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBlob(files: Array<{ name: string; content: string }>): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);

    // Local File Header (30 bytes + name)
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(localHeader);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // Store
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    new Uint8Array(localHeader, 30).set(nameBytes);

    localParts.push(new Uint8Array(localHeader), dataBytes);

    // Central Directory Header (46 bytes + name)
    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(centralHeader);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    new Uint8Array(centralHeader, 46).set(nameBytes);

    centralParts.push(new Uint8Array(centralHeader));
    offset += localHeader.byteLength + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const allChunks = [...localParts, ...centralParts, new Uint8Array(eocd)];
  const totalBytes = allChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const archiveBuffer = new ArrayBuffer(totalBytes);
  const archiveView = new Uint8Array(archiveBuffer);
  let writePos = 0;
  for (const chunk of allChunks) {
    archiveView.set(chunk, writePos);
    writePos += chunk.byteLength;
  }

  return new Blob([archiveBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(index: number): string {
  let n = index + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

type CellVal = string | number;

function buildWorksheetXml(rows: CellVal[][]): string {
  const rowXml = rows
    .map((cells, rIdx) => {
      const rNum = rIdx + 1;
      const cellXml = cells
        .map((val, cIdx) => {
          const ref = `${colLetter(cIdx)}${rNum}`;
          if (typeof val === 'number' && Number.isFinite(val)) {
            return `<c r="${ref}"><v>${val}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(val ?? ''))}</t></is></c>`;
        })
        .join('');
      return `<row r="${rNum}">${cellXml}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

export function downloadWorkbenchXlsx(params: {
  summary: FinancialPositionSummary;
  cleanRows: CleanedTrialBalanceRow[];
  bsMap: BSMapEntry[];
  validations: TrialBalanceValidationResult[];
  scale: DisplayScale;
}) {
  const { summary, cleanRows, bsMap, validations, scale } = params;
  const divisor = scale === 'millions' ? 1_000_000 : 1;
  const displayPeriods = [...summary.activePeriods].reverse();

  // Sheet 1: Financial_Position
  const fpRows: CellVal[][] = [
    [`${ENTITY_PROFILE.legalName} — Management Balance Sheet (Financial Position)`],
    [`Address: ${ENTITY_PROFILE.address} | Tel: ${ENTITY_PROFILE.phone} | Email: ${ENTITY_PROFILE.email}`],
    [`Units: ${scale === 'millions' ? 'NGN Millions' : 'NGN'} | Latest Period: ${summary.latestPeriod}`],
    [],
    ['Section', 'Line Item', ...displayPeriods, `Change vs ${summary.priorPeriod}`, 'Change %'],
  ];

  const pushSubtotal = (label: string, values: Record<string, number>) => {
    const chg = values[summary.latestPeriod] - values[summary.priorPeriod];
    const prior = values[summary.priorPeriod];
    const pct = prior !== 0 ? `${((chg / Math.abs(prior)) * 100).toFixed(2)}%` : '-';
    fpRows.push([
      '',
      label,
      ...displayPeriods.map((p) => Number((values[p] / divisor).toFixed(2))),
      Number((chg / divisor).toFixed(2)),
      pct,
    ]);
  };

  for (const sec of BALANCE_SHEET_STRUCTURE) {
    fpRows.push([sec.section]);
    for (const item of sec.items) {
      const lr = summary.lineRows.find((r) => r.lineItem === item.lineItem);
      if (!lr) continue;
      fpRows.push([
        sec.section,
        lr.lineItem,
        ...displayPeriods.map((p) => Number((lr.values[p] / divisor).toFixed(2))),
        Number((lr.changeVsPrior / divisor).toFixed(2)),
        lr.changePct !== null ? `${lr.changePct.toFixed(2)}%` : '-',
      ]);
    }
    if (sec.section === 'NON-CURRENT ASSETS') {
      pushSubtotal('Total Non-current Assets', summary.subtotals.nonCurrentAssets);
    } else if (sec.section === 'CURRENT ASSETS') {
      pushSubtotal('Total Current Assets', summary.subtotals.currentAssets);
      pushSubtotal('TOTAL ASSETS', summary.subtotals.totalAssets);
    } else if (sec.section === 'CURRENT LIABILITIES') {
      pushSubtotal('Total Current Liabilities', summary.subtotals.currentLiabilities);
    } else if (sec.section === 'NON-CURRENT LIABILITIES') {
      pushSubtotal('Total Non-current Liabilities', summary.subtotals.nonCurrentLiabilities);
      pushSubtotal('TOTAL LIABILITIES', summary.subtotals.totalLiabilities);
    } else if (sec.section === 'EQUITY') {
      pushSubtotal('Total Equity', summary.subtotals.totalEquity);
      pushSubtotal('TOTAL LIABILITIES & EQUITY', summary.subtotals.totalLiabilitiesAndEquity);
    }
  }

  fpRows.push([]);
  fpRows.push([
    'CONTROL',
    'Check: Assets - Liabilities - Equity',
    ...displayPeriods.map((p) => Number((summary.equationCheck[p] / divisor).toFixed(2))),
  ]);
  fpRows.push([
    'CONTROL',
    'Status',
    ...displayPeriods.map((p) => summary.equationStatus[p]),
  ]);

  // Sheet 2: TB_Clean
  const tbCleanRows: CellVal[][] = [
    ['Period_Key', 'ReportDate', 'SourceSheet', 'AccountCode', 'AccountName', 'Debit_Amt', 'Credit_Amt', 'NetAmount', 'BS_Section', 'BS_LineItem', 'PresentationSign', 'Presented_Balance', 'MappingStatus'],
    ...cleanRows.map((r) => [
      r.period,
      r.periodDate,
      r.sourceSheet,
      r.accountCode,
      r.accountName,
      r.debit,
      r.credit,
      r.netAmount,
      r.bsSection,
      r.bsLineItem,
      r.presentationSign,
      r.netAmount * r.presentationSign,
      r.isMapped ? 'Mapped' : 'UNMAPPED',
    ]),
  ];

  // Sheet 3: BS_Map
  const bsMapRows: CellVal[][] = [
    ['AccountCode', 'AccountName', 'BS_Section', 'BS_LineItem', 'NormalBalance', 'PresentationSign', 'Notes'],
    ...bsMap.map((m) => [
      m.accountCode,
      m.accountName,
      m.bsSection,
      m.bsLineItem,
      m.normalBalance,
      m.presentationSign,
      m.notes ?? '',
    ]),
  ];

  // Sheet 4: Dim_Period
  const dimPeriodRows: CellVal[][] = [
    ['PeriodKey', 'PeriodEndDate', 'FiscalLabel', 'PriorPeriod', 'Quarter'],
    ...DIM_PERIOD_TABLE.map((d) => [
      d.periodKey,
      d.periodEndDate,
      d.fiscalLabel,
      d.priorPeriod ?? '',
      d.quarter,
    ]),
  ];

  // Sheet 5: Validation_Check
  const valRows: CellVal[][] = [
    ['Period', 'SourceSheet', 'RawRows', 'CleanedRows', 'TotalDebits', 'TotalCredits', 'NetTrialBalance', 'UnmappedCount', 'Status'],
    ...validations.map((v) => [
      v.period,
      v.sourceSheet,
      v.rowCountRaw,
      v.rowCountClean,
      v.totalDebits,
      v.totalCredits,
      v.netBalance,
      v.unmappedCount,
      v.isZeroBalanced ? 'Balances (0.00)' : 'Variance Detected',
    ]),
  ];

  const sheets = [
    { name: 'Financial_Position', rows: fpRows },
    { name: 'TB_Clean', rows: tbCleanRows },
    { name: 'BS_Map', rows: bsMapRows },
    { name: 'Dim_Period', rows: dimPeriodRows },
    { name: 'Validation_Check', rows: valRows },
  ];

  const files: Array<{ name: string; content: string }> = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join('\n    ')}
  </sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('\n  ')}
</Relationships>`,
    },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      content: buildWorksheetXml(s.rows),
    })),
  ];

  const blob = createZipBlob(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Savanna_Pay_FPA_Workbench.xlsx');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Docs PNG Snapshot Generators (balance_sheet_dashboard.png & power_query_lineage.png)
// ============================================================================

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadDashboardSnapshotPng(summary: FinancialPositionSummary) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const p = summary.latestPeriod;
  const fmtB = (val: number) => `₦${(val / 1_000_000_000).toFixed(2)}B`;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 1280, 720);

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1280, 92);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Savanna Pay Ltd — Management Balance Sheet Dashboard', 44, 44);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText(
    `${ENTITY_PROFILE.address}  |  Tel: ${ENTITY_PROFILE.phone}  |  ${ENTITY_PROFILE.email}  |  Period: ${p}`,
    44,
    72
  );

  // KPI cards
  const kpis = [
    { label: 'Total Assets', value: fmtB(summary.subtotals.totalAssets[p]) },
    { label: 'Current Ratio', value: `${summary.ratios.currentRatio[p].toFixed(2)}x` },
    { label: 'Safeguarding Cover', value: `${summary.ratios.safeguardingCoverPct[p].toFixed(1)}%` },
    { label: 'Debt-to-Equity', value: `${summary.ratios.debtToEquity[p].toFixed(2)}x` },
  ];

  kpis.forEach((k, idx) => {
    const x = 44 + idx * 302;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, 124, 282, 124);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(x, 124, 282, 124);
    ctx.fillStyle = '#475569';
    ctx.font = '600 14px sans-serif';
    ctx.fillText(k.label, x + 22, 160);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(k.value, x + 22, 212);
  });

  // Balance Sheet Summary Table
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(44, 280, 1192, 396);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(44, 280, 1192, 396);

  ctx.fillStyle = '#065f46';
  ctx.fillRect(44, 280, 1192, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Statement of Financial Position Summary (NGN Billions)', 66, 309);

  const summaryRows = [
    ['Total Non-Current Assets', fmtB(summary.subtotals.nonCurrentAssets[p])],
    ['Total Current Assets', fmtB(summary.subtotals.currentAssets[p])],
    ['TOTAL ASSETS', fmtB(summary.subtotals.totalAssets[p])],
    ['Total Current Liabilities', fmtB(summary.subtotals.currentLiabilities[p])],
    ['Total Non-Current Liabilities', fmtB(summary.subtotals.nonCurrentLiabilities[p])],
    ['Total Equity', fmtB(summary.subtotals.totalEquity[p])],
    ['Accounting Equation Check (A - L - E)', `${summary.equationStatus[p]} (0.00)`],
  ];

  summaryRows.forEach(([label, val], idx) => {
    const y = 368 + idx * 42;
    ctx.fillStyle = idx === 2 || idx === 6 ? '#0f172a' : '#334155';
    ctx.font = idx === 2 || idx === 6 ? 'bold 16px sans-serif' : '15px sans-serif';
    ctx.fillText(label, 68, y);
    ctx.font = idx === 2 || idx === 6 ? 'bold 16px monospace' : '15px monospace';
    ctx.fillText(val, 980, y);
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(66, y + 14);
    ctx.lineTo(1214, y + 14);
    ctx.stroke();
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'balance_sheet_dashboard.png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export function downloadLineageSnapshotPng(steps: PowerQueryStepSummary[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 1280, 680);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1280, 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Savanna Pay FP&A — Power Query ETL & COA Merge Lineage', 44, 42);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  ctx.fillText('power_query/transform_trial_balance.pq  ->  power_query/merge_coa_mapping.pq  ->  Financial_Position', 44, 68);

  steps.forEach((step, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 44 + col * 404;
    const y = 128 + row * 250;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 376, 210);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(x, y, 376, 210);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`STEP 0${step.stepNumber} · ${step.powerQueryFunction}`, x + 20, y + 36);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(step.name, x + 20, y + 70);

    ctx.fillStyle = '#475569';
    ctx.font = '13px sans-serif';
    ctx.fillText(step.description.slice(0, 52), x + 20, y + 108);
    ctx.fillText(step.description.slice(52, 104), x + 20, y + 128);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Rows In: ${step.rowsIn}  ->  Rows Out: ${step.rowsOut}`, x + 20, y + 180);
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'power_query_lineage.png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
