# path: README-A27-browser-cdp-adapter-fix.txt

Причина текущего блокера:
- attach уже успешен
- session находится
- но createPageAdapter() не умеет работать с buffered client из cdp-client.cjs

Что видно по cdp-client.cjs:
- attachToTarget() возвращает createBufferedClient(...)
- buffered client хранит реальный CDP client в поле `rawClient`
- у rawClient есть `Page.navigate(...)`
- но старый createPageAdapter() смотрел только в:
  - client.goto
  - client.navigate
  - client.open
  - client.Page.navigate

Из-за этого page.open падал с:
- Attached browser client does not expose goto/navigate/open/Page.navigate.

Что делает патч:
- createPageAdapter() теперь также поддерживает:
  - client.rawClient.Page.navigate(...)
- title() умеет брать title через client.getPageMetadata()

После применения:
1. распаковать архив поверх проекта
2. использовать тот же inbox.zip с endpoint 127.0.0.1:9222
3. запустить uri watch
4. проверить новый outbox.json
