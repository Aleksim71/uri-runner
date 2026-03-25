# path: README-A27-browser-session-start-attach-fix.txt

Что чинит:
- browser.session.start раньше создавал только metadata session
- runtime.page не создавался
- browser.page.open падал с BROWSER_PAGE_INSTANCE_MISSING

Что делает патч:
1. в session.start пытается attach к браузеру через attach-browser-session.cjs
2. endpoint берётся из:
   - input.endpoint
   - environment.endpoint
   - BROWSER_ENDPOINT
   - CDP_ENDPOINT
   - CHROME_REMOTE_DEBUGGING_URL
3. при успешном attach создаёт page adapter и сохраняет его в:
   runtimeContext.browser.sessions[sessionId].runtime.page

Важно:
- для реального attach нужен доступный CDP endpoint
- в тестовом inbox ниже используется стандартный адрес:
  http://127.0.0.1:9222

Если на машине браузер не открыт с remote debugging, следующий честный блокер будет:
- Browser attach failed: endpoint_required / target_not_found / attach_failed
