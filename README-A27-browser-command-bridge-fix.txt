# path: README-A27-browser-command-bridge-fix.txt

Что найдено:
- materialized browser.flow идёт через command-dispatcher в run-plan
- browser.session.start вызывался без params.sessionId
- execute-browser-session-start-step.cjs брал sessionId только из params.sessionId
- из-за этого создавался auto-generated sessionId, а не "s1"
- затем browser.page.open искал session "s1" и падал с:
  Browser session not found: s1

Дополнительно:
- command-dispatcher для browser.page.open передаёт `path`, а не `input`
- поэтому execute-browser-page-open-step.cjs теперь поддерживает и legacy ctx.path, и modern ctx.input

Что чинит патч:
1. session.start теперь умеет брать sessionId из input.sessionId
2. fallback environment также протаскивает endpoint
3. page.open теперь понимает legacy bridge через ctx.path
4. после open обновляется session runtime/openedAt

После применения:
- session.start должен создать session именно под ключом s1
- page.open должен найти эту session
