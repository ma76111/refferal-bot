module.exports = {
  apps: [
    {
      name: 'telegram-bot',
      script: './index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production'
      },
      restart_delay: 3000,
      max_restarts: 10,
      watch: false
    },
    {
      name: 'web-server',
      script: './web/server/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production'
      },
      restart_delay: 3000,
      max_restarts: 10,
      watch: false
    }
  ]
}
