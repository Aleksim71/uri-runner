A19 write-path fix

Причина бага:
- run-browser-diagnostics.cjs передавал в writeBrowserArtifacts() только второй аргумент io
- при runtime-вызове artifactsDir передавался в input, а не в io
- из-за этого writer получал пустой artifactsDir и возвращал artifacts_dir_required

Что исправлено:
- добавлен pickArtifactsDir(input, io)
- приоритет путей:
  1. io.artifactsDir
  2. input.artifactsDir
  3. input.outputDir
- добавлены unit tests для input.artifactsDir и outputDir alias
