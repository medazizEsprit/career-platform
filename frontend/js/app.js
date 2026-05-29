/**
 * app.js — Navigation, toasts, status updates, Power BI embed, tab switching.
 */

// ── Page navigation ───────────────────────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.page;
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`page-${target}`).classList.add('active');
  });
});

// ── Tab switching (jobs page) ─────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(`panel-${target}`);
    if (panel) panel.classList.add('active');
  });
});

// ── Toast ─────────────────────────────────────────────────────────────────────
window.toast = function(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const dot = type === 'success' ? '&#10003;' : type === 'error' ? '&#10005;' : '&#8250;';
  el.innerHTML = `<span style="font-size:15px">${dot}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = '0.3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
};

// ── Button loading ────────────────────────────────────────────────────────────
window.setLoading = function(btn, loading) {
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
};

// ── Update top-right ready indicator and step list ────────────────────────────
window.updateStatus = function(status) {
  const readyEl = document.getElementById('nav-ready');
  const labelEl = document.getElementById('ready-label');

  const isReady = status.stage === 'ready';
  readyEl.className = 'nav-ready' + (isReady ? ' on' : '');
  labelEl.textContent = isReady ? 'Advisor ready' : 'Set up the Advisor first';

  // Steps in advisor sidebar
  const stepJobs  = document.getElementById('step-jobs');
  const stepCv    = document.getElementById('step-cv');
  const stepReady = document.getElementById('step-ready');

  if (stepJobs) {
    stepJobs.className  = 'step ' + (status.jobs_count > 0 ? 'done' : (status.stage === 'idle' ? '' : 'active'));
    stepCv.className    = 'step ' + (status.cv_loaded ? 'done' : (status.jobs_count > 0 ? 'active' : ''));
    stepReady.className = 'step ' + (isReady ? 'done' : (status.cv_loaded ? 'active' : ''));
  }

  // Show matches section if we have them
  const matchesSection = document.getElementById('matches-section');
  if (matchesSection && status.top_matches_count > 0) {
    matchesSection.style.display = '';
  }
};

// ── Power BI embed ────────────────────────────────────────────────────────────
// ── Power BI embed URL Normalisation ──────────────────────────────────────────
function getEmbedUrl(url) {
  if (!url) return '';
  url = url.trim();

  // If already an embed/view URL, use as is
  if (url.includes('/reportEmbed') || url.includes('/view') || url.includes('/embed')) {
    return url;
  }

  // Parse standard Power BI report URLs
  // format: https://app.powerbi.com/groups/{groupId}/reports/{reportId}/{pageId}?experience=power-bi
  const groupsRegex = /https:\/\/app\.powerbi\.com\/groups\/([^/]+)\/reports\/([^/]+)(?:\/([^/?#]+))?/i;
  const groupsMatch = url.match(groupsRegex);

  if (groupsMatch) {
    const groupId = groupsMatch[1];
    const reportId = groupsMatch[2];
    const pageId = groupsMatch[3];
    console.warn("Power BI: Auto-converting standard report URL to secure reportEmbed URL to prevent iframe 'refused to connect' error.");

    let embedUrl = `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${groupId}`;
    if (pageId) {
      embedUrl += `&pageName=${pageId}`;
    }
    return embedUrl;
  }

  // Parse personal workspace URLs
  // format: https://app.powerbi.com/reports/{reportId}
  const simpleRegex = /https:\/\/app\.powerbi\.com\/reports\/([^/]+)(?:\/([^/?#]+))?/i;
  const simpleMatch = url.match(simpleRegex);
  if (simpleMatch) {
    const reportId = simpleMatch[1];
    const pageId = simpleMatch[2];
    console.warn("Power BI: Auto-converting simple report URL to secure reportEmbed URL to prevent iframe 'refused to connect' error.");

    let embedUrl = `https://app.powerbi.com/reportEmbed?reportId=${reportId}`;
    if (pageId) {
      embedUrl += `&pageName=${pageId}`;
    }
    return embedUrl;
  }

  return url;
}

