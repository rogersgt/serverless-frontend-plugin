const {
  spawn,
} = require('child_process');

function execCmd(cmd = '', cmdArgs = [], cwd = '.', logFunc = console.log) {
  return new Promise((res, rej) => {
    const proc = spawn(cmd, cmdArgs, { cwd });
    proc.stdout.on('data', (stdout) => {
      logFunc(stdout.toString());
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
