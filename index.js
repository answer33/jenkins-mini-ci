const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');

const mygit = simpleGit();
const Ci = require('./lib');

/**
 * 获取node命令行参数
 * @param {array} options 命令行数组
 */
function getEnvParams(options) {
  let envParams = {};
  // 从第三个参数开始,是自定义参数
  for (let i = 2, len = options.length; i < len; i++) {
    let arg = options[i].split('=');
    envParams[arg[0]] = arg[1];
  }
  return envParams;
}

const gitUrlMap = {
  datav: 'https://gitee.com/answermomo/datav-mini.git',
};

const branchMap = {
  dev: 'develop',
  pre: 'pre',
};

const robotMap = {
  dev: 1,
  pre: 2,
};

const { env, branch, projectName } = getEnvParams(process.argv);
const repoPath = path.join('./', 'repo');

if (!projectName) {
  console.error('项目名称不能为空!!!');
  process.exit(1);
}

if (fs.existsSync(repoPath)) {
  fs.rmdirSync(repoPath, { recursive: true });
}

/**
 * 预览、上传
 */
const build = () => {
  const project = new Ci({
    env,
    robot: robotMap[env],
  });
  if (env === 'dev') {
    project.preview({
      qr: 'image',
    });
  } else {
    project.upload();
  }
};

const run = async () => {
  const command = 'npm install';
  await mygit.clone(gitUrlMap[projectName], './repo', {
    '--branch': branch || branchMap[env],
  });
  //进入repo目录安装小程序项目代码依赖
  spawnSync(command, { cwd: repoPath, shell: true, stdio: 'inherit' });
  build();
};

run();
