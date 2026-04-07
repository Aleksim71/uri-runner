# path: test/real/README.md

# Real tests — current outbox schema scaffold

Этот пакет подготовлен под **profile-first real tests** для `uri-runner-next`.

Цель:
- запускать URI как чёрный ящик,
- подавать `inbox.zip`,
- получать `outbox.zip`,
- нормализовать результат,
- сравнивать с эталоном.

## Что внутри

- `helpers/run-uri-real-case.mjs` — упаковка inbox, запуск URI, распаковка outbox
- `helpers/normalize-current-outbox.mjs` — нормализация outbox под текущую схему проекта
- `helpers/assert-current-outbox.mjs` — мягкое сравнение с эталоном
- `*.test.mjs` — первые реальные тесты
- `cases/*/EXPECTED/expected-outbox.json` — эталоны для нормализованного результата

## На что опирается пакет

Пакет выровнен под **лучшую доступную картину текущей схемы** из контекста проекта:

- truth path: `inbox.zip -> URI -> outbox.zip`
- внутри outbox ожидаются как минимум:
  - `STATUS.json`
  - `SNAPSHOT.txt`
  - `REPORT/`
- дополнительно helper умеет читать fallback-формы вроде:
  - `outbox/outbox.json`
  - root-level JSON summary

Если в текущем `uri-runner-next` схема отличается, нужно будет подкрутить только:
- `normalize-current-outbox.mjs`
- `run-uri-real-case.mjs`

## Ожидаемая команда запуска

По умолчанию helper пробует:

```bash
node bin/uri.cjs audit --inbox <path> --outbox <path> --workspace <path>
```

Но это можно переопределить через env:

```bash
URI_REAL_CLI="node bin/uri.cjs audit" npm run test:real
```

или

```bash
URI_REAL_CLI="uri audit" npm run test:real
```

## Почему нормализация мягкая

На этом этапе важнее стабильно проверять profile contract:
- status
- attempts
- stop reason
- key report files

а не жёстко привязываться к каждому внутреннему полю outbox.


## Overlay для кейсов, которым нужен свой executable context

Если кейсу нужен отдельный `contexts/system/executable.yaml` или другие проектные файлы, он может положить их в:

```text
test/real/cases/<caseName>/PROJECT/
```

Helper `run-uri-real-case.mjs` в таком случае:
- создаёт временную копию репозитория,
- накладывает поверх неё `PROJECT/`,
- запускает watcher/CLI из этой временной копии,
- после теста удаляет её.

Это нужно для truth-кейсов вроде `classification_required`, где нельзя портить живой `contexts/system/executable.yaml` в основном репозитории.
