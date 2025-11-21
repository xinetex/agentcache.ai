# Feature: Session Snapshots (Time Travel for Agents)

## The Concept
You asked if "Snapshot technology can enhance cache". **Yes.**
In our "Memory OS" metaphor, a Snapshot is a **System Restore Point**.

### Use Cases
1.  **Forking:** "Let's go back to when we talked about X and try a different path."
2.  **Safety:** "The agent got confused. Roll back to the snapshot from 10 minutes ago."
3.  **Testing:** "Run 50 simulations starting from *this exact memory state*."

## Implementation Plan

### 1. The "Snapshot" Mechanism
We don't need complex disk snapshots. We can do **Logical Snapshots** in Redis.

*   **Command:** `POST /api/agent/snapshot`
    *   Input: `sessionId`
    *   Action:
        1.  Read current L2 History (Redis List).
        2.  Generate new `snapshotId`.
        3.  Save copy of list to `snapshot:{snapshotId}`.
    *   Output: `snapshotId`

*   **Command:** `POST /api/agent/restore` (or `fork`)
    *   Input: `snapshotId`, `newSessionId`
    *   Action:
        1.  Read `snapshot:{snapshotId}`.
        2.  Write to `session:{newSessionId}`.
    *   Result: A new session that starts exactly where the snapshot left off.

## Next Steps
1.  **Syntax Check:** I am running `tsc` to check for any code issues.
2.  **Prototype Snapshots:** I can add these endpoints to `ContextManager` easily.
