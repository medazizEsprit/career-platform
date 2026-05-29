/**
 * chat.js — SSE streaming chatbot. Sends messages and streams Cohere tokens.
 */

const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const sendBtn      = document.getElementById('send-btn');

let chatHistory = [];
let isStreaming = false;

// ── Auto-resize textarea ──────────────────────────────────────────────────────
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 130) + 'px';
});

// ── Enter to send (Shift+Enter = newline) ────────────────────────────────────
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

// ── Quick chip helper (called from HTML onclick) ──────────────────────────────
window.sendChip = function(text) {
  chatInput.value = text;
  sendMessage();
};

// For backwards compat in case any old code references sendSuggestion
window.sendSuggestion = window.sendChip;

// ── Render a message bubble ───────────────────────────────────────────────────
function appendMessage(role, content = '') {
  // Remove welcome screen on first message
  const intro = document.getElementById('chat-intro');
  if (intro) intro.remove();

  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'user' ? 'U' : 'AI'}</div>
    <div class="msg-bubble">${formatContent(content)}</div>`;
  chatMessages.appendChild(div);
  scrollToBottom();
  return div.querySelector('.msg-bubble');
}

function appendTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message assistant typing-indicator';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div class="msg-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  chatMessages.appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatContent(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/- (.+?)(<br>|$)/g,'• $1$2');
}

// ── Main send function ────────────────────────────────────────────────────────
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || isStreaming) return;

  isStreaming = true;
  sendBtn.disabled = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Render user bubble
  appendMessage('user', message);

  // Typing indicator
  const typingEl = appendTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, history: chatHistory }),
    });

    if (!res.ok) {
      const err = await res.json();
      typingEl.remove();
      appendMessage('assistant', `Error: ${err.detail || 'Something went wrong.'}`);
      return;
    }

    // Remove typing indicator, create response bubble
    typingEl.remove();
    const bubble = appendMessage('assistant', '');
    let fullText = '';

    // Read SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;

        try {
          const parsed = JSON.parse(payload);
          if (parsed.token) {
            fullText += parsed.token;
            bubble.innerHTML = formatContent(fullText);
            scrollToBottom();
          }
          if (parsed.error) {
            bubble.innerHTML = `<span style="color:var(--red)">Error: ${formatContent(parsed.error)}</span>`;
          }
        } catch (_) { /* partial chunk */ }
      }
    }

    // Save to history
    chatHistory.push({ role: 'user',      content: message  });
    chatHistory.push({ role: 'assistant', content: fullText });

    // Keep history bounded to last 20 turns
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  } catch (err) {
    typingEl?.remove();
    appendMessage('assistant', `Error: Network error: ${err.message}`);
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}
