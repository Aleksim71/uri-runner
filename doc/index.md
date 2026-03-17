# Индекс документации URI Runner


------------------------------------------------
Обзор
------------------------------------------------

Документация URI Runner организована по нескольким логическим слоям:

1 Архитектура runtime
2 Жизненный цикл выполнения
3 Модули runtime
4 Системные контексты
5 Протоколы артефактов
6 CLI-интерфейс
7 История изменений


------------------------------------------------
Базовая архитектура
------------------------------------------------

Runtime Pack

doc/runtime/runtime-pack.md

Описывает основные runtime-модули и pipeline выполнения.


Execution Lifecycle

doc/runtime/execution-lifecycle.txt

Определяет канонические фазы выполнения URI.


Intake Gate

doc/runtime/intake-gate-v1.txt

Описывает intake-фильтрацию входящих пакетов и маршрутизацию по полю receiver.


Environment Reset System

doc/runtime/environment-reset.md

Описывает pipeline сброса окружения, выполняемый перед запуском сценария.

Модули:

stop-managed-processes  
cleanup-runtime-state  
start-managed-server  
run-healthcheck  
reset-environment


------------------------------------------------
Система исполняемого контекста
------------------------------------------------

Executable Context Runtime

doc/system/executable-context-runtime.md

Описывает механизм executable.yaml, используемый для определения
исполняемых сценариев проекта.


------------------------------------------------
Артефакты выполнения
------------------------------------------------

Run Sandbox System

Каждое выполнение изолируется внутри собственной runtime-песочницы.

Структура:

runtime/runs/<runId>/

Содержимое:

traces  
artifacts  
provided  
logs  
tmp


Trace System

Трейсы выполнения хранятся внутри runtime-песочницы:

runtime/runs/<runId>/traces


History System

runtime/history/index.json

Индекс истории используется CLI-командами:

uri history  
uri last  
uri show <runId>


Outbox Protocol

Пакет результата выполнения.

Артефакт:

outbox.zip


------------------------------------------------
Pipeline выполнения runtime
------------------------------------------------

Канонический pipeline:

RUNBOOK / executable.yaml
        ↓
intake gate
        ↓
inbox intake
        ↓
compilePlan
        ↓
plan validation
        ↓
run sandbox initialization
        ↓
environment reset
        ↓
scenario execution
        ↓
execution events
        ↓
trace recording
        ↓
outbox packaging
        ↓
history persistence


------------------------------------------------
CLI-команды
------------------------------------------------

Основные команды:

uri run
uri history
uri last
uri show <runId>
uri replay trace.json


------------------------------------------------
История изменений документации
------------------------------------------------

doc/changelog.md


------------------------------------------------
Структура документации
------------------------------------------------

doc/

  index.md

  changelog.md

  runtime/

      execution-lifecycle.txt
      intake-gate-v1.txt
      runtime-pack.md
      environment-reset.md

  system/

      executable-context-runtime.md


------------------------------------------------
Правила документации
------------------------------------------------

Файлы документации должны следовать таким принципам:

1 детерминированная структура  
2 минимальная избыточность  
3 сначала архитектура  
4 затем детали реализации  

Индекс документации должен оставаться основной точкой входа
как для разработчиков, так и для AI-агентов.


------------------------------------------------
КОНЕЦ
------------------------------------------------
