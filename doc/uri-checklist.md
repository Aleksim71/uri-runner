# URI Runner --- Checklist (Commands & Stability)

## A. Critical Commands (P0)

-   [ ] uri run --dry\
-   [ ] uri run --trace\
-   [ ] uri debug step `<step-type>`{=html}\
-   [ ] uri validate\
-   [ ] uri explain \<runbook\|plan\|step\>

## B. Observability

-   [ ] uri status\
-   [ ] uri history\
-   [ ] uri report \<runId\|outbox.zip\>\
-   [ ] uri replay `<runId>`{=html}

## C. Browser DevTools

-   [ ] uri browser open `<url>`{=html}\
-   [ ] uri browser wait \<ms\|selector\>\
-   [ ] uri browser click `<selector>`{=html}\
-   [ ] uri browser type `<selector>`{=html} `<text>`{=html}\
-   [ ] uri browser snapshot\
-   [ ] uri browser close

## D. Inbox / Outbox

-   [ ] uri build\
-   [ ] uri unpack \<outbox.zip\>\
-   [ ] uri inspect inbox.zip\
-   [ ] uri inspect outbox.zip\
-   [ ] uri clean workspace\
-   [ ] uri clean history

## E. Capability / Policy

-   [ ] uri capabilities\
-   [ ] uri run --allow=`<cap>`{=html}\
-   [ ] uri run --deny=`<cap>`{=html}\
-   [ ] uri policy print\
-   [ ] uri policy validate

## F. Config / Environment

-   [ ] uri config show\
-   [ ] uri config check\
-   [ ] uri config doctor\
-   [ ] uri env print

## G. Stability Requirements

-   [ ] Exit codes standardization\
-   [ ] Structured logs\
-   [ ] Locks / anti-race\
-   [ ] Timeouts\
-   [ ] Cleanup on failure\
-   [ ] Artifact validation\
-   [ ] Reproducibility (config snapshot)\
-   [ ] Browser diagnostics\
-   [ ] Versioning contracts\
-   [ ] Pre-run self-check

## Priority Roadmap

### P0

Core debug + stability

### P1

Browser CLI + inspect + replay

### P2

REPL + advanced tooling
