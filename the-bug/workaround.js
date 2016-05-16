process.env.NODE_PATH = require.main.paths.join(require('path').delimiter)

console.log(process.env.NODE_PATH)

require('./index.js')
