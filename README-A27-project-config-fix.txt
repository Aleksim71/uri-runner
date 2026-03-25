# path: README-A27-project-config-fix.txt

Причина:
- src/uram/project-resolver.cjs читает registry из:
  config/projects.yaml
- раньше был исправлен только:
  runtime/watch/config/projects.yaml
- поэтому execution path всё равно продолжал падать с:
  [uri] project not registered: uri-runner-next

Что делает этот патч:
- создаёт/обновляет config/projects.yaml
- для согласованности также обновляет runtime/watch/config/projects.yaml
- регистрирует проект под фактическим именем:
  uri-runner-next

После применения:
1. распаковать архив поверх проекта
2. положить новый inbox.zip в ~/Загрузки
3. запустить: uri watch --once
