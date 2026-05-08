/**
 * InsureAI – Catalog Page Logic
 * Renders policy cards from data and handles category expand/collapse.
 */

// ─── Policy Catalog Data ─────────────────────────────────────────────────────
const CATALOG = {
  health: [
    { company: 'Star Health', plan: 'Family Optima', premium: '₹12,000', coverage: '₹10 Lakh', score: 8.7, claimRatio: '91%', waitingPeriod: '2 Years', tags: [['Popular','blue'],['Best for Families','emerald']], icon: 'lucide:activity', iconColor: 'blue' },
    { company: 'HDFC ERGO', plan: 'Optima Secure', premium: '₹15,000', coverage: '₹10 Lakh', score: 9.1, claimRatio: '94%', waitingPeriod: '1 Year', tags: [['Best Value','emerald'],['Low Waiting','indigo']], icon: 'lucide:shield-check', iconColor: 'red' },
    { company: 'Niva Bupa', plan: 'ReAssure', premium: '₹14,000', coverage: '₹15 Lakh', score: 8.9, claimRatio: '92%', waitingPeriod: '2 Years', tags: [['High Coverage','purple'],['Family Choice','emerald']], icon: 'lucide:shield', iconColor: 'orange' },
    { company: 'Care Insurance', plan: 'Care Supreme', premium: '₹11,500', coverage: '₹10 Lakh', score: 8.3, claimRatio: '88%', waitingPeriod: '3 Years', tags: [['Budget Friendly','orange'],['Good Benefits','indigo']], icon: 'lucide:heart-pulse', iconColor: 'indigo' },
  ],
  life: [
    { company: 'LIC', plan: 'Jeevan Umang', premium: '₹8,500', coverage: '₹25 Lakh', score: 9.0, claimRatio: '97%', waitingPeriod: 'N/A', tags: [['Most Trusted','emerald'],['Endowment','blue']], icon: 'lucide:heart-handshake', iconColor: 'rose' },
    { company: 'HDFC Life', plan: 'Click 2 Protect', premium: '₹6,200', coverage: '₹1 Crore', score: 8.8, claimRatio: '99%', waitingPeriod: 'N/A', tags: [['Best Value','emerald'],['Term Plan','indigo']], icon: 'lucide:shield-check', iconColor: 'blue' },
    { company: 'ICICI Prudential', plan: 'iProtect Smart', premium: '₹7,000', coverage: '₹1 Crore', score: 8.6, claimRatio: '98%', waitingPeriod: 'N/A', tags: [['Popular','blue'],['Flexible','purple']], icon: 'lucide:shield', iconColor: 'indigo' },
    { company: 'Max Life', plan: 'Smart Term Plan', premium: '₹5,800', coverage: '₹50 Lakh', score: 8.4, claimRatio: '99%', waitingPeriod: 'N/A', tags: [['Affordable','orange'],['High Claim','emerald']], icon: 'lucide:heart-pulse', iconColor: 'emerald' },
  ],
  motor: [
    { company: 'Bajaj Allianz', plan: 'Comprehensive', premium: '₹4,500', coverage: 'IDV Based', score: 8.5, claimRatio: '90%', waitingPeriod: 'N/A', tags: [['Popular','blue'],['Cashless','emerald']], icon: 'lucide:car-front', iconColor: 'blue' },
    { company: 'ICICI Lombard', plan: 'Motor Protect', premium: '₹5,200', coverage: 'IDV Based', score: 8.7, claimRatio: '92%', waitingPeriod: 'N/A', tags: [['Best Service','indigo'],['Add-ons','purple']], icon: 'lucide:car-front', iconColor: 'indigo' },
    { company: 'HDFC ERGO', plan: 'Motor Insurance', premium: '₹4,800', coverage: 'IDV Based', score: 8.6, claimRatio: '91%', waitingPeriod: 'N/A', tags: [['Trusted','emerald'],['Wide Network','blue']], icon: 'lucide:car-front', iconColor: 'red' },
    { company: 'Tata AIG', plan: 'Auto Guard', premium: '₹4,200', coverage: 'IDV Based', score: 8.2, claimRatio: '89%', waitingPeriod: 'N/A', tags: [['Budget','orange'],['Quick Claim','emerald']], icon: 'lucide:car-front', iconColor: 'orange' },
  ],
  travel: [
    { company: 'Bajaj Allianz', plan: 'Travel Guard', premium: '₹800', coverage: '$50,000', score: 8.4, claimRatio: '88%', waitingPeriod: 'N/A', tags: [['Popular','blue'],['Global','purple']], icon: 'lucide:plane', iconColor: 'purple' },
    { company: 'ICICI Lombard', plan: 'Travel Safe', premium: '₹1,200', coverage: '$100,000', score: 8.8, claimRatio: '91%', waitingPeriod: 'N/A', tags: [['Best Value','emerald'],['Premium','indigo']], icon: 'lucide:plane', iconColor: 'blue' },
    { company: 'Tata AIG', plan: 'Travel Edge', premium: '₹950', coverage: '$75,000', score: 8.5, claimRatio: '89%', waitingPeriod: 'N/A', tags: [['Affordable','orange'],['Good Cover','emerald']], icon: 'lucide:plane', iconColor: 'indigo' },
  ],
  home: [
    { company: 'ICICI Lombard', plan: 'Home Protect', premium: '₹2,500', coverage: '₹50 Lakh', score: 8.3, claimRatio: '87%', waitingPeriod: 'N/A', tags: [['Comprehensive','blue'],['Fire+Theft','emerald']], icon: 'lucide:home', iconColor: 'orange' },
    { company: 'Bajaj Allianz', plan: 'Home Shield', premium: '₹2,200', coverage: '₹40 Lakh', score: 8.1, claimRatio: '85%', waitingPeriod: 'N/A', tags: [['Budget','orange'],['Popular','blue']], icon: 'lucide:home', iconColor: 'blue' },
    { company: 'HDFC ERGO', plan: 'Home Insurance', premium: '₹3,000', coverage: '₹75 Lakh', score: 8.6, claimRatio: '90%', waitingPeriod: 'N/A', tags: [['Best Value','emerald'],['High Cover','purple']], icon: 'lucide:home', iconColor: 'indigo' },
  ],
};

