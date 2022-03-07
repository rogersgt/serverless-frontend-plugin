const {
  spawn,
} = require('child_process');

const {
  env: processEnv,
} = process;

function execCmd(cmd = '', cmdArgs = [], cwd = '.', env = {}, logFunc = console.log) {
  return new Promise((res, rej) => {
    const proc = spawn(cmd, cmdArgs, {
      cwd,
      env: {
        ...processEnv,
        ...env,
      },
    });

    proc.stdout.on('data', (stdout) => {
      logFunc(stdout.toString());
    });

    proc.on('error', (err) => rej(err));

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
