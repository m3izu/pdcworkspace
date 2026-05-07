# SnappyWorld: A Parallel & Distributed Virtual Space

Welcome to **SnappyWorld**, a cutting-edge virtual gathering platform designed for seamless interaction, real-time collaboration, and immersive proximity-based communication.

## 🌟 Introduction
SnappyWorld is a **virtual "tambayan"** or social hangout space where users inhabit a 2D world as customizable avatars. Unlike traditional video conferencing, SnappyWorld mimics real-world physics: your video and audio grow louder or appear as you move closer to others, fostering organic, spontaneous conversations just like hanging out in person.

---

## 💻 Parallel & Distributed Concepts
SnappyWorld is a prime example of a **Distributed System** leveraging modern networking protocols to handle high-concurrency and low-latency interactions.

### 1. Hybrid Client-Server & P2P Architecture
SnappyWorld utilizes a sophisticated hybrid model to optimize performance and reliability.
- **Server-Assisted Signaling**: Using a Node.js server (hosted on Railway), the system manages lobby states and handles "Signaling"—the process of helping peers discover and connect to each other.
- **WebRTC Data Streaming**: Once connected, high-bandwidth video and audio data are streamed directly between browsers (Peer-to-Peer). This distributed approach reduces server load and latency, ensuring a smooth experience even as more players join a lobby.

### 2. Real-Time State Synchronization (Socket.io)
The world state (player positions, animations, and minigame states) is managed through a **Centralized Coordinator** (the Node.js server).
- **Event-Driven Architecture**: The server processes thousands of position updates in parallel, broadcasting "deltas" (changes) to all connected clients to maintain a "Single Source of Truth."
- **Concurrency**: The server handles multiple independent "Lobbies" in parallel, ensuring that state changes in one room do not interfere with others.

### 3. Proximity Logic (Spatial Partitioning)
The "Proximity Chat" feature is a distributed computation. Each client calculates its distance to other peers locally to determine volume and visibility, reducing the computational load on the central server.

---

## 🧠 Design Rationale
- **Engagement over Fatigue**: Traditional video calls are draining. SnappyWorld uses spatial context to make interactions feel more natural and less like a "meeting."
- **Low Barrier to Entry**: No installation required. Everything runs in the browser using high-performance WebGL (Phaser 3).
- **Gamified Socializing**: By integrating minigames (Poker, Uno, Tic-Tac-Toe) directly into the world, the platform serves as both a social hub and a digital tambayan.

---

## 🏗️ Architecture & Design

### High-Level Architecture
- **Frontend**: Phaser 3 (Game Engine), Socket.io-client, PeerJS.
- **Backend**: Node.js, Express, Socket.io (Signaling & State), PeerJS Server.
- **Deployment**: Configured for **Railway** using Nixpacks for automated builds and high-availability hosting.

### System Overview
1. **Signaling Layer**: Handles the initial "handshake" between players to establish P2P connections.
2. **Game Layer**: A 2D engine that renders maps, handles physics/collisions, and manages the UI.
3. **Minigame Engine**: A modular system allowing for plug-and-play card games and board games that sync across the network.

---

## 🚀 Major Features
- **Proximity Video/Audio**: Talk to people simply by walking up to them.
- **Lobby System**: Create private, 4-digit coded rooms with custom map selections.
- **Interactive Minigames (Expanding Ecosystem)**: 
    - **Poker & Tongits**: High-stakes card games with synchronized logic.
    - **UNO**: Casual multiplayer fun.
    - **Board Games**: Tic-Tac-Toe, Checkers, and Battleship.
    - *Note: More games are currently in development as part of the SnappyWorld roadmap.*
- **Custom Avatars**: High-fidelity character selection with animated previews.
- **Dynamic Island HUD**: A modern, non-intrusive UI for managing lobby details and preferences.
- **Mobile Optimized**: Custom joystick controls and responsive layouts for gaming on the go.

---

## 🛠️ Developer Info
- **Project Name**: SnappyWorld
- **Repository**: [m3izu/pdcworkspace](https://github.com/m3izu/pdcworkspace)
- **Built With**: JavaScript (ES6+), Node.js, HTML5 Canvas, WebRTC.

---
*Created as part of the Parallel and Distributed Computing (PDC) project.*
