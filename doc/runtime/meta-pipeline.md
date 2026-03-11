# Meta Pipeline Parity Patch

Что возвращает этот патч в новый meta-путь:

- запись `history/index.jsonl`
- создание и обновление `outbox.latest.zip`
- единый flow для `processed/history/latest`

Новый путь работает через:

- `meta.project`
- `meta.context_kind`

Legacy fallback на `profile` остаётся.
