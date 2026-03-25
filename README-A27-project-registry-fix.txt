# path: README-A27-project-registry-fix.txt

Причина падения execution:
- watcher принял RUNBOOK с project: uri-runner-next
- но registry в runtime/watch/config/projects.yaml зарегистрирован как:
  projects:
    uri-runner:
      cwd: /home/aleksim/uri-runner-next

Из-за этого execution падал с:
[uri] project not registered: uri-runner-next

Этот патч выравнивает registry key под фактическое имя проекта:
- было: uri-runner
- стало: uri-runner-next

После применения:
1. распаковать архив поверх проекта
2. положить новый inbox.zip в ~/Загрузки
3. запустить uri watch --once
