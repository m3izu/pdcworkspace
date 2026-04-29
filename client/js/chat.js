/**
 * PDC PIT YAWA — Chat Manager
 * Handles text chat UI and Socket.io chat events.
 */

export class ChatManager {
  constructor(socket) {
    this.socket = socket;
    this.panel = document.getElementById('chat-panel');
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl = document.getElementById('input-chat');
    this.badgeEl = document.getElementById('chat-badge');
    this.unreadCount = 0;
    this.isOpen = false;

    this._bindEvents();
  }

  _bindEvents() {
    // Toggle chat
    document.getElementById('btn-toggle-chat').addEventListener('click', () => {
      this.isOpen = !this.isOpen;
      this.panel.classList.toggle('collapsed', !this.isOpen);
      if (this.isOpen) {
        this.unreadCount = 0;
        this.badgeEl.style.display = 'none';
        this.inputEl.focus();
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      }
    });

    // Send message
    const send = () => {
      const text = this.inputEl.value.trim();
      if (!text) return;
      this.socket.emit('chat:message', { text });
      this.inputEl.value = '';
    };

    document.getElementById('btn-send-chat').addEventListener('click', send);
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
      // Prevent game from capturing these keys
      e.stopPropagation();
    });
    // Prevent WASD from moving player while typing
    this.inputEl.addEventListener('keyup', (e) => e.stopPropagation());
    this.inputEl.addEventListener('keypress', (e) => e.stopPropagation());
  }

  addMessage(msg) {
    const div = document.createElement('div');
    div.className = 'chat-msg';

    const time = new Date(msg.timestamp);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
      <span class="chat-msg-sender">${this._escapeHtml(msg.senderName)}</span>
      <span class="chat-msg-text">${this._escapeHtml(msg.text)}</span>
      <span class="chat-msg-time">${timeStr}</span>
    `;

    this.messagesEl.appendChild(div);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

    // Update badge if chat is closed
    if (!this.isOpen) {
      this.unreadCount++;
      this.badgeEl.textContent = this.unreadCount;
      this.badgeEl.style.display = 'inline';
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
