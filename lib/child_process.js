const {
  spawn,
} = require('child_process');

const {
  env: processEnv,
  cwd,
} = process;

const CWD = cwd();

function execCmd(cmd = '', cmdArgs = [], cwd = CWD, env = {}, logger) {
  return new Promise((res, rej) => {
    const proc = spawn(cmd, cmdArgs, {
      cwd,
      env: {
        ...processEnv,
        ...env,
      },
    });

    proc.stdout.on('data', (stdout) => {
      logger.info(stdout.toString());
    });

    proc.on('error', (e) => {
      logger.debug(e);
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
