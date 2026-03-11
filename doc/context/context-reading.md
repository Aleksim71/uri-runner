# Context Reading Protocol

URI может читать контекст несколькими способами:

1.  read_context --- возвращает META + BODY

2.  read_context_meta --- возвращает только META

3.  read_context_body --- возвращает только BODY

4.  read_context_link --- читает контекст через ссылку

5.  read_context_links --- возвращает набор контекстов по списку ссылок

Принцип: AI запрашивает минимальный необходимый контекст.
