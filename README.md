Node v6.0 and 6.1 have a subtly different module system.

I found this surprising.

I'm told that this is behind a flag in "the next minor", so I guess
it'll be back to normal in 6.2, and hopefully this will go the way of
`NODE_MODULE_CONTEXTS`.  (That is, ignored until it's broken by
accident and eventually removed.)

Here's how it changed.

```
$ node root
v5.6.0
root 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/root/index.js
dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/dep/index.js
conflict-dep 2.0.0 /Users/isaacs/dev/js/node6-module-system-change/conflict-dep-2/index.js
shared-dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/shared-dep/index.js
conflict-dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/conflict-dep-1/index.js

$ node file-link/
file-link 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/file-link/index.js
v5.6.0
root 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/root/index.js
dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/dep/index.js
conflict-dep 2.0.0 /Users/isaacs/dev/js/node6-module-system-change/conflict-dep-2/index.js
shared-dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/shared-dep/index.js
conflict-dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/conflict-dep-1/index.js

$ nave use 6.0

$ node root
v6.0.0
root 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/root/index.js
dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/root/node_modules/dep/index.js
conflict-dep 2.0.0 /Users/isaacs/dev/js/node6-module-system-change/root/node_modules/dep/node_modules/conflict-dep/index.js
shared-dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/root/node_modules/dep/node_modules/shared-dep/index.js
conflict-dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/root/node_modules/conflict-dep/index.js
shared-dep 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/root/node_modules/shared-dep/index.js

$ node file-link/
file-link 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/file-link/index.js
v6.0.0
root 1.0.0 /Users/isaacs/dev/js/node6-module-system-change/file-link/node_modules/root/index.js
module.js:440
    throw err;
    ^

Error: Cannot find module './package.json'
    at Function.Module._resolveFilename (module.js:438:15)
    at Function.Module._load (module.js:386:25)
    at Module.require (module.js:466:17)
    at require (internal/module.js:20:19)
    at Object.<anonymous> (/Users/isaacs/dev/js/node6-module-system-change/file-link/node_modules/dep.js:1:82)
    at Module._compile (module.js:541:32)
    at Object.Module._extensions..js (module.js:550:10)
    at Module.load (module.js:456:32)
    at tryModuleLoad (module.js:415:12)
    at Function.Module._load (module.js:407:3)
```

Symbolic links are no longer resolved to their `realpath` in the
cache.  The `main` module is still resolved to its real path, though.

So, in first test, where `root` is the main module, it loads files
with a different `__filename` value, and loads modules multiple times
if they are symlinked to multiple places.  This is a significant
behavior change, and very subtle, but ?probably? will "only" result in
programs being less efficient.  (I would not bet on this changing
having no impact on the correctness of programs, however.)

In the second case, when a *file* is symlinked into the `node_modules`
folder, this breaks entirely where it used to work.
