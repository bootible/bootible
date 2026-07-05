# bootible E2E harness

Run from an **elevated** pwsh:

```
cp test/e2e/e2e.config.example.json test/e2e/e2e.config.json
```

then

```
npm run test:e2e -- --kind payload-validate
```

(no VM) or

```
npm run test:e2e -- --vm bazzite
```

(needs ti + elevation).
