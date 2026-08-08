---
"s11tnext-cli": patch
---

Distinguish missing files and source directories from permission, directory, and other filesystem read
failures in CLI diagnostics.

The scoped source watcher and actionable filesystem diagnostics increase the packed CLI from 22,908
bytes on the preceding main commit to 23,602 bytes. Raise its deterministic size ceiling from 23,000 to
24,500 bytes, retaining 3.8% headroom while continuing to reject larger unreviewed growth.
