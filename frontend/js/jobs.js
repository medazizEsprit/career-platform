/**
 * jobs.js — Job search, FAISS indexing, RAG retrieval, and job card rendering.
 */

const btnSearch   = document.getElementById('btn-search');
const btnIndex    = document.getElementById('btn-index');
const btnRetrieve = document.getElementById('btn-retrieve');

let allJobs    = [];
let topMatches = [];

// ── Render job cards ──────────────────────────────────────────────────────────
function renderJobCards(jobs, containerId, isMatched = false) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  if (!jobs.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${isMatched ? '🎯' : '🔍'}</div>
        <div class="empty-text">No ${isMatched ? 'matches' : 'jobs'} found</div>
        <div class="empty-hint">${isMatched ? 'Upload your resume in the Career Advisor tab' : 'Adjust your search query'}</div>
      </div>`;
    return;
  }

  grid.innerHTML = jobs.map((job, i) => {
    const score = job.relevance_score ?? job.semantic_score ?? 0;
    const pct   = Math.min(100, Math.round(score * 100));
    const isHigh = score > 0.6;
    const delay  = i * 40;

    return `
    <div class="job-card ${isMatched ? 'matched' : ''}"
         style="animation: fadeSlideIn 0.3s ease ${delay}ms both">
      <div class="job-header">
        <div class="job-title">${escHtml(job.title)}</div>
        ${score ? `<div class="job-score-badge ${isHigh ? 'high' : ''}">${pct}%</div>` : ''}
      </div>
      <div class="job-meta">
        <span class="job-tag">🏢 ${escHtml(job.company)}</span>
        <span class="job-tag">📍 ${escHtml(job.location || 'Remote')}</span>
        <span class="job-tag">🔗 ${escHtml(job.source)}</span>
      </div>
      <div class="job-desc">${escHtml(job.description || '')}</div>
      ${score ? `<div class="score-bar"><div class="score-bar-fill" style="width:${pct}%"></div></div>` : ''}
    </div>`;
  }).join('');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Source log pills ──────────────────────────────────────────────────────────
function renderSourceLogs(logs) {
  const container = document.getElementById('source-logs');
  if (!container || !logs) return;

  const statusWrap = document.getElementById('search-status');
  if (statusWrap) statusWrap.style.display = '';

  container.innerHTML = logs.map(l =>
    `<span class="source-pill ${l.ok ? 'ok' : 'err'}">
      ${l.ok ? '✓' : '✗'} ${l.source}${l.ok ? ` (${l.count})` : ''}
    </span>`
  ).join('');
}

// ── Render matches in advisor sidebar ─────────────────────────────────────────
function renderMatchesSidebar(matches) {
  const matchList = document.getElementById('match-list');
  const matchSection = document.getElementById('matches-section');
  if (!matchList || !matchSection) return;

  if (matches.length > 0) {
    matchSection.style.display = '';
    matchList.innerHTML = matches.map(m => `
      <div class="match-item">
        <div class="match-item-title">${escHtml(m.title)}</div>
        <div class="match-item-company">${escHtml(m.company)} — ${escHtml(m.location || 'Remote')}</div>
      </div>
    `).join('');
  }
}

// ── Job Search ────────────────────────────────────────────────────────────────
btnSearch.addEventListener('click', async () => {
  const query = document.getElementById('search-query').value.trim();
  if (!query) { toast('Please enter a search query.', 'error'); return; }

  setLoading(btnSearch, true);

  try {
    const limitEl = document.getElementById('job-limit');
    const threshEl = document.getElementById('threshold');

    const res = await fetch('/api/search-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        location: document.getElementById('search-location').value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Search failed');

    allJobs = data.jobs;
    renderJobCards(allJobs, 'jobs-grid');

    // Source logs
    if (data.stats && data.stats.logs) {
      renderSourceLogs(data.stats.logs);
    }

    // Update badges
    const jobsBadge = document.getElementById('jobs-badge');
    if (jobsBadge) jobsBadge.textContent = allJobs.length;

    const jobsShown = document.getElementById('jobs-shown');
    if (jobsShown) jobsShown.textContent = `${allJobs.length} results`;

    // Handle auto-matched results
    if (data.matches && data.matches.length > 0) {
      topMatches = data.matches;
      renderJobCards(topMatches, 'matches-grid', true);
      renderMatchesSidebar(topMatches);
      const matchesBadge = document.getElementById('matches-badge');
      if (matchesBadge) matchesBadge.textContent = topMatches.length;
    }

    updateStatus(data.status);
    toast(`Found ${allJobs.length} jobs after semantic filtering.`, 'success');

    // Switch to jobs tab
    const jobsTab = document.querySelector('[data-tab="jobs"]');
    if (jobsTab) jobsTab.click();

  } catch (err) {
    toast(`Search error: ${err.message}`, 'error');
  } finally {
    setLoading(btnSearch, false);
  }
});

// ── Build Index ───────────────────────────────────────────────────────────────
if (btnIndex) {
  btnIndex.addEventListener('click', async () => {
    if (!allJobs.length) { toast('Search for jobs first.', 'error'); return; }
    setLoading(btnIndex, true);

    try {
      const res  = await fetch('/api/index-jobs', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Indexing failed');

      updateStatus(data.status);
      toast(`FAISS index built for ${data.indexed} jobs. ✅`, 'success');
    } catch (err) {
      toast(`Index error: ${err.message}`, 'error');
    } finally {
      setLoading(btnIndex, false);
    }
  });
}

// ── Retrieve Matches ──────────────────────────────────────────────────────────
if (btnRetrieve) {
  btnRetrieve.addEventListener('click', async () => {
    setLoading(btnRetrieve, true);

    try {
      const res  = await fetch('/api/retrieve-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_k: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Retrieval failed');

      topMatches = data.matches;
      renderJobCards(topMatches, 'matches-grid', true);
      renderMatchesSidebar(topMatches);

      const matchesBadge = document.getElementById('matches-badge');
      if (matchesBadge) matchesBadge.textContent = topMatches.length;

      updateStatus(data.status);
      toast(`Top ${topMatches.length} matches found! 🎯 Switch to Chat to get advice.`, 'success');

      // Switch to matches tab
      const matchesTab = document.querySelector('[data-tab="matches"]');
      if (matchesTab) matchesTab.click();

    } catch (err) {
      toast(`Retrieval error: ${err.message}`, 'error');
    } finally {
      setLoading(btnRetrieve, false);
    }
  });
}
