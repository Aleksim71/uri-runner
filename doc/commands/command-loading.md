# Загрузка команд

Документ описывает механизм автоматической загрузки команд в `uri-runner-next`.

## Идея

URI не должен регистрировать каждую команду вручную в runtime-коде.

Вместо этого runtime автоматически сканирует директорию `src/commands`
и регистрирует все найденные команды в `CommandRegistry`.

Это позволяет:

- не раздувать `pipeline.cjs` ручной регистрацией
- добавлять новые команды без правки runtime
- сохранить единый контракт имени команды
- уменьшить риск пропустить регистрацию новой команды

---

## Структура директорий

Команды размещаются по правилу:

```text
src/commands/<library>/<command>.cjs
```

Примеры:

```text
src/commands/system/exec.cjs
src/commands/system/echo.cjs
src/commands/file/zip.cjs
src/commands/context/audit.cjs
src/commands/test/run-vitest.cjs
```

---

## Имя команды

Имя команды автоматически формируется из пути:

```text
<library>.<command>
```

Примеры:

```text
src/commands/system/exec.cjs   -> system.exec
src/commands/system/echo.cjs   -> system.echo
src/commands/file/zip.cjs      -> file.zip
src/commands/context/audit.cjs -> context.audit
```

---

## Что не загружается автоматически

Служебные файлы не считаются командами.

На текущем этапе автозагрузка не регистрирует:

```text
src/commands/command-registry.cjs
src/commands/load-commands.cjs
```

Также не загружаются файлы вне библиотечных подпапок.

---

## Runtime-поведение

Во время запуска Scenario Runtime:

1. создаётся `CommandRegistry`
2. выполняется сканирование `src/commands`
3. все найденные команды регистрируются автоматически
4. сценарий получает доступ ко всем зарегистрированным командам

---

## Преимущества

Автозагрузка команд делает систему проще:

- новая команда добавляется созданием файла
- runtime не требует ручной поддержки списка команд
- структура `src/commands` становится естественным реестром возможностей URI

---

## Ограничения текущей версии

Текущая реализация:

- сканирует только один уровень библиотек
- загружает только файлы `.cjs`
- не поддерживает плагины
- не поддерживает вложенные namespace глубже `library.command`

Это нормально для Phase 1 и может быть расширено позже.

---

## Связанные файлы

```text
src/commands/command-registry.cjs
src/commands/load-commands.cjs
src/uram/pipeline.cjs
```
