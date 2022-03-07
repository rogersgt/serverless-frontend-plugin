const {
  spawn,
} = require('child_process');
const { existsSync } = require('fs');

const {
  env: processEnv,
  cwd,
} = process;

const CWD = cwd();

function execCmd(cmd = '', cmdArgs = [], cwd = CWD, env = {}, logFunc = console.log, errorLogFunc = console.error) {
  return new Promise((res, rej) => {
    const execDir = existsSync(cwd) ? cwd : CWD;
    const spawnOptions = {
      cwd: execDir,
      env: {
        ...processEnv,
        ...env,
      },
    };
    const proc = spawn(cmd, cmdArgs, spawnOptions);

    proc.stdout.on('data', (stdout) => {
      logFunc(stdout.toString());
    });

    proc.on('error', (e) => {
      errorLogFunc(e);
      return rej(e);
    });

    proc.on('close', (code) => {
      if (code > 0) {
        rej(`command: ${cmd} exited with exit code ${code}`);
      } else {
        res(code);
      }
    })
  })
}

module.exports = {
  execCmd,
};
