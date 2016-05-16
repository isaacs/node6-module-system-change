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

## The bug being fixed

The "bug" being addressed by the change to the module system is this:

If a module is symbolically linked into a `node_modules` folder along
with one or more peer dependencies, then they will not be able to find
the "root" module to attach onto.

You can demonstrate this by running:

```
$ node the-bug
module.js:341
    throw err;
    ^

Error: Cannot find module 'peer-dep'
    at Function.Module._resolveFilename (module.js:339:15)
    at Function.Module._load (module.js:290:25)
    at Module.require (module.js:367:17)
    at require (internal/module.js:16:19)
    at Object.<anonymous> (/Users/isaacs/dev/js/node6-module-system-change/peer-user-1/index.js:1:63)
    at Module._compile (module.js:413:34)
    at Object.Module._extensions..js (module.js:422:10)
    at Module.load (module.js:357:32)
    at Function.Module._load (module.js:314:12)
    at Module.require (module.js:367:17)

$ nave use 6

$ node the-bug
{ filename: '/Users/isaacs/dev/js/node6-module-system-change/the-bug/node_modules/peer-dep/index.js',
  one: 1,
  two: 2 }
```

I am not convinced that this is a bug, rather than merely a limitation
of what the node module system can do.  Nevertheless, it can be worked
around easily, and fixed in a less hazardous manner.

### Workaround: `NODE_PATH` environment variable

```
$ NODE_PATH=$PWD/the-bug/node_modules node the-bug
{ filename: '/Users/isaacs/dev/js/node6-module-system-change/peer-dep/index.js',
  one: 1,
  two: 2 }
```

### Proposal: Add `require.main.paths` to all module lookup paths

This patch should do it:

```diff
diff --git a/lib/module.js b/lib/module.js
index 82b1971..45d8e66 100644
--- a/lib/module.js
+++ b/lib/module.js
@@ -230,6 +230,11 @@ Module._resolveLookupPaths = function(request, parent) {
       paths = parent.paths.concat(paths);
     }
 
+    if (process.mainModule && parent !== process.mainModule) {
+      if (!process.mainModule.paths) process.mainModule.paths = [];
+      paths = paths.concat(process.mainModule.paths);
+    }
+
     // Maintain backwards compat with certain broken uses of require('.')
     // by putting the module's directory in front of the lookup paths.
     if (request === '.') {

```

I'm not sure if this is a good idea!  It might be bad!  It could
load things that you don't want loaded, but at least it'd only happen
as a *lower* priority lookup than the other established behavior that
the module ecosystem has come to rely on.

### Proposal: Add `module.parent.paths` to module lookup paths

Even shorter patch:

```diff
diff --git a/lib/module.js b/lib/module.js
index 82b1971..f2d82a0 100644
--- a/lib/module.js
+++ b/lib/module.js
@@ -230,6 +230,10 @@ Module._resolveLookupPaths = function(request, parent) {
       paths = parent.paths.concat(paths);
     }
 
+    if (parent && parent.parent && parent.parent.paths) {
+      paths = paths.concat(parent.parent.paths);
+    }
+
     // Maintain backwards compat with certain broken uses of require('.')
     // by putting the module's directory in front of the lookup paths.
     if (request === '.') {

```

This would handle the case where a module with some peer dependencies
is not installed in the `node_modules` of the `main` module's root.
So, for example, if a module loaded `the-bug` as a dep, deep in a
`node_modules` heirarchy <del>(which would require a very *interesting*
hybrid package management strategy!)</del>, then this would ensure that
modules always have their parent's lookup paths.

**UPDATE**: Actually the package layout strategy wouldn't have to be
all that interesting.  If you have a pnpm/ied-style symlink-based
system, then a nested peer-dep needs to have a lookup path that has
paths not in the main module's set.

However, this gets pretty long pretty fast!  Probably you'd want to do
some de-duping, so that you don't have a 100,000 item list of folders
to search, most of which would be the same folders.

Longer patch:

```diff
diff --git a/lib/module.js b/lib/module.js
index 82b1971..1fb6a1f 100644
--- a/lib/module.js
+++ b/lib/module.js
@@ -230,6 +230,14 @@ Module._resolveLookupPaths = function(request, parent) {
       paths = parent.paths.concat(paths);
     }
 
+    if (parent && parent.parent && parent.parent.paths) {
+      for (var p = 0; p < parent.parent.paths.length; p++) {
+        if (paths.indexOf(parent.parent.paths[p]) === -1) {
+          paths.push(parent.parent.paths[p]);
+        }
+      }
+    }
+
     // Maintain backwards compat with certain broken uses of require('.')
     // by putting the module's directory in front of the lookup paths.
     if (request === '.') {

```
