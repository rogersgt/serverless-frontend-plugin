'use strict';

const {
  spawn,
} = require('child_process');

function execCmd(cmd = '', cmdArgs = [], cwd = '.', logFunc = console.log) {
  return new Promise((res, rej) => {
    const proc = spawn(cmd, cmdArgs, { cwd });
    proc.stdout.on('data', (stdout) => {
      logFunc(stdout.toString());
    });

    /* stderr is mistakenly picking up webpack stdout */
    // proc.stderr.on('data', (err) => {
    //   rej(err.toString());
    // });

    proc.on('close', (code) => {
      if (code > 0) {
        rej(`command: ${cmd} exited with exit code ${code}`);
      } else {
        res(code);
      }
    })
  })
}

class ServerlessFrontendPlugin {
  name = 'serverless-frontend-plugin';

  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = {
      'before:package:finalize': this.buildClient.bind(this),
    };
  }

  async buildClient() {
    this.serverless.cli.log('Checking for frontend build commands...');
    const frontendConfig = this.serverless.service.custom[this.name] || {};
    const {
      distDir = 'client/dist',
      build = {},
    } = frontendConfig;

    const {
      cwdDir = 'client',
      command = ['npm', 'run', 'build'],
    } = build;

    const cmd = command[0];
    const options = command.splice(1, command.length -1);
    this.serverless.cli.log(`Building frontend using: ${cmd} ${options.join(' ')}`);

    await execCmd(cmd, options, cwdDir, this.serverless.cli.log);

    this.serverless.cli.log('Done.');
  }
}

module.exports = ServerlessFrontendPlugin;
