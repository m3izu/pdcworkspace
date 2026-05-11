/**
 * SnappyWorld — Proximity Manager
 * Handles WebRTC video/audio calls based on avatar distance.
 */

const PROXIMITY_THRESHOLD = 150; // pixels
const MAX_DISTANCE = 250;        // for volume scaling
const CHECK_INTERVAL = 200;      // ms between proximity checks
const MAX_ACTIVE_CALLS = 5;      // maximum simultaneous WebRTC connections

export class ProximityManager {
  constructor(socket) {
    this.socket = socket;
    this.peer = null;
    this.localStream = null;
    this.activeCalls = new Map();  // socketId -> { call, videoEl }
    this.peerIdMap = new Map();    // socketId -> peerId
    this.callTeardownTimers = new Map(); // socketId -> timeoutId
    this.checkTimer = null;
    this.videoPanel = document.getElementById('video-panel');
  }

  async init(existingPlayers) {
    // Get local media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 15 },
        audio: true
      });
    } catch (err) {
      console.warn('[Proximity] Camera/mic not available:', err.message);
      // Continue without media — user can still use text chat
      this.localStream = null;
    }

    // Create PeerJS peer
    const peerOptions = {
      host: window.location.hostname,
      port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs',
      secure: window.location.protocol === 'https:',
      debug: 0
    };

    this.peer = new Peer(undefined, peerOptions);

    this.peer.on('open', (peerId) => {
      console.log('[Proximity] PeerJS connected, id:', peerId);
      this.socket.emit('register-peer', { peerId });
    });

    this.peer.on('call', (call) => {
      // Answer incoming calls
      if (this.localStream) {
        call.answer(this.localStream);
      } else {
        call.answer(); // answer without stream
      }
      this._handleCallStream(call);
    });

    this.peer.on('error', (err) => {
      console.warn('[Proximity] PeerJS error:', err.type, err.message);
    });

    // Register existing peers
    for (const p of existingPlayers) {
      if (p.peerId) {
        this.peerIdMap.set(p.id, p.peerId);
      }
    }

    // Start proximity checking
    this.checkTimer = setInterval(() => this._checkProximity(), CHECK_INTERVAL);
  }

  registerPeer(socketId, peerId) {
    this.peerIdMap.set(socketId, peerId);
  }

  _checkProximity() {
    const scene = window.__gameScene;
    if (!scene) return;

    const myPos = scene.getMyPosition();
    if (!myPos) return;

    const remotePositions = scene.getRemotePositions();
    const distances = [];

    // Calculate all distances
    for (const [socketId, pos] of Object.entries(remotePositions)) {
      const dist = Phaser.Math.Distance.Between(myPos.x, myPos.y, pos.x, pos.y);
      distances.push({ socketId, dist });
    }

    // Sort by closest first
    distances.sort((a, b) => a.dist - b.dist);

    const allowedCalls = new Set();
    let callsCount = 0;

    // Pick top N closest players within threshold
    for (const { socketId, dist } of distances) {
      if (dist < PROXIMITY_THRESHOLD && callsCount < MAX_ACTIVE_CALLS) {
        allowedCalls.add(socketId);
        callsCount++;
      }
    }

    // Process calls
    for (const { socketId, dist } of distances) {
      if (allowedCalls.has(socketId)) {
        // Clear teardown timer if they came back into range
        if (this.callTeardownTimers.has(socketId)) {
          clearTimeout(this.callTeardownTimers.get(socketId));
          this.callTeardownTimers.delete(socketId);
        }

        // Should be in call
        if (!this.activeCalls.has(socketId)) {
          this._startCall(socketId);
        }
        // Adjust volume
        this._setVolume(socketId, dist);
      } else {
        // Should not be in call (too far or too many people)
        if (this.activeCalls.has(socketId) && !this.callTeardownTimers.has(socketId)) {
          // Instantly mute them to give illusion they are gone
          this._setVolume(socketId, MAX_DISTANCE);
          
          // Schedule actual teardown for 3 seconds later
          const timer = setTimeout(() => {
            this._endCall(socketId);
            this.callTeardownTimers.delete(socketId);
          }, 3000);
          this.callTeardownTimers.set(socketId, timer);
        }
      }
    }

    // Clean up calls for players who left
    for (const socketId of this.activeCalls.keys()) {
      if (!remotePositions[socketId]) {
        this._endCall(socketId);
      }
    }
    
    this._updateBroadcastUI();
  }

  _startCall(socketId) {
    const peerId = this.peerIdMap.get(socketId);
    if (!peerId || !this.peer || !this.localStream) return;
    if (this.activeCalls.has(socketId)) return;

    console.log('[Proximity] Starting call with', socketId);
    const call = this.peer.call(peerId, this.localStream);
    if (!call) return;

    this._handleCallStream(call, socketId);
  }

  _handleCallStream(call, socketId) {
    // Try to figure out socketId from peerId if not provided
    if (!socketId) {
      for (const [sid, pid] of this.peerIdMap) {
        if (pid === call.peer) { socketId = sid; break; }
      }
    }
    if (!socketId) return;

    call.on('stream', (remoteStream) => {
      // Don't duplicate
      if (this.activeCalls.has(socketId)) {
        const existing = this.activeCalls.get(socketId);
        if (existing.videoEl) return;
      }

      const videoEl = this._createVideoTile(socketId, remoteStream);
      this.activeCalls.set(socketId, { call, videoEl });
    });

    call.on('close', () => {
      this._removeVideoTile(socketId);
      this.activeCalls.delete(socketId);
    });

    call.on('error', (err) => {
      console.warn('[Proximity] Call error:', err);
      this._removeVideoTile(socketId);
      this.activeCalls.delete(socketId);
    });

    // Store call even before stream arrives
    if (!this.activeCalls.has(socketId)) {
      this.activeCalls.set(socketId, { call, videoEl: null });
      this._updateBroadcastUI();
    }
  }

  _endCall(socketId) {
    const entry = this.activeCalls.get(socketId);
    if (entry) {
      if (entry.call) entry.call.close();
      this._removeVideoTile(socketId);
      this.activeCalls.delete(socketId);
      this._updateBroadcastUI();
      if (this.videoPanel.childElementCount === 0) {
        this.videoPanel.style.display = 'none';
      }
    }
    
    if (this.callTeardownTimers.has(socketId)) {
      clearTimeout(this.callTeardownTimers.get(socketId));
      this.callTeardownTimers.delete(socketId);
    }
  }

  _updateBroadcastUI() {
    const statusEl = document.getElementById('broadcast-status');
    const textEl = document.getElementById('broadcast-text');
    if (!statusEl || !textEl) return;

    // We only count calls that aren't pending teardown as "active" for the UI
    let activeCount = 0;
    for (const socketId of this.activeCalls.keys()) {
      if (!this.callTeardownTimers.has(socketId)) {
        activeCount++;
      }
    }

    if (this.localStream) {
      statusEl.style.display = 'flex';
      if (activeCount > 0) {
        textEl.textContent = `Live (${activeCount} nearby)`;
      } else {
        textEl.textContent = 'Live (Broadcasting)';
      }
    } else {
      statusEl.style.display = 'none';
    }
  }

  _setVolume(socketId, distance) {
    const entry = this.activeCalls.get(socketId);
    if (entry && entry.videoEl) {
      const volume = Math.max(0, 1 - (distance / MAX_DISTANCE));
      entry.videoEl.volume = volume;
    }
  }

  _createVideoTile(socketId, stream) {
    // Get player name from lobby
    const scene = window.__gameScene;
    let name = socketId.slice(0, 6);
    if (scene && scene.config && scene.config.players) {
      const p = scene.config.players.find(pl => pl.id === socketId);
      if (p) name = p.name;
    }

    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = `video-${socketId}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    const label = document.createElement('div');
    label.className = 'video-tile-name';
    label.textContent = name;

    tile.appendChild(video);
    tile.appendChild(label);
    this.videoPanel.appendChild(tile);
    this.videoPanel.style.display = 'flex'; // Ensure panel is visible when adding a tile

    return video;
  }

  _removeVideoTile(socketId) {
    const tile = document.getElementById(`video-${socketId}`);
    if (tile) tile.remove();
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = enabled);
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => t.enabled = enabled);
    }
  }

  destroy() {
    if (this.checkTimer) clearInterval(this.checkTimer);
    for (const [sid] of this.activeCalls) {
      this._endCall(sid);
    }
    if (this.peer) this.peer.destroy();
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
    }
    this.videoPanel.innerHTML = '';
  }
}
