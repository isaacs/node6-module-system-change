console.log(process.version)
console.log('root', require('./package.json').version, __filename)
var dep = require('dep')
var conflict = require('conflict-dep')
var shared = require('shared-dep')