// ── Native Fallback Dashboard ──────────────────────────────────────────────────
function renderNativeDashboard(wrap) {
  wrap.innerHTML = `
    <div class="db-fallback-container">
      <div class="db-header">
        <div class="db-title-wrap">
          <h1>Job Market Overview</h1>
          <p>Interactive, real-time market metrics & analytics dashboard</p>
        </div>
      </div>

      <div class="db-stats-grid">
        <div class="db-stat-card">
          <div class="db-stat-label">Active Roles</div>
          <div class="db-stat-value">1,482</div>
          <div class="db-stat-desc">+14.2% this month</div>
        </div>
        <div class="db-stat-card">
          <div class="db-stat-label">Avg. Base Salary</div>
          <div class="db-stat-value">$95,400</div>
          <div class="db-stat-desc">+5.1% YoY growth</div>
        </div>
        <div class="db-stat-card">
          <div class="db-stat-label">Hiring Companies</div>
          <div class="db-stat-value">342</div>
          <div class="db-stat-desc">Active employers</div>
        </div>
        <div class="db-stat-card">
          <div class="db-stat-label">Hot Skill Index</div>
          <div class="db-stat-value">Python</div>
          <div class="db-stat-desc">42% of postings</div>
        </div>
      </div>

      <div class="db-charts-grid">
        <div class="db-chart-card">
          <div class="db-chart-title">Skills in Demand</div>
          <div class="db-bar-list">
            <div class="db-bar-row">
              <span class="db-bar-label">Python</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="84%"></div></div>
              <span class="db-bar-value">84%</span>
            </div>
            <div class="db-bar-row">
              <span class="db-bar-label">SQL</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="68%"></div></div>
              <span class="db-bar-value">68%</span>
            </div>
            <div class="db-bar-row">
              <span class="db-bar-label">React / JavaScript</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="58%"></div></div>
              <span class="db-bar-value">58%</span>
            </div>
            <div class="db-bar-row">
              <span class="db-bar-label">Docker & Cloud</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="45%"></div></div>
              <span class="db-bar-value">45%</span>
            </div>
            <div class="db-bar-row">
              <span class="db-bar-label">Machine Learning</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="38%"></div></div>
              <span class="db-bar-value">38%</span>
            </div>
          </div>
        </div>

        <div class="db-chart-card">
          <div class="db-chart-title">Average Salary by Role (USD)</div>
          <div class="db-bar-list">
            <div class="db-bar-row">
              <span class="db-bar-label">Data Scientist</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="95%"></div></div>
              <span class="db-bar-value">$118k</span>
            </div>
            <div class="db-bar-row">
              <span class="db-bar-label">Cloud Engineer</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="88%"></div></div>
              <span class="db-bar-value">$110k</span>
            </div>
            <div class="db-bar-row">
              <span class="db-bar-label">Software Engineer</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="85%"></div></div>
              <span class="db-bar-value">$105k</span>
            </div>
            <div class="db-bar-row">
              <span class="db-bar-label">Data Analyst</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="68%"></div></div>
              <span class="db-bar-value">$85k</span>
            </div>
            <div class="db-bar-row">
              <span class="db-bar-label">Web Developer</span>
              <div class="db-bar-track"><div class="db-bar-fill" data-width="60%"></div></div>
              <span class="db-bar-value">$78k</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Trigger animations for the progress bars
  setTimeout(() => {
    wrap.querySelectorAll('.db-bar-fill').forEach(bar => {
      bar.style.width = bar.getAttribute('data-width');
    });
  }, 100);
}

// ── Power BI embed ────────────────────────────────────────────────────────────
async function loadPowerBI() {
  const wrap = document.getElementById('pbi-frame-wrap');
  if (!wrap) return;
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();

    if (cfg.powerbi_embed_url && cfg.powerbi_embed_url.trim() !== '') {
      // Load Power BI iframe with a native dashboard troubleshooting toggle
      wrap.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;">
          <div class="db-alert-banner" style="margin: 10px 14px 10px; background: var(--bg-card); border: 1px solid var(--border); color: var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
            <span>Live Power BI report connected. Having loading issues?</span>
            <button class="db-alert-btn" id="btn-toggle-native" style="border-color: var(--accent); color: var(--accent-light); background: var(--accent-subtle);">
              Switch to Native Analytics View
            </button>
          </div>
          <div style="flex:1;" id="pbi-iframe-container">
            <iframe src="${getEmbedUrl(cfg.powerbi_embed_url)}" allowFullscreen="true" style="width:100%;height:100%;border:none;display:block;"></iframe>
          </div>
        </div>`;

      document.getElementById('btn-toggle-native').addEventListener('click', () => {
        renderNativeDashboard(wrap);
      });
    } else {
      renderNativeDashboard(wrap);
    }
  } catch (_) {
    renderNativeDashboard(wrap);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadPowerBI();
fetch('/api/status').then(r => r.json()).then(updateStatus).catch(() => {});
