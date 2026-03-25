# path: README-A27-browser-page-open-interface-fix.txt

Причина текущего падения:
- run-plan вызывает executeBrowserPageOpenStep так:
  { runtimeContext, input, sessionId }
- старый execute-browser-page-open-step.cjs ожидал другой контракт:
  { page, input, runtime }

Из-за этого page.open падал с:
- browser.page.open requires a page instance.

Что делает этот патч:
1. выравнивает execute-browser-page-open-step под фактический вызов из run-plan
2. читает session через browser-session-store
3. пытается взять page из:
   runtimeContext.browser.sessions[sessionId].runtime.page
4. использует session.baseUrl как fallback
5. после успешного open обновляет pageUrl/pageTitle в session state

Важно:
- этот патч чинит interface mismatch
- если session.start всё ещё не создаёт реальный page instance в session.runtime.page,
  следующий блокер будет уже честным:
  BROWSER_PAGE_INSTANCE_MISSING

То есть после этого мы либо пойдём дальше, либо получим точный следующий runtime-gap:
- нужен реальный browser launch/attach в session.start