// ─── Render a single policy card ─────────────────────────────────────────────
function renderCard(p) {
  const scorePct = Math.round(p.score * 10);
  const tagsHtml = p.tags.map(([label, color]) =>
    `<span class="px-2 py-0.5 bg-${color}-500/10 text-${color}-400 text-[9px] font-bold rounded-full border border-${color}-500/20">${label}</span>`
  ).join('');

  return `
    <div class="policy-card glass-card rounded-2xl p-5 hover:border-indigo-500/30 transition-all duration-300 group">
      <div class="flex justify-between items-start mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-${p.iconColor}-500/10 rounded-xl flex items-center justify-center">
            <iconify-icon icon="${p.icon}" class="text-2xl text-${p.iconColor}-500"></iconify-icon>
          </div>
          <div>
            <p class="text-[10px] font-bold text-slate-500 uppercase">${p.company}</p>
            <h5 class="text-sm font-bold text-white">${p.plan}</h5>
          </div>
        </div>
        <button class="text-slate-500 hover:text-indigo-400 transition-colors"><iconify-icon icon="lucide:bookmark" class="text-lg"></iconify-icon></button>
      </div>
      <div class="grid grid-cols-2 gap-4 mb-5 p-3 bg-slate-800/30 rounded-xl border border-white/5">
        <div><p class="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Premium</p><p class="text-sm font-bold text-indigo-400">${p.premium}</p></div>
        <div><p class="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Coverage</p><p class="text-sm font-bold text-white">${p.coverage}</p></div>
      </div>
      <div class="mb-5">
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[10px] font-bold text-slate-400">AI Trust Score</span>
          <span class="text-[10px] font-bold text-emerald-500">${p.score}/10</span>
        </div>
        <div class="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-emerald-500" style="width:${scorePct}%"></div></div>
      </div>
      <div class="flex flex-wrap gap-2 mb-6">${tagsHtml}</div>
      <div class="grid grid-cols-2 gap-4 pb-5 mb-5 border-b border-white/5">
        <div><p class="text-[9px] text-slate-500">Claim Ratio</p><p class="text-xs font-bold text-slate-300">${p.claimRatio}</p></div>
        <div><p class="text-[9px] text-slate-500">Waiting Period</p><p class="text-xs font-bold text-slate-300">${p.waitingPeriod}</p></div>
      </div>
      <button class="w-full mt-auto py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-indigo-600 transition-all duration-300">View Details</button>
    </div>`;
}

// ─── Populate all category grids ─────────────────────────────────────────────
function populateCatalog() {
  const mapping = {
    'health-cards': CATALOG.health,
    'life-cards': CATALOG.life,
    'motor-cards': CATALOG.motor,
    'travel-cards': CATALOG.travel,
    'home-cards': CATALOG.home,
  };
  for (const [containerId, policies] of Object.entries(mapping)) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = policies.map(renderCard).join('');
  }
}

// ─── Toggle expand/collapse ──────────────────────────────────────────────────
function toggleCategory(id, header) {
  const content = document.getElementById(id);
  const icons = header.querySelectorAll('iconify-icon');
  const chevron = icons[icons.length - 1]; // last icon is the chevron

  if (content.classList.contains('expanded')) {
    content.classList.remove('expanded');
    chevron.style.transform = 'rotate(180deg)';
  } else {
    content.classList.add('expanded');
    chevron.style.transform = 'rotate(0deg)';
  }
}

// Make toggleCategory globally accessible (called from onclick)
window.toggleCategory = toggleCategory;

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', populateCatalog);
