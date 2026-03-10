# URI Runner Next — Структура Phase 1

Дата: 10.03.2026  
Версия: Phase 1

Документ фиксирует минимальную структуру нового проекта `uri-runner-next`.

Цель Phase 1 — создать новую архитектуру без изменения текущего `uri-runner`.

---

# Структура проекта

uri-runner-next/
├── bin/
│   └── uri.cjs
│
├── src/
│   ├── commands/
│   │   ├── command-registry.cjs
│   │   ├── context/
│   │   │   ├── audit.cjs
│   │   │   ├── runbook.cjs
│   │   │   └── validate-meta.cjs
│   │   ├── file/
│   │   │   ├── build-inbox.cjs
│   │   │   ├── patch.cjs
│   │   │   └── zip.cjs
│   │   ├── test/
│   │   │   ├── checks.cjs
│   │   │   └── run-vitest.cjs
│   │   └── system/
│   │       ├── doctor.cjs
│   │       ├── exec.cjs
│   │       ├── server.cjs
│   │       └── urls.cjs
│
│   ├── cli/
│   │   ├── commands/
│   │   │   └── test.cjs
│   │   └── index.cjs
│
│   └── uram/
│       ├── paths.cjs
│       ├── pipeline.cjs
│       ├── run.cjs
│       └── watch-inbox-once.cjs
│
├── test/
│   ├── fixtures/
│   │   └── RUNBOOK.yaml
│   ├── helpers/
│   │   ├── sandbox.cjs
│   │   └── zip-create.cjs
│   ├── sandbox/
│   │   ├── create-sandbox-config.cjs
│   │   ├── create-sandbox.sh
│   │   └── write-sandbox-config.cjs
│   └── scenarios/
│       ├── watch-inbox.accepts-broken-meta.test.mjs
│       ├── watch-inbox.accepts-valid-meta.test.mjs
│       └── watch-inbox.strict-intake.test.mjs
│
├── artifacts/
│   ├── inbox/
│   └── outbox/
│
├── doc/
│   └── uri_runner_next_phase1_structure.md
│
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── vitest.config.mjs

---

# Цели Phase 1

1. Выделить слой `commands`
2. Сохранить watcher
3. Перенести существующие команды
4. Запустить watcher-тесты
5. Не изменять старый `uri-runner`

---

# Командные библиотеки

Команды разделены на библиотеки:

context  
file  
test  
system  

Формат имени команды:

library.command

Примеры:

context.validate-meta  
file.zip  
system.exec  
test.run-vitest  

---

# Критерии завершения Phase 1

Phase 1 считается завершённым если:

1. `npm install` выполняется без ошибок
2. команды находятся в `src/commands`
3. существует `command-registry`
4. URAM использует команды
5. watcher-тесты проходят
6. старый `uri-runner` не изменён
