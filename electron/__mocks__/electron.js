const os = require('os')

module.exports = {
  app: {
    getPath: (name) => {
      if (name === 'userData') {
        return `${os.tmpdir()}/lingyin-test-db`
      }
      return `${os.tmpdir()}/lingyin-test`
    },
  },
}