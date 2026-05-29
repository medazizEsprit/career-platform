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

// ── Power BI embed ────────────────────────────────────────────────────────────
async function loadPowerBI() {
  const wrap = document.getElementById('pbi-frame-wrap');
  if (!wrap) return;
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();

    if (cfg.powerbi_embed_url && cfg.powerbi_embed_url.trim() !== '') {
      const iframe = document.createElement('iframe');
      iframe.src = getEmbedUrl(cfg.powerbi_embed_url);
      iframe.allowFullscreen = true;
      iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
      wrap.appendChild(iframe);
    } else {
      wrap.innerHTML = `
        <div class="pbi-placeholder">
          <div class="pbi-icon">&#9646;&#9646;</div>
          <h2>Job Market Dashboard</h2>
          <p>
            This page will display your Power BI report once you publish it and add the embed link.<br><br>
            To set it up: open Power BI Desktop with <strong>TBD_Jobs.pbix</strong>, publish the report to
            Power BI Service, then copy the embed URL into your <code>.env</code> file as
            <code>POWERBI_EMBED_URL</code> and restart the server.
          </p>
          <p style="margin-top:16px;">
            In the meantime, use <strong>Find Jobs</strong> to browse open positions
            and <strong>Career Advisor</strong> to get personalised guidance.
          </p>
        </div>`;
    }
  } catch (_) {}
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadPowerBI();
fetch('/api/status').then(r => r.json()).then(updateStatus).catch(() => {});
