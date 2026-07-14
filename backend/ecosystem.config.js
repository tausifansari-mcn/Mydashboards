module.exports = {
  apps: [
    {
      name: 'mydash-backend',
      script: 'dist/app.js',
      cwd: 'C:\\Users\\MAS60358\\Desktop\\My Dashboards zip\\My Dashboards\\backend',
      watch: false,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
