const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "aster-frontend",
      cwd: path.join(REPO_ROOT, "aster"),
      script: "npm",
      args: "run start -- -p 3001",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      max_restarts: 10,
      restart_delay: 3000,
      out_file: path.join(REPO_ROOT, "deploy", "logs", "frontend-out.log"),
      error_file: path.join(REPO_ROOT, "deploy", "logs", "frontend-error.log"),
    },
    {
      name: "aster-server",
      cwd: path.join(REPO_ROOT, "Server"),
      script: "cmd/Server/Server.js",
      env: {
        NODE_ENV: "production",
        PORT: "5000",
      },
      max_restarts: 10,
      restart_delay: 3000,
      out_file: path.join(REPO_ROOT, "deploy", "logs", "server-out.log"),
      error_file: path.join(REPO_ROOT, "deploy", "logs", "server-error.log"),
    },
  ],
};
