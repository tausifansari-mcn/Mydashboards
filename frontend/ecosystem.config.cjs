module.exports = {
  apps: [
    {
      name: 'mydash-frontend',
      script: '../node_modules/vite/bin/vite.js',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
    },
  ],
};
