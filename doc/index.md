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
A13 UPDATE (Materialized Execution)
------------------------------------------------

Начиная с A13:

- materialized execution является базовой моделью выполнения  
- выполнение происходит через plan (а не напрямую из runbook)  
- plan.json становится обязательным execution-артефактом  
- добавлена совместимость через materializePlanFromRunbook  

Pipeline:

RUNBOOK  
→ compile  
→ plan  
→ run-plan  
→ trace / history / outbox  

------------------------------------------------
A14 UPDATE (Plan Schema Validation)
------------------------------------------------

Начиная с A14:

- compiled plan валидируется перед execution  
- structurally invalid plan не исполняется  
- execution не начинается при нарушении структуры  
- ошибка контракта: PLAN_SCHEMA_INVALID  

Важно:

- проверяется только структура plan  
- validation не заменяет execution и policy  

------------------------------------------------
Базовая архитектура
------------------------------------------------

Runtime Pack

doc/runtime/runtime-pack.md


Execution Lifecycle

doc/runtime/execution-lifecycle.txt


------------------------------------------------
Артефакты выполнения
------------------------------------------------

Run Sandbox System

runtime/runs/<runId>/

Содержимое:

traces  
artifacts  
provided  
logs  
tmp  

------------------------------------------------
Pipeline выполнения runtime
------------------------------------------------

Канонический pipeline:

RUNBOOK  
        ↓  
intake gate  
        ↓  
inbox intake  
        ↓  
compilePlan  
        ↓  
materialize plan (A13)  
        ↓  
plan validation (A14)  
        ↓  
run-plan execution  
        ↓  
trace recording  
        ↓  
outbox packaging  
        ↓  
history persistence  

------------------------------------------------
КОНЕЦ
------------------------------------------------
