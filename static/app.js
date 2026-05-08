/**
 * InsureAI – Dashboard Frontend Logic
 * Connects the HTML UI to the Flask REST API endpoints.
 */

const API = '';  // Same origin

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const fileInput        = $('#file-input');
const uploadBtn        = $('#upload-btn');
const uploadDropZone   = $('#upload-drop-zone');
const policyCardsGrid  = $('#policy-cards-grid');
const policyCountLabel = $('#policy-count-label');
const comparisonSection = $('#comparison-section');
const compareBtn       = $('#compare-btn');
const exportBtn        = $('#export-btn');
const comparisonLoading = $('#comparison-loading');
const comparisonTableWrap = $('#comparison-table-wrap');
const comparisonThead  = $('#comparison-thead');
const comparisonTbody  = $('#comparison-tbody');
const aiRecBar         = $('#ai-recommendation-bar');
const recText          = $('#rec-text');
const analyticsSection = $('#analytics-section');
const bestValueName    = $('#best-value-name');
const bestValueSub     = $('#best-value-sub');
const clauseCount      = $('#clause-count');
const chatContainer    = $('#chat-container');
const chatInput        = $('#chat-input');
const chatSendBtn      = $('#chat-send-btn');
const clearChatBtn     = $('#clear-chat-btn');
const themeToggle      = $('#theme-toggle');

// Policy icon colors for visual variety
const POLICY_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/30', icon: 'text-blue-600', iconName: 'lucide:activity' },
  { bg: 'bg-red-50 dark:bg-red-900/30',   icon: 'text-red-600',  iconName: 'lucide:shield' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: 'text-emerald-600', iconName: 'lucide:heart-pulse' },
  { bg: 'bg-amber-50 dark:bg-amber-900/30', icon: 'text-amber-600', iconName: 'lucide:umbrella' },
  { bg: 'bg-purple-50 dark:bg-purple-900/30', icon: 'text-purple-600', iconName: 'lucide:shield-plus' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// THEME TOGGLE
// ═══════════════════════════════════════════════════════════════════════════════
themeToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
});

// ═══════════════════════════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════════════════════════
document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href && href !== '#' && !href.startsWith('#')) {
      return; // Let the browser navigate
    }
    e.preventDefault();
    document.querySelectorAll('nav a').forEach(l => {
      l.classList.remove('active-nav');
      l.classList.add('text-slate-600', 'dark:text-slate-400');
    });
    link.classList.add('active-nav');
    link.classList.remove('text-slate-600', 'dark:text-slate-400');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════
uploadBtn.addEventListener('click', () => fileInput.click());
uploadDropZone.addEventListener('click', () => fileInput.click());

// Drag & drop support
uploadDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadDropZone.classList.add('border-indigo-400', 'bg-indigo-50', 'dark:bg-indigo-900/20');
});
uploadDropZone.addEventListener('dragleave', () => {
  uploadDropZone.classList.remove('border-indigo-400', 'bg-indigo-50', 'dark:bg-indigo-900/20');
});
uploadDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadDropZone.classList.remove('border-indigo-400', 'bg-indigo-50', 'dark:bg-indigo-900/20');
  if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleUpload(fileInput.files);
});

