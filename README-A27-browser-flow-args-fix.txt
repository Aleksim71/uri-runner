# path: README-A27-browser-flow-args-fix.txt

Причина текущего блокера:
- materialized plan теряет аргументы browser.flow
- в plan.json у step browser.session.start сейчас args = {}
- из-за этого session.start не получает:
  - sessionId
  - endpoint
- и page.open затем падает с BROWSER_PAGE_INSTANCE_MISSING

Что делает этот патч:
- compile-browser-flow.cjs теперь переносит все поля browser.flow item
  (кроме id и action) в input
- для page.open по-прежнему валидируется обязательный url
- благодаря этому в plan args доедут:
  - sessionId
  - endpoint
  - url
  - timeoutMs
  - include
  - until

После применения:
1. распаковать архив поверх проекта
2. положить новый inbox.zip в ~/Загрузки
3. запустить uri watch
4. проверить:
   - uri-runner-nextBox/history/plans/<runId>.plan.json
   - outbox/outbox.json
