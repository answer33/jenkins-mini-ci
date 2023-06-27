import fs from 'fs';
import path from 'path';
import { packNpm, preview, Project, upload } from 'miniprogram-ci';

import { MiniProgramCI } from 'miniprogram-ci/dist/@types/types';
import { getLastCommitLog } from './util';

import ICompileSettings = MiniProgramCI.ICompileSettings;

type QrType = 'base64' | 'image' | 'terminal';

type robot =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30;

interface Options {
  workspace: string;
  env: string;
  version: string;
  desc: string;
  type: MiniProgramCI.ProjectType;
  qr?: QrType;
  qrDest?: string;
  robot: robot;
}

interface ProjectConfig {
  appid: string;
  miniprogramRoot: string;
  setting: ICompileSettings;
  compileType: string;
}

interface UploadOptions {
  proxy?: string;
}

interface PreviewOptions {
  qr: QrType;
  qrDest: string;
  proxy?: string;
  pagePath?: string;
  searchQuery?: string;
}

function fsExistsSync(path: string) {
  try {
    // @ts-ignore
    fs.accessSync(path, fs.F_OK);
  } catch (e) {
    return false;
  }
  return true;
}

class Ci {
  private version: string;

  public workspace: string = '';

  public project: Project | undefined;

  public projectConfig: ProjectConfig | undefined;

  private desc: string;

  private env: string | undefined;

  private robot: robot;

  constructor(opts: Options) {
    const { workspace = './repo', type = 'miniProgram', version = '1.0.0', desc = './', env, robot = 1 } = opts;

    this.workspace = workspace;
    this.version = version;
    this.desc = desc;
    this.env = env;
    this.robot = robot;
    if (this.loadProjectConfig(path.join(workspace, 'project.config.json')) && this.projectConfig) {
      this.project = new Project({
        appid: this.projectConfig.appid,
        type: type,
        projectPath: workspace,
        privateKeyPath: path.join('./pk', `private.${this.projectConfig.appid}.key`),
        ignores: ['node_modules/**/*'],
      });
    }
  }

  private loadProjectConfig(configPath: string): boolean {
    if (this.isFileExist(configPath)) {
      try {
        const jsonString = fs.readFileSync(configPath);

        const config = JSON.parse(jsonString.toString());

        this.projectConfig = {
          appid: config.appid,
          miniprogramRoot: config.miniprogramRoot,
          setting: config.setting ? { ...config.setting, es7: !!config.setting.enhance } : {},
          compileType: config.compileType,
        };

        return true;
      } catch (error) {
        console.log('Load file failed');
        console.log(error);
        return false;
      }
    }

    return false;
  }

  private isFileExist(file: string) {
    return fsExistsSync(file);
  }

  public async getTitleFromGit(): Promise<{ version: string; desc: string }> {
    let version = this.version || process.env.npm_package_version || '';
    let desc = this.desc;
    let envDesc = this.env ? `env: ${this.env}` : '';

    if (!version) {
      try {
        // eslint-disable-next-line global-require,import/no-dynamic-require
        const pkg = require(path.resolve(this.workspace, 'package.json'));

        version = pkg.version;
      } catch (error) {
        version = '0.0.0';
        console.error('Load package.json failed');
        console.error(error);
      }
    }

    try {
      const latestCommit = await getLastCommitLog(this.workspace);

      const hash = `(${latestCommit.hash.substring(0, 7)})`;

      if (this.env) {
        version = `${version}.${this.env}`;
      }

      // 没有desc时使用提交信息
      desc = `${envDesc} ${desc || latestCommit.message + hash}`;
    } catch (e) {
      if (this.env) {
        version = `${version}.${this.env}`;
      }

      desc = `${envDesc} ${this.desc}`;
    }

    return {
      version,
      desc,
    };
  }

  private relsoveQrPath(qrcodeFormat: QrType | undefined, qrcodeOutputDest: string | undefined): string {
    if (qrcodeFormat === 'base64' || qrcodeFormat === 'image') {
      return path.join(this.workspace, qrcodeOutputDest || 'preview.png');
    }

    return '';
  }

  public async upload(opts: UploadOptions) {
    if (this.project) {
      const info = await this.getTitleFromGit();
      try {
        await packNpm(this.project);
        const uploadResult = await upload({
          project: this.project,
          version: info.version,
          desc: info.desc,
          setting: this.projectConfig ? this.projectConfig.setting : {},
          onProgressUpdate: function() {},
          // @ts-ignore
          proxy: opts.proxy || '',
          robot: this.robot,
        });
      } catch (error) {
        console.error(error);
        process.exit(1);
      }
    }
  }

  public async preview(opts: PreviewOptions) {
    if (this.project) {
      const info = await this.getTitleFromGit();

      try {
        await packNpm(this.project);
        const previewResult = await preview({
          project: this.project,
          version: info.version,
          desc: info.desc,
          setting: this.projectConfig ? this.projectConfig.setting : {},
          qrcodeFormat: opts.qr,
          qrcodeOutputDest: this.relsoveQrPath(opts.qr, opts.qrDest),
          onProgressUpdate: function() {},
          pagePath: opts.pagePath,
          searchQuery: opts.searchQuery, // 这里的`&`字符在命令行中应写成转义字符`\&`
          // @ts-ignore
          proxy: opts.proxy || '',
          robot: this.robot,
        });
      } catch (e) {
        process.exit(1);
      }
    }
  }
}

module.exports = Ci;
