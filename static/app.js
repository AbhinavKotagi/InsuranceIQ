/**
 * InsureAI – Dashboard Frontend Logic (Rewritten)
 * Dynamic CSV/XLSX-driven policy cards, modal, search, filters, AI chat.
 */

const API = '';
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── State ───────────────────────────────────────────────────────────────────
let currentType = 'health';
let allPolicies = [];
let filteredPolicies = [];
let activeFilter = 'none';
let searchQuery = '';

// ─── DOM References ──────────────────────────────────────────────────────────
const policyGrid = $('#policy-cards-grid');
const countLabel = $('#policy-count-label');
const filterBadge = $('#active-filter-badge');
const searchInput = $('#search-input');
const chatContainer = $('#chat-container');
const chatInput = $('#chat-input');
const chatSendBtn = $('#chat-send-btn');
const clearChatBtn = $('#clear-chat-btn');
const modal = $('#policy-modal');
const fileInput = $('#file-input');
const uploadBtn = $('#upload-btn');

// ─── Insurance Type Icons ────────────────────────────────────────────────────
const COMPANY_ICONS = {
  'hdfc ergo': 'lucide:shield-check',
  'star health': 'lucide:star',
  'niva bupa': 'lucide:heart-pulse',
  'care insurance': 'lucide:activity',
  'icici lombard': 'lucide:shield',
  'bajaj allianz': 'lucide:shield-plus',
  'tata aig': 'lucide:umbrella',
  'max bupa': 'lucide:heart',
  'reliance': 'lucide:zap',
  'sbi': 'lucide:landmark',
  'digit': 'lucide:cpu',
  'acko': 'lucide:smartphone',
  'new india': 'lucide:flag',
  'national': 'lucide:building',
  'united india': 'lucide:globe',
  'oriental': 'lucide:compass',
  'default': 'lucide:file-badge'
};

const ICON_COLORS = ['indigo','emerald','blue','purple','rose','amber','cyan','teal','orange','pink'];

