const fs = require('fs')
const path = require('path')
const { app } = require('electron')

let logPath = ''
let logStream = null

function initLogger() {
  const logDir = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  logPath = path.join(logDir, `app-${dateStr}.log`)

  logStream = fs.createWriteStream(logPath, { flags: 'a' })

  log('INFO', '=== Logger initialized ===')
  log('INFO', `Log file: ${logPath}`)
  log('INFO', `App version: ${app.getVersion()}`)
  log('INFO', `Platform: ${process.platform} ${process.arch}`)
  log('INFO', `Electron: ${process.versions.electron}`)
  log('INFO', `Node: ${process.versions.node}`)
}

function log(level, message, ...args) {
  const timestamp = new Date().toISOString()
  let line = `[${timestamp}] [${level}] ${message}`

  if (args.length > 0) {
    for (const arg of args) {
      if (typeof arg === 'object') {
        try {
          line += ' ' + JSON.stringify(arg)
        } catch (e) {
          line += ' ' + String(arg)
        }
      } else {
        line += ' ' + String(arg)
      }
    }
  }

  console.log(line)

  if (logStream) {
    logStream.write(line + '\n')
  }
}

function info(message, ...args) {
  log('INFO', message, ...args)
}

function warn(message, ...args) {
  log('WARN', message, ...args)
}

function error(message, ...args) {
  log('ERROR', message, ...args)
}

function getLogPath() {
  return logPath
}

function getLogDir() {
  return path.dirname(logPath)
}

module.exports = {
  initLogger,
  info,
  warn,
  error,
  log,
  getLogPath,
  getLogDir,
}
