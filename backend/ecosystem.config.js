module.exports = {
  apps: [
    {
      name: 'mydash-backend',
      script: 'dist/app.js',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
