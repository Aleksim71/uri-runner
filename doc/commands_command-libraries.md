# Command Libraries

Команды представляют собой атомарные действия системы URI.

Команды сгруппированы в библиотеки.

## Command Libraries

    context
    file
    test
    system

Каждая библиотека содержит команды, относящиеся к своей области.

------------------------------------------------------------------------

# Формат имени команды

Имя команды имеет формат:

    library.command

Примеры:

    context.validate-meta
    file.zip
    system.exec
    test.run-vitest

------------------------------------------------------------------------

# Использование команд

Команды **не вызываются напрямую CLI**.

Команды вызываются **runtime-движком URI** во время выполнения сценария.

Сценарий содержит список шагов, каждый из которых указывает команду.

Пример шага сценария:

``` yaml
- id: run_tests
  command: test.run-vitest
  args:
    pattern: test/scenarios/**/*.test.mjs
```

Runtime:

1.  читает сценарий
2.  находит команду
3.  разрешает её через command registry
4.  выполняет handler команды

------------------------------------------------------------------------

# Command Registry

Command registry связывает имя команды с её реализацией.

Пример:

    context.validate-meta → src/commands/context/validate-meta.cjs
    file.zip → src/commands/file/zip.cjs
    system.exec → src/commands/system/exec.cjs
    test.run-vitest → src/commands/test/run-vitest.cjs

Registry используется runtime-движком для разрешения команд во время
выполнения сценария.
