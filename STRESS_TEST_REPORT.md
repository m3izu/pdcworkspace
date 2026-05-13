# SnappyWorld Stress Test Report

**Date:** May 14, 2026  
**Target:** `https://snappyworld.up.railway.app`  
**Tool:** [Artillery](https://www.artillery.io/) (Socket.IO engine)  
**Test Duration:** ~4 minutes (240 seconds total)

---

## Test Configuration

The stress test was executed using the following Artillery configuration:

```yaml
config:
  target: "https://snappyworld.up.railway.app"
  phases:
    - duration: 60
      arrivalRate: 5
      name: Warm up phase
    - duration: 120
      arrivalRate: 10
      rampTo: 50
      name: Ramp up phase
    - duration: 60
      arrivalRate: 50
      name: Sustained load phase
```

### Phase Breakdown

| Phase | Duration | Arrival Rate | Description |
|-------|----------|-------------|-------------|
| **Warm Up** | 60s | 5 users/sec | Low load to establish baseline performance |
| **Ramp Up** | 120s | 10 → 50 users/sec | Gradually increasing load to identify breaking points |
| **Sustained Load** | 60s | 50 users/sec | Constant high load to test stability under stress |

### Scenario

Each virtual user executes the **"Host a lobby and move"** scenario, which simulates a player connecting via Socket.IO, hosting a game lobby, and performing in-game movement actions.

---

## Concurrent User Estimation

Artillery's `arrivalRate` defines **new users spawned per second**, not simultaneous users. Since each user session lasts approximately **~12.7 seconds** (baseline), concurrent users at any given moment can be estimated as:

> **Concurrent Users ≈ Arrival Rate × Session Length**

| Phase | Arrival Rate | Estimated Concurrent Users |
|-------|-------------|---------------------------|
| Warm Up | 5/sec | ~63 |
| Ramp Up (midpoint) | ~30/sec | ~380 |
| Sustained Load | 50/sec | ~635 |

---

## Results Summary

### Phase 1: Warm Up (06:39:53 – 06:40:53)

| Metric | Value |
|--------|-------|
| Users Created (per 10s) | ~50 |
| Users Failed | **0** |
| Emit Rate | 55–60/sec |
| Session Length (mean) | ~12,800 ms |
| Session Length (p95) | ~12,968 ms |

> ✅ **Verdict:** Server handled warm-up load with zero errors and consistent response times.

---

### Phase 2: Ramp Up (06:40:53 – 06:42:54)

#### Early Ramp (10–20 users/sec) — Stable

| Metric | Value |
|--------|-------|
| Users Created (per 10s) | 50–167 |
| Users Failed | **0** |
| Emit Rate | 55–101/sec |
| Session Length (mean) | ~12,700–12,900 ms |

> ✅ Server remained stable with no failures up to ~167 users created per 10-second window.

#### Mid Ramp (~20–35 users/sec) — Degradation Begins

| Metric | Value |
|--------|-------|
| Users Created (per 10s) | 199–300 |
| Users Failed | **9–70** |
| Error Types | `xhr poll error`, `xhr post error`, `timeout` |
| Session Length (mean) | 15,000–21,000 ms |
| Session Length (max) | up to 42,773 ms |

> ⚠️ **First errors appeared at ~199 users/window** (~20 users/sec arrival rate, ~250 concurrent). Errors escalated rapidly with load.

#### Late Ramp (~35–50 users/sec) — Significant Failure

| Metric | Value |
|--------|-------|
| Users Created (per 10s) | 336–436 |
| Users Failed | **99–230** |
| Failure Rate | ~30–53% |
| Timeout Errors (per 10s) | 31–99 |
| XHR Poll Errors (per 10s) | 37–73 |
| XHR Post Errors (per 10s) | 25–58 |
| Session Length (mean) | 21,700–25,200 ms |
| Session Length (max) | up to 58,069 ms |

> 🔴 Failure rates climbed above 50%. Session lengths more than doubled from baseline.

---

### Phase 3: Sustained Load (06:42:54 – 06:43:54)

| Metric | Range Across Windows |
|--------|---------------------|
| Users Created (per 10s) | 466–508 |
| Users Completed (per 10s) | 55–116 |
| Users Failed (per 10s) | **285–411** |
| **Failure Rate** | **61–81%** |
| Timeout Errors (per 10s) | 118–164 |
| XHR Poll Errors (per 10s) | 92–130 |
| XHR Post Errors (per 10s) | 75–124 |
| Emit Rate | 85–123/sec |
| Session Length (mean) | 20,500–25,400 ms |
| Session Length (p95) | 32,500–43,000 ms |
| Session Length (max) | up to 49,876 ms |

> 🔴 **Verdict:** Under sustained 50 users/sec load, the server experienced **60–80% failure rates** with severe latency degradation. The majority of connections either timed out or encountered transport-level errors.

---

## Error Analysis

Three distinct error types were observed during the test:

| Error Type | Description | Root Cause |
|------------|-------------|------------|
| `xhr poll error` | HTTP long-polling requests to the server failed | Server unable to handle polling request volume; connection rejected or dropped |
| `xhr post error` | HTTP POST requests (sending data) to the server failed | Server overloaded, unable to process incoming data payloads |
| `timeout` | Connection timed out before completing the scenario | Server response time exceeded Artillery's timeout threshold |

### Error Escalation Timeline

| Time Window | Timeouts | Poll Errors | Post Errors | Total Errors |
|-------------|----------|-------------|-------------|-------------|
| 06:41:30 | 0 | 8 | 1 | **9** |
| 06:41:40 | 4 | 14 | 6 | **24** |
| 06:41:50 | 12 | 13 | 12 | **37** |
| 06:42:00 | 20 | 27 | 23 | **70** |
| 06:42:10 | 31 | 37 | 31 | **99** |
| 06:42:20 | 60 | 56 | 25 | **141** |
| 06:42:30 | 81 | 71 | 51 | **203** |
| 06:42:40 | 99 | 73 | 58 | **230** |
| 06:42:50 | 118 | 92 | 75 | **285** |
| 06:43:00 | 126 | 101 | 79 | **306** |
| 06:43:10 | 119 | 123 | 98 | **340** |
| 06:43:20 | 164 | 130 | 102 | **396** |
| 06:43:30 | 160 | 127 | 124 | **411** |
| 06:43:40 | 120 | 129 | 92 | **341** |

---

## Performance Thresholds

Based on the test results, the following capacity thresholds were identified:

| Threshold | Arrival Rate | Est. Concurrent Users | Behavior |
|-----------|-------------|----------------------|----------|
| **Comfortable** | ≤ 10/sec | **~125** | 0% failure, consistent ~12.7s sessions |
| **Maximum Stable** | ~15–20/sec | **~200** | <5% failure, slight latency increase |
| **Degraded** | 20–35/sec | **200–450** | 30–53% failure, 2x session length |
| **Critical** | 50/sec | **~635** | 60–80% failure, 4x session length |

---

## Key Findings

1. **Baseline Performance:** The server handles Socket.IO connections well at low load, with consistent ~12.7s session lengths and up to 60 emits/sec with zero errors.

2. **Breaking Point:** Server degradation begins at approximately **200 concurrent Socket.IO connections** (~20 users/sec arrival rate), with HTTP transport errors appearing first.

3. **Transport Failures:** The `xhr poll error` and `xhr post error` suggest that the HTTP long-polling fallback transport is the first to fail. WebSocket connections may also be rejected under load, forcing more clients to fall back to polling, which creates a cascading failure.

4. **Latency Impact:** Mean session length increased from **12.7s → 25.2s** (2x) under peak load, with worst-case sessions reaching **58 seconds** (4.5x baseline).

5. **Throughput Ceiling:** Socket.IO emit rate plateaued at **~130/sec** despite increasing user count, indicating a server-side processing bottleneck.

---

## Recommendations

| Priority | Recommendation | Expected Impact |
|----------|---------------|-----------------|
| 🔴 High | **Scale up Railway instance** (more CPU/RAM) | Increase the ~200 concurrent user threshold |
| 🔴 High | **Force WebSocket transport** (`transports: ['websocket']`) to avoid HTTP polling overhead | Reduce `xhr poll/post` errors, lower per-connection resource usage |
| 🟡 Medium | **Implement horizontal scaling** with multiple server instances + Redis Adapter for Socket.IO | Linear scaling of concurrent user capacity |
| 🟡 Medium | **Optimize server-side event handlers** — reduce per-message processing time | Higher throughput ceiling |
| 🟢 Low | **Add rate limiting** on connection attempts to degrade gracefully | Prevent cascading failures under extreme load |
| 🟢 Low | **Implement connection queuing** for lobby creation | Smoother user experience during peak traffic |

---

## Appendix: Raw Test Configuration

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 5
      name: Warm up phase
    - duration: 120
      arrivalRate: 10
      rampTo: 50
      name: Ramp up phase
    - duration: 60
      arrivalRate: 50
      name: Sustained load phase
  engines:
    socketio:
      transports:
        - websocket
  socketio:
    query:
      EIO: "4"

scenarios:
  - name: "Host a lobby and move"
    engine: socketio
    flow:
      - emit:
          channel: "host-lobby"
          data:
            hostName: "LoadTestUser_{{ $uuid }}"
      - think: 2
      - emit:
          channel: "player-move"
          data:
            lobbyCode: "LOADTEST"
            x: 100
            y: 200
            direction: "right"
      - think: 2
      - emit:
          channel: "player-move"
          data:
            lobbyCode: "LOADTEST"
            x: 150
            y: 250
            direction: "left"
      - think: 5
```

> **Note:** The test was run with `--target https://snappyworld.up.railway.app` to override the localhost target in the YAML config.
