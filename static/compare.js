/**
 * InsureAI – Compare Policies Page Logic
 */

const API = '';
let cmpType = 'health';
let cmpPolicies = [];

const sel1 = document.getElementById('policy-select-1');
const sel2 = document.getElementById('policy-select-2');
const compareBtn = document.getElementById('compare-now-btn');
const resultDiv = document.getElementById('comparison-result');
const thead = document.getElementById('comp-thead');
const tbody = document.getElementById('comp-tbody');
const winnerBadge = document.getElementById('winner-badge');

// ─── Health comparison fields ────────────────────────────────────────────────
const HEALTH_FIELDS = [
  { key: 'Premium 35yr ₹10L/yr', label: 'Premium (Age 35)', format: 'currency', lower: true },
  { key: 'Max SI (₹L)', label: 'Coverage (₹L)', format: 'number', lower: false },
  { key: 'PED Wait (yrs)', label: 'PED Waiting Period', format: 'text', lower: true },
  { key: 'CSR %', label: 'Claim Settlement Ratio', format: 'pct', lower: false },
  { key: 'Room Rent Limit', label: 'Room Rent Limit', format: 'text' },
  { key: 'Co-pay %', label: 'Co-payment %', format: 'text', lower: true },
  { key: 'PED Wait (yrs)', label: 'PED Waiting', format: 'text', lower: true },
  { key: 'Maternity Cover', label: 'Maternity Benefit', format: 'text' },
];

// ─── Vehicle comparison fields ───────────────────────────────────────────────
const VEHICLE_FIELDS = [
  { key: 'Total Premium (₹/yr)', label: 'Total Premium', format: 'currency', lower: true },
  { key: 'IDV Typical (₹)', label: 'IDV (Typical)', format: 'currency', lower: false },
  { key: 'Claim Settlement Ratio %', label: 'Claim Settlement Ratio', format: 'pct', lower: false },
  { key: 'Zero Dep Add-on', label: 'Zero Depreciation', format: 'text' },
  { key: 'Roadside Assist', label: 'Roadside Assistance', format: 'text' },
  { key: 'Cashless Garages', label: 'Cashless Garages', format: 'number', lower: false },
  { key: 'Engine Protect Add-on', label: 'Engine Protection', format: 'text' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD DATA
// ═══════════════════════════════════════════════════════════════════════════════
async function loadCompareData() {
  try {
    const res = await fetch(`${API}/api/insurance-data/${cmpType}`);
    const data = await res.json();
    cmpPolicies = data.policies || [];
    populateDropdowns();
    resultDiv.classList.add('hidden');
  } catch (err) {
    console.error('Failed to load:', err);
  }
}

function populateDropdowns() {
  const options = cmpPolicies.map((p, i) =>
    `<option value="${i}">${p['Insurer']} – ${p['Plan Name']}</option>`
  ).join('');
  const placeholder = '<option value="">-- Select a Policy --</option>';
  sel1.innerHTML = placeholder + options;
  sel2.innerHTML = placeholder + options;
  compareBtn.disabled = true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARE
// ═══════════════════════════════════════════════════════════════════════════════
function runComparison() {
  const i1 = parseInt(sel1.value);
  const i2 = parseInt(sel2.value);
  if (isNaN(i1) || isNaN(i2) || i1 === i2) return;

  const p1 = cmpPolicies[i1];
  const p2 = cmpPolicies[i2];
  const fields = cmpType === 'health' ? HEALTH_FIELDS : VEHICLE_FIELDS;

  // Build header
  thead.innerHTML = `<tr class="bg-slate-800/40">
    <th class="px-6 py-4 text-[10px] text-slate-500 uppercase font-bold tracking-widest w-1/3">Feature</th>
    <th class="px-6 py-4 text-sm font-bold text-indigo-400">${p1['Insurer']}<br><span class="text-xs text-slate-400 font-normal">${p1['Plan Name']}</span></th>
    <th class="px-6 py-4 text-sm font-bold text-purple-400">${p2['Insurer']}<br><span class="text-xs text-slate-400 font-normal">${p2['Plan Name']}</span></th>
  </tr>`;

  // Build rows
  let p1Score = 0, p2Score = 0;
  tbody.innerHTML = fields.map(f => {
    let v1 = p1[f.key] ?? 'N/A';
    let v2 = p2[f.key] ?? 'N/A';
    const v1Str = formatVal(v1, f.format);
    const v2Str = formatVal(v2, f.format);

    let c1 = 'text-white', c2 = 'text-white';
    if (f.lower !== undefined) {
      const n1 = parseFloat(v1), n2 = parseFloat(v2);
      if (!isNaN(n1) && !isNaN(n2) && n1 !== n2) {
        if (f.lower) {
          c1 = n1 < n2 ? 'better-val' : 'worse-val';
          c2 = n2 < n1 ? 'better-val' : 'worse-val';
          if (n1 < n2) p1Score++; else p2Score++;
        } else {
          c1 = n1 > n2 ? 'better-val' : 'worse-val';
          c2 = n2 > n1 ? 'better-val' : 'worse-val';
          if (n1 > n2) p1Score++; else p2Score++;
        }
      }
    }

    return `<tr class="hover:bg-slate-800/30 transition-colors">
      <td class="px-6 py-4 text-xs font-semibold text-slate-400">${f.label}</td>
      <td class="px-6 py-4 text-sm font-bold ${c1}">${v1Str}</td>
      <td class="px-6 py-4 text-sm font-bold ${c2}">${v2Str}</td>
    </tr>`;
  }).join('');

  // Winner
  if (p1Score !== p2Score) {
    const winner = p1Score > p2Score ? p1 : p2;
    winnerBadge.textContent = `🏆 ${winner['Insurer']} wins ${Math.max(p1Score, p2Score)}–${Math.min(p1Score, p2Score)}`;
    winnerBadge.classList.remove('hidden');
  } else {
    winnerBadge.textContent = '🤝 It\'s a tie!';
    winnerBadge.classList.remove('hidden');
  }

  resultDiv.classList.remove('hidden');
}

function formatVal(val, format) {
  if (val === '' || val === null || val === undefined || val === 'N/A') return 'N/A';
  const num = parseFloat(val);
  if (format === 'currency' && !isNaN(num)) {
    if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
    return '₹' + num.toLocaleString('en-IN');
  }
  if (format === 'pct' && !isNaN(num)) return num + '%';
  return String(val);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    cmpType = btn.dataset.type;
    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.remove('type-btn-active');
      b.classList.add('bg-slate-800/50', 'text-slate-400', 'border-white/5');
    });
    btn.classList.add('type-btn-active');
    btn.classList.remove('bg-slate-800/50', 'text-slate-400', 'border-white/5');
    loadCompareData();
  });
});

function checkSelections() {
  compareBtn.disabled = !(sel1.value && sel2.value && sel1.value !== sel2.value);
}
sel1.addEventListener('change', checkSelections);
sel2.addEventListener('change', checkSelections);
compareBtn.addEventListener('click', runComparison);

// ─── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadCompareData);
