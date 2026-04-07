// path: test/real/fixtures/db/migration-success.js
console.log('migration start');
setTimeout(() => console.log('migration step 1'), 300);
setTimeout(() => console.log('migration step 2'), 700);
setTimeout(() => {
  console.log('migration done');
  process.exit(0);
}, 1200);