async function handleUpload(files) {
  const formData = new FormData();
  for (const f of files) formData.append('files', f);

  // Show uploading state on the drop zone
  const origHTML = uploadDropZone.innerHTML;
  uploadDropZone.innerHTML = `
    <div class="flex items-center gap-3 text-sm text-slate-500">
      <svg class="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      Uploading & processing…
    </div>`;

  try {
    const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    await refreshPolicies();
  } catch (err) {
    alert('Upload error: ' + err.message);
  } finally {
    uploadDropZone.innerHTML = origHTML;
    fileInput.value = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY CARDS
// ═══════════════════════════════════════════════════════════════════════════════
async function refreshPolicies() {
  try {
    const res = await fetch(`${API}/api/policies`);
    const data = await res.json();
    renderPolicyCards(data.policies);
  } catch (err) {
    console.error('Failed to fetch policies:', err);
  }
}

function renderPolicyCards(policies) {
  // Remove all cards except the upload drop zone
  policyCardsGrid.querySelectorAll('.policy-card').forEach(el => el.remove());
  policyCountLabel.textContent = `Your Uploaded Policies (${policies.length})`;

  policies.forEach((p, i) => {
    const color = POLICY_COLORS[i % POLICY_COLORS.length];
    const card = document.createElement('div');
    card.className = 'policy-card bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group relative fade-in';
    card.innerHTML = `
      <button class="delete-policy-btn absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors" data-filename="${p.filename}">
        <iconify-icon icon="lucide:trash-2"></iconify-icon>
      </button>
      <div class="flex items-center gap-3 mb-6">
        <div class="w-12 h-12 ${color.bg} rounded-xl flex items-center justify-center">
          <iconify-icon icon="${color.iconName}" class="text-2xl ${color.icon}"></iconify-icon>
        </div>
        <div>
          <p class="text-sm font-bold text-slate-900 dark:text-white">${p.name}</p>
          <p class="text-xs text-slate-500">${p.chunks} chunks indexed</p>
        </div>
      </div>
      <div class="flex items-center">
        <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-lg">✅ Processed</span>
      </div>`;
    // Insert before the upload drop zone
    policyCardsGrid.insertBefore(card, uploadDropZone);
  });

  // Attach delete handlers
  document.querySelectorAll('.delete-policy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fn = btn.dataset.filename;
      if (!confirm(`Delete policy "${fn}"?`)) return;
      await fetch(`${API}/api/policies/${encodeURIComponent(fn)}`, { method: 'DELETE' });
      await refreshPolicies();
    });
  });

  // Toggle comparison section visibility
  if (policies.length >= 2) {
    comparisonSection.classList.remove('hidden');
  } else {
    comparisonSection.classList.add('hidden');
    analyticsSection.classList.add('hidden');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARE POLICIES
// ═══════════════════════════════════════════════════════════════════════════════
compareBtn.addEventListener('click', async () => {
  comparisonLoading.classList.remove('hidden');
  comparisonTableWrap.classList.add('hidden');
  aiRecBar.classList.add('hidden');
  compareBtn.disabled = true;
  compareBtn.innerHTML = '<svg class="animate-spin h-4 w-4 text-white inline mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Analyzing…';

  try {
    const res = await fetch(`${API}/api/compare`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Comparison failed');
    renderComparison(data);
  } catch (err) {
    alert('Comparison error: ' + err.message);
  } finally {
    comparisonLoading.classList.add('hidden');
    compareBtn.disabled = false;
    compareBtn.innerHTML = '<iconify-icon icon="lucide:sparkles"></iconify-icon> Run AI Comparison';
  }
});

function renderComparison(data) {
  const tableMd = data.table || '';
  if (!tableMd) {
    // Show summary as fallback
    if (data.summary) {
      comparisonTbody.innerHTML = `<tr><td class="px-6 py-4 text-xs text-slate-600 dark:text-slate-300" colspan="10">${data.summary}</td></tr>`;
      comparisonTableWrap.classList.remove('hidden');
    }
    return;
  }

  // Parse markdown table
  const lines = tableMd.split('\n').map(l => l.trim()).filter(Boolean);
  const dataLines = lines.filter(l => !l.replace(/[|\-\s]/g, '').match(/^$/));
  if (dataLines.length < 2) return;

  const headers = dataLines[0].split('|').map(c => c.trim()).filter(Boolean);
  const rows = dataLines.slice(1)
    .filter(l => !l.match(/^[\|\-\s]+$/))
    .map(l => l.split('|').map(c => c.trim()).filter(Boolean));

  // Build thead
  comparisonThead.innerHTML = `<tr class="bg-slate-50 dark:bg-slate-800/50">
    ${headers.map((h, i) => {
      if (i === 0) return `<th class="px-6 py-4 text-[10px] text-slate-400 uppercase font-bold tracking-widest">${h}</th>`;
      return `<th class="px-6 py-4"><div class="text-xs font-bold text-indigo-600">${h}</div></th>`;
    }).join('')}
  </tr>`;

  // Build tbody
  comparisonTbody.innerHTML = rows.map(cells =>
    `<tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      ${cells.map((c, i) => {
        if (i === 0) return `<td class="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">${c}</td>`;
        const isGood = c.toLowerCase().includes('covered') || c.toLowerCase().includes('no limit') || c.toLowerCase().includes('yes');
        const isBad = c.toLowerCase().includes('not covered') || c.toLowerCase().includes('not specified');
        const color = isBad ? 'text-red-500' : isGood ? 'text-emerald-500' : 'text-slate-900 dark:text-white';
        return `<td class="px-6 py-4 text-xs font-medium ${color}">${c}</td>`;
      }).join('')}
    </tr>`
  ).join('');

  comparisonTableWrap.classList.remove('hidden');
  exportBtn.classList.remove('hidden');

  // Winner / recommendation bar
  if (data.winner) {
    recText.innerHTML = `Based on AI analysis, <span class="font-bold">${data.winner}</span> is the better choice. ${data.winner_reason || ''}`;
    aiRecBar.classList.remove('hidden');
    bestValueName.textContent = data.winner;
    bestValueSub.textContent = data.winner_reason ? data.winner_reason.substring(0, 60) + '…' : 'Best overall';
  }

  // Show analytics section
  analyticsSection.classList.remove('hidden');

  // Trigger hidden clauses detection in background
  detectHiddenClauses();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIDDEN CLAUSES
// ═══════════════════════════════════════════════════════════════════════════════
async function detectHiddenClauses() {
  try {
    const res = await fetch(`${API}/api/hidden-clauses`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return;
    let total = 0;
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) total += data[key].length;
    }
    clauseCount.textContent = total;
  } catch (err) {
    console.error('Hidden clause detection failed:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT REPORT
// ═══════════════════════════════════════════════════════════════════════════════
exportBtn.addEventListener('click', () => {
  window.open(`${API}/api/report/download`, '_blank');
});

// ═══════════════════════════════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════════════════════════════
function addUserMessage(text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = 'flex flex-col items-end space-y-2 fade-in';
  div.innerHTML = `
    <div class="gradient-purple text-white px-4 py-2.5 rounded-2xl rounded-tr-none text-xs leading-relaxed max-w-[85%] shadow-md">${escapeHtml(text)}</div>
    <p class="text-[10px] text-slate-400 flex items-center gap-1">You • ${time}</p>`;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.id = 'typing-indicator';
  div.className = 'flex flex-col items-start space-y-2 fade-in';
  div.innerHTML = `
    <div class="flex items-start gap-2 max-w-[90%]">
      <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-indigo-700 flex items-center justify-center flex-shrink-0">
        <iconify-icon icon="lucide:bot" class="text-indigo-600"></iconify-icon>
      </div>
      <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl rounded-tl-none shadow-sm">
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
  // Convert basic markdown to HTML
  let html = escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n- /g, '<br>• ')
    .replace(/\n/g, '<br>');

  const div = document.createElement('div');
  div.className = 'flex flex-col items-start space-y-2 fade-in';
  div.innerHTML = `
    <div class="flex items-start gap-2 max-w-[90%]">
      <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-indigo-700 flex items-center justify-center flex-shrink-0">
        <iconify-icon icon="lucide:bot" class="text-indigo-600"></iconify-icon>
      </div>
      <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl rounded-tl-none text-xs text-slate-700 dark:text-slate-300 shadow-sm">${html}</div>
    </div>
    <div class="pl-10 flex items-center justify-between w-full pr-4">
      <p class="text-[10px] text-slate-400">AI Assistant • ${time}</p>
      <div class="flex gap-2">
        <button class="text-slate-300 hover:text-slate-500 transition-colors"><iconify-icon icon="lucide:thumbs-up" class="text-xs"></iconify-icon></button>
        <button class="text-slate-300 hover:text-slate-500 transition-colors"><iconify-icon icon="lucide:thumbs-down" class="text-xs"></iconify-icon></button>
      </div>
    </div>`;
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
      addAIMessage('⚠️ ' + (data.error || 'Something went wrong. Please try again.'));
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

// Quick prompts
document.querySelectorAll('.quick-prompt').forEach(btn => {
  btn.addEventListener('click', () => sendChat(btn.dataset.prompt));
});

// Clear chat
clearChatBtn.addEventListener('click', async () => {
  await fetch(`${API}/api/chat/clear`, { method: 'DELETE' });
  chatContainer.innerHTML = '';
  // Re-add welcome message
  const welcome = document.createElement('div');
  welcome.className = 'flex flex-col items-start space-y-2 fade-in';
  welcome.innerHTML = `
    <div class="flex items-start gap-2 max-w-[90%]">
      <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-indigo-700 flex items-center justify-center flex-shrink-0">
        <iconify-icon icon="lucide:bot" class="text-indigo-600"></iconify-icon>
      </div>
      <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl rounded-tl-none text-xs text-slate-700 dark:text-slate-300 shadow-sm">
        <p class="font-semibold text-slate-900 dark:text-white mb-2">Welcome! I'm your AI Insurance Advisor.</p>
        <p>Upload your insurance policy PDFs and I'll help you compare them, find hidden clauses, and pick the best one for your needs.</p>
      </div>
    </div>`;
  chatContainer.appendChild(welcome);
});

// Sidebar CTA -> focus chat
$('#cta-sidebar-ai').addEventListener('click', () => chatInput.focus());

// ═══════════════════════════════════════════════════════════════════════════════
// UTIL
// ═══════════════════════════════════════════════════════════════════════════════
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT — Load existing policies on page load
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => refreshPolicies());
