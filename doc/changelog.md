## 16.03.2026

Runtime V3 Stage 3 — A9

Runtime sandbox architecture introduced.

Key changes:

Per-run runtime directories:

runtime/runs/<runId>/

Run sandbox structure:

traces  
artifacts  
provided  
logs  
tmp  

Runtime Paths Builder introduced.

Central runtime path resolution module.

Selective sandbox cleanup policy added.

cleanup-runtime-state now supports targeted cleanup.

Backward compatibility preserved for empty cleanup result contract.

Test status:

40 test files passed  
84 tests passed
