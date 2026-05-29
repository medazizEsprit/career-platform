/**
 * upload.js — CV drag-and-drop upload handler.
 */

const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('cv-file');
const cvPreview = document.getElementById('cv-preview');
const cvBadge   = document.getElementById('cv-badge');

// Drag-and-drop visual feedback
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) uploadCV(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) uploadCV(fileInput.files[0]);
});

async function uploadCV(file) {
  const allowed = ['application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx)$/i)) {
    toast('Only PDF and DOCX files are supported.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  // Optimistic UI
  const dropIcon = dropZone.querySelector('.drop-icon');
  if (dropIcon) dropIcon.textContent = '⏳';

  try {
    const res  = await fetch('/api/upload-cv', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || 'Upload failed');

    // Show badge & preview
    document.getElementById('cv-filename').textContent = data.filename;
    const cvChars = document.getElementById('cv-chars');
    if (cvChars) cvChars.textContent = `(${data.char_count.toLocaleString()} chars)`;
    cvBadge.classList.add('visible');

    if (cvPreview) {
      cvPreview.style.display = 'block';
      cvPreview.textContent = data.preview + (data.char_count > 500 ? '…' : '');
    }

    if (dropIcon) dropIcon.textContent = '✅';
    toast(`CV uploaded: ${data.filename}`, 'success');
    updateStatus(data.status);

    // Auto-retrieve if jobs are already indexed
    if (data.status && data.status.index_built && data.status.jobs_count > 0) {
      try {
        const retRes = await fetch('/api/retrieve-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ top_k: 5 }),
        });
        const retData = await retRes.json();
        if (retRes.ok && retData.matches) {
          // Render matches in advisor sidebar
          const matchList = document.getElementById('match-list');
          const matchSection = document.getElementById('matches-section');
          if (matchList && matchSection) {
            matchSection.style.display = '';
            matchList.innerHTML = retData.matches.map(m => `
              <div class="match-item">
                <div class="match-item-title">${escHtml(m.title)}</div>
                <div class="match-item-company">${escHtml(m.company)} — ${escHtml(m.location || 'Remote')}</div>
              </div>
            `).join('');
          }
          // Update matches tab badge
          const matchesBadge = document.getElementById('matches-badge');
          if (matchesBadge) matchesBadge.textContent = retData.matches.length;

          updateStatus(retData.status);
          toast(`Top ${retData.matches.length} matches found! 🎯`, 'success');
        }
      } catch (_) {}
    }

  } catch (err) {
    if (dropIcon) dropIcon.textContent = '📂';
    toast(`Upload error: ${err.message}`, 'error');
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