function getCompanyIcon(name) {
  const lower = (name || '').toLowerCase();
  for (const [key, icon] of Object.entries(COMPANY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return COMPANY_ICONS.default;
}

function getIconColor(index) {
  return ICON_COLORS[index % ICON_COLORS.length];
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI SCORE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════
function calcAIScore(policy, type) {
  let score = 5;
  if (type === 'health') {
    const csr = parseFloat(policy['CSR %']) || 0;
    const premium = parseFloat(policy['Premium 35yr ₹10L/yr']) || 15000;
    const pedWait = parseFloat(policy['PED Wait (yrs)']) || 3;
    const maxSI = parseFloat(policy['Max SI (₹L)']) || 10;
    score = (csr / 100) * 3.5 + Math.min(maxSI / 200, 1) * 2.5 + Math.max(0, (1 - premium / 40000)) * 2.0 + Math.max(0, (1 - pedWait / 5)) * 2.0;
  } else {
    const csr = parseFloat(policy['Claim Settlement Ratio %']) || 0;
    const premium = parseFloat(policy['Total Premium (₹/yr)']) || 10000;
    const zeroDep = (policy['Zero Dep Add-on'] || '').toString().toLowerCase();
    const rsa = (policy['Roadside Assist'] || '').toString().toLowerCase();
    score = (csr / 100) * 3.5 + Math.max(0, (1 - premium / 30000)) * 2.5 + (zeroDep.includes('yes') || zeroDep.includes('add-on') ? 2.0 : 0) + (rsa.includes('yes') ? 2.0 : 0);
  }
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH & RENDER POLICIES
// ═══════════════════════════════════════════════════════════════════════════════
async function loadPolicies() {
  showSkeletons();
  try {
    const res = await fetch(`${API}/api/insurance-data/${currentType}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    allPolicies = data.policies || [];
    applyFilters();
  } catch (err) {
    console.error('Load error:', err);
    policyGrid.innerHTML = `<div class="col-span-full text-center py-20"><p class="text-slate-500">Failed to load policies. Make sure the server is running.</p></div>`;
  }
}

function showSkeletons() {
  policyGrid.innerHTML = Array(8).fill('<div class="skeleton h-[320px]"></div>').join('');
}

function applyFilters() {
  let policies = [...allPolicies];
  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    policies = policies.filter(p =>
      (p['Insurer'] || '').toLowerCase().includes(q) ||
      (p['Plan Name'] || '').toLowerCase().includes(q)
    );
  }
  // Sort/filter
  if (activeFilter === 'low-premium') {
    const key = currentType === 'health' ? 'Premium 35yr ₹10L/yr' : 'Total Premium (₹/yr)';
    policies.sort((a, b) => (parseFloat(a[key]) || 99999) - (parseFloat(b[key]) || 99999));
  } else if (activeFilter === 'high-coverage') {
    if (currentType === 'health') {
      policies.sort((a, b) => (parseFloat(b['Max SI (₹L)']) || 0) - (parseFloat(a['Max SI (₹L)']) || 0));
    } else {
      policies.sort((a, b) => (parseFloat(b['IDV Typical (₹)']) || 0) - (parseFloat(a['IDV Typical (₹)']) || 0));
    }
  } else if (activeFilter === 'best-claim') {
    const key = currentType === 'health' ? 'CSR %' : 'Claim Settlement Ratio %';
    policies.sort((a, b) => (parseFloat(b[key]) || 0) - (parseFloat(a[key]) || 0));
  } else if (activeFilter === 'low-wait') {
    if (currentType === 'health') {
      policies.sort((a, b) => (parseFloat(a['PED Wait (yrs)']) || 99) - (parseFloat(b['PED Wait (yrs)']) || 99));
    }
  }
  filteredPolicies = policies;
  renderCards(policies);
}

function renderCards(policies) {
  if (!policies.length) {
    policyGrid.innerHTML = '<div class="col-span-full text-center py-20"><iconify-icon icon="lucide:search-x" class="text-4xl text-slate-600 mb-3"></iconify-icon><p class="text-slate-500 text-sm">No policies found.</p></div>';
    countLabel.textContent = '0 Policies';
    return;
  }
  countLabel.textContent = `${policies.length} Policies Found`;
  policyGrid.innerHTML = policies.map((p, i) => buildCard(p, i)).join('');
  // Attach click handlers
  $$('.policy-card').forEach((card, idx) => {
    card.addEventListener('click', () => openModal(policies[idx], idx));
  });
}

function buildCard(p, index) {
  const color = getIconColor(index);
  const icon = getCompanyIcon(p['Insurer']);
  const score = calcAIScore(p, currentType);
  const scorePct = Math.round(score * 10);
  const company = p['Insurer'] || 'Unknown';
  const plan = p['Plan Name'] || 'Insurance Plan';

  let metric1Label, metric1Val, metric2Label, metric2Val, metric3Label, metric3Val, metric4Label, metric4Val;

  if (currentType === 'health') {
    metric1Label = 'Premium (Age 35)';
    metric1Val = formatCurrency(p['Premium 35yr ₹10L/yr']);
    metric2Label = 'Coverage';
    metric2Val = p['Max SI (₹L)'] ? `₹${p['Max SI (₹L)']}L` : 'N/A';
    metric3Label = 'Claim Ratio';
    metric3Val = p['CSR %'] ? `${p['CSR %']}%` : 'N/A';
    metric4Label = 'PED Waiting';
    metric4Val = p['PED Wait (yrs)'] ? `${p['PED Wait (yrs)']} Yrs` : 'N/A';
  } else {
    metric1Label = 'Total Premium';
    metric1Val = formatCurrency(p['Total Premium (₹/yr)']);
    metric2Label = 'IDV (Typical)';
    metric2Val = formatCurrency(p['IDV Typical (₹)']);
    metric3Label = 'Claim Ratio';
    metric3Val = p['Claim Settlement Ratio %'] ? `${p['Claim Settlement Ratio %']}%` : 'N/A';
    metric4Label = 'Zero Depreciation';
    metric4Val = p['Zero Dep Add-on'] || 'N/A';
  }

  return `
    <div class="policy-card glass-card rounded-2xl p-5 cursor-pointer glass-card-hover transition-all duration-300 fade-in flex flex-col">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-11 h-11 bg-${color}-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <iconify-icon icon="${icon}" class="text-xl text-${color}-500"></iconify-icon>
        </div>
        <div class="min-w-0">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">${escapeHtml(company)}</p>
          <h5 class="text-sm font-bold text-white truncate">${escapeHtml(plan)}</h5>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-4 p-3 bg-slate-800/30 rounded-xl border border-white/5">
        <div><p class="text-[9px] text-slate-500 uppercase font-bold tracking-wider">${metric1Label}</p><p class="text-sm font-bold text-indigo-400">${metric1Val}</p></div>
        <div><p class="text-[9px] text-slate-500 uppercase font-bold tracking-wider">${metric2Label}</p><p class="text-sm font-bold text-white">${metric2Val}</p></div>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div><p class="text-[9px] text-slate-500 uppercase font-bold">${metric3Label}</p><p class="text-xs font-bold text-slate-300">${metric3Val}</p></div>
        <div><p class="text-[9px] text-slate-500 uppercase font-bold">${metric4Label}</p><p class="text-xs font-bold text-slate-300">${metric4Val}</p></div>
      </div>
      <div class="mt-auto">
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[10px] font-bold text-slate-400">AI Score</span>
          <span class="text-[10px] font-bold ${score >= 7 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400'}">${score}/10</span>
        </div>
        <div class="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
          <div class="h-full rounded-full ${score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'}" style="width:${scorePct}%"></div>
        </div>
        <button class="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-indigo-600 transition-all duration-300 flex items-center justify-center gap-1.5">
          <iconify-icon icon="lucide:eye"></iconify-icon> View Details
        </button>
      </div>
    </div>`;
}

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return 'N/A';
  if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
  return '₹' + num.toLocaleString('en-IN');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function openModal(policy, index) {
  const color = getIconColor(index);
  const icon = getCompanyIcon(policy['Insurer']);
  const score = calcAIScore(policy, currentType);
  const scorePct = Math.round(score * 10);

  $('#modal-company').textContent = policy['Insurer'] || 'Unknown';
  $('#modal-plan').textContent = policy['Plan Name'] || 'Insurance Plan';
  $('#modal-icon').className = `w-14 h-14 bg-${color}-500/10 rounded-2xl flex items-center justify-center`;
  $('#modal-icon').innerHTML = `<iconify-icon icon="${icon}" class="text-3xl text-${color}-500"></iconify-icon>`;
  $('#modal-type-text').textContent = currentType === 'health' ? 'Health Insurance' : 'Vehicle Insurance';
  $('#modal-score-text').textContent = score;
  $('#modal-score-label').textContent = score >= 8 ? 'Excellent Policy' : score >= 6 ? 'Good Policy' : 'Average Policy';

  // Animate score ring
  const ring = $('#modal-score-ring');
  const circumference = 301.6;
  ring.style.strokeDashoffset = circumference;
  setTimeout(() => { ring.style.strokeDashoffset = circumference - (circumference * scorePct / 100); }, 50);

  // Build features
  const features = getFeatures(policy, currentType);
  const featuresEl = $('#modal-features');
  featuresEl.innerHTML = features.map((f, i) => `
    <div class="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-white/5 fade-in" style="animation-delay:${i * 40}ms">
      <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
        <span class="text-xs font-bold text-indigo-400">${i + 1}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-slate-500 uppercase font-bold">${f.label}</p>
        <p class="text-sm font-semibold text-white truncate">${escapeHtml(String(f.value))}</p>
      </div>
    </div>`).join('');

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  modal._policy = policy;
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function getFeatures(p, type) {
  if (type === 'health') {
    return [
      { label: 'Premium (Age 35)', value: formatCurrency(p['Premium 35yr ₹10L/yr']) },
      { label: 'Max Coverage', value: p['Max SI (₹L)'] ? `₹${p['Max SI (₹L)']} Lakh` : 'N/A' },
      { label: 'Waiting Period (PED)', value: p['PED Wait (yrs)'] ? `${p['PED Wait (yrs)']} Years` : 'N/A' },
      { label: 'Claim Settlement Ratio', value: p['CSR %'] ? `${p['CSR %']}%` : 'N/A' },
      { label: 'Room Rent Limit', value: p['Room Rent Limit'] || 'N/A' },
      { label: 'Co-payment', value: p['Co-pay %'] !== undefined ? `${p['Co-pay %']}%` : 'N/A' },
      { label: 'Pre-existing Disease Wait', value: p['PED Wait (yrs)'] ? `${p['PED Wait (yrs)']} Years` : 'N/A' },
      { label: 'Network Hospitals', value: p['Network Hospitals'] || 'N/A' },
      { label: 'Daycare Procedures', value: p['Daycare Procedures'] || 'N/A' },
      { label: 'Maternity Cover', value: p['Maternity Cover'] || 'N/A' },
    ];
  } else {
    return [
      { label: 'Total Premium', value: formatCurrency(p['Total Premium (₹/yr)']) },
      { label: 'IDV (Typical)', value: formatCurrency(p['IDV Typical (₹)']) },
      { label: 'Claim Settlement Ratio', value: p['Claim Settlement Ratio %'] ? `${p['Claim Settlement Ratio %']}%` : 'N/A' },
      { label: 'Zero Depreciation', value: p['Zero Dep Add-on'] || 'N/A' },
      { label: 'Roadside Assistance', value: p['Roadside Assist'] || 'N/A' },
      { label: 'Engine Protection', value: p['Engine Protect Add-on'] || 'N/A' },
      { label: 'NCB Protection', value: p['NCB Protect Add-on'] || 'N/A' },
      { label: 'Cashless Garages', value: p['Cashless Garages'] || 'N/A' },
      { label: 'Personal Accident Cover', value: p['Personal Accident Cover'] || 'N/A' },
      { label: 'Consumables Cover', value: p['Consumables Cover'] || 'N/A' },
    ];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

// Type selector
$$('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentType = btn.dataset.type;
    $$('.type-btn').forEach(b => {
      b.classList.remove('type-btn-active');
      b.classList.add('bg-slate-800/50', 'text-slate-400', 'border-white/5');
    });
    btn.classList.add('type-btn-active');
    btn.classList.remove('bg-slate-800/50', 'text-slate-400', 'border-white/5');
    activeFilter = 'none';
    searchQuery = '';
    searchInput.value = '';
    updateFilterChips();
    loadPolicies();
  });
});

// Filter chips
$$('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    activeFilter = chip.dataset.filter;
    updateFilterChips();
    applyFilters();
  });
});

function updateFilterChips() {
  $$('.filter-chip').forEach(c => {
    c.classList.remove('filter-active');
    if (c.dataset.filter === activeFilter) c.classList.add('filter-active');
  });
  if (activeFilter !== 'none') {
    filterBadge.textContent = activeFilter.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    filterBadge.classList.remove('hidden');
  } else {
    filterBadge.classList.add('hidden');
  }
}

// Search
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    applyFilters();
  }, 250);
});

// Modal close
$('#modal-close-btn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// Modal actions
$('#modal-compare-btn').addEventListener('click', () => {
  closeModal();
  window.location.href = '/compare-policies';
});
$('#modal-save-btn').addEventListener('click', () => {
  const btn = $('#modal-save-btn');
  btn.innerHTML = '<iconify-icon icon="lucide:check"></iconify-icon> Saved!';
  setTimeout(() => { btn.innerHTML = '<iconify-icon icon="lucide:bookmark"></iconify-icon> Save Policy'; }, 1500);
});
$('#modal-ask-ai-btn').addEventListener('click', () => {
  const policy = modal._policy;
  if (policy) {
    closeModal();
    const msg = `Tell me about the ${policy['Insurer']} ${policy['Plan Name']} policy – pros, cons, and who it's best for.`;
    chatInput.value = msg;
    chatInput.focus();
  }
});

// Upload
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  if (!fileInput.files.length) return;
  const formData = new FormData();
  for (const f of fileInput.files) formData.append('files', f);
  try {
    const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    alert('Policy uploaded & processed successfully!');
  } catch (err) {
    alert('Upload error: ' + err.message);
  } finally {
    fileInput.value = '';
  }
});

// Sidebar CTA
$('#cta-sidebar-ai').addEventListener('click', () => chatInput.focus());

// ═══════════════════════════════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════════════════════════════
function addUserMessage(text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = 'flex flex-col items-end space-y-2 fade-in';
  div.innerHTML = `
    <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-none text-xs leading-relaxed max-w-[85%] shadow-md">${escapeHtml(text)}</div>
    <p class="text-[10px] text-slate-500 flex items-center gap-1">You • ${time}</p>`;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.id = 'typing-indicator';
  div.className = 'flex flex-col items-start space-y-2 fade-in';
  div.innerHTML = `
    <div class="flex items-start gap-2 max-w-[90%]">
      <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <iconify-icon icon="lucide:bot" class="text-indigo-500"></iconify-icon>
      </div>
      <div class="glass-card p-4 rounded-2xl rounded-tl-none shadow-sm">
        <span class="typing-dot"></span> <span class="typing-dot"></span> <span class="typing-dot"></span>
      </div>
    </div>`;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function addAIMessage(text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let html = escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n- /g, '<br>• ')
    .replace(/\n/g, '<br>');
  const div = document.createElement('div');
  div.className = 'flex flex-col items-start space-y-2 fade-in';
  div.innerHTML = `
    <div class="flex items-start gap-2 max-w-[90%]">
      <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <iconify-icon icon="lucide:bot" class="text-indigo-500"></iconify-icon>
      </div>
      <div class="glass-card p-4 rounded-2xl rounded-tl-none text-xs text-slate-300 shadow-sm">${html}</div>
    </div>
    <p class="text-[10px] text-slate-500 pl-10">AI Assistant • ${time}</p>`;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendChat(message) {
  if (!message.trim()) return;
  addUserMessage(message);
  chatInput.value = '';
  addTypingIndicator();
  try {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    removeTypingIndicator();
    if (!res.ok) {
      addAIMessage('⚠️ ' + (data.error || 'Something went wrong.'));
      return;
    }
    addAIMessage(data.answer);
  } catch (err) {
    removeTypingIndicator();
    addAIMessage('⚠️ Network error. Make sure the server is running.');
  }
}

chatSendBtn.addEventListener('click', () => sendChat(chatInput.value));
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput.value); }
});
$$('.quick-prompt').forEach(btn => {
  btn.addEventListener('click', () => sendChat(btn.dataset.prompt));
});
clearChatBtn.addEventListener('click', async () => {
  await fetch(`${API}/api/chat/clear`, { method: 'DELETE' });
  chatContainer.innerHTML = '';
  const welcome = document.createElement('div');
  welcome.className = 'flex flex-col items-start space-y-2 fade-in';
  welcome.innerHTML = `
    <div class="flex items-start gap-2 max-w-[90%]">
      <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <iconify-icon icon="lucide:bot" class="text-indigo-500"></iconify-icon>
      </div>
      <div class="glass-card p-4 rounded-2xl rounded-tl-none text-xs text-slate-300 shadow-sm">
        <p class="font-semibold text-white mb-2">Welcome! I'm your AI Insurance Advisor.</p>
        <p>Upload your insurance policy PDFs and I'll help you compare them, find hidden clauses, and pick the best one for your needs.</p>
      </div>
    </div>`;
  chatContainer.appendChild(welcome);
});

// ═══════════════════════════════════════════════════════════════════════════════
// UTIL
// ═══════════════════════════════════════════════════════════════════════════════
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  updateFilterChips();
  loadPolicies();
});
