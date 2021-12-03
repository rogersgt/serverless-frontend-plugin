'use strict';
const readDir = require('recursive-readdir');
const { readFileSync, fstat } = require('fs');
const { CloudFormation, S3 } = require('aws-sdk');
const {
  execCmd,
} = require('./lib/child_process');

const defaultTemplate = require('./cloudformation-templates/default.json');

class ServerlessFrontendPlugin {
  name = 'serverless-frontend-plugin';

  constructor(serverless) {
    this.serverless = serverless;

    const region = this.getRegion();
    this.cfClient = new CloudFormation({ region });
    this.s3Client = new S3({ region });

    this.hooks = {
      'before:package:finalize': this.buildClient.bind(this),
      'before:deploy:deploy': this.deployClient.bind(this),
    };
  }

  async buildClient() {
    this.serverless.cli.log('Checking for frontend build commands...');
    const frontendConfig = this.getConfig();
    const {
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

  async deployClient() {
    const frontendConfig = this.getConfig();
    const {
      distDir = 'frontend/dist',
      bucket = {},
    } = frontendConfig;

    const {
      name = `${this.serverless.service.service}`,
      existing = false,
      indexDocument = 'index.html',
      errorDocument = 'index.html',
    } = bucket;

    const stackName = this.getStackName();
    const cfClient = this.getCloudFormationClient();

    const stackExists = await this.stackExists();
    const cfParams = {
      StackName: stackName,
      TemplateBody: JSON.stringify(defaultTemplate),
      Parameters: [
        {
          ParameterKey: 'Stage',
          ParameterValue: this.serverless.service.provider.stage,
        },
        {
          ParameterKey: 'ServiceName',
          ParameterValue: this.serverless.service.service,
        },
        {
          ParameterKey: 'BucketName',
          ParameterValue: name,
        },
      ],
    };

    if (!stackExists) {
      await cfClient.createStack(cfParams).promise();
    } else {
      await cfClient.updateStack(cfParams).promise();
    }

    await this.waitForStackComplete();

    const frontendFiles = await readDir(distDir);
    const s3Client = this.getS3Client();
    await Promise.all(frontendFiles.map(file => {
      this.serverless.cli.log(`Uploading ${file} to ${name}`);
      return s3Client.putObject({
        Bucket: name,
        Key: file,
        Body: readFileSync(file),
      }).promise()
    }));

    this.serverless.cli.log(`frontend stack name: ${stackName} finished deploying.`);
  }

  getConfig() {
    return this.serverless.service.custom[this.name] || {};
  }

  /**
   * 
   * @returns {CloudFormation} CloudFormation Client
   */
  getCloudFormationClient() {
    return this.cfClient;
  }

  /**
   * 
   * @returns {S3} S3 Client
   */
  getS3Client() {
    return this.s3Client;
  }

  getRegion() {
    return this.serverless.service.provider.region || process.env.AWS_REGION;
  }

  getStackName() {
    return this.serverless.service.provider.stackName 
      || `${this.serverless.service.service}-${this.serverless.service.provider.stage}-${this.getRegion()}`;
  }

  async stackExists() {
    const cfClient = this.getCloudFormationClient();
    try {
      await cfClient.describeStacks({
        StackName: this.getStackName(),
      }).promise();
      return true;
    } catch (error) {
      // this.serverless.cli.log(error.message);
      return false;
    }
  }

  async waitForStackComplete() {
    const stackName = this.getStackName();
    const cfClient = this.getCloudFormationClient();
    const { Stacks: stacks } = await cfClient.describeStacks({ StackName: stackName }).promise();
    const { StackStatus: status } = stacks.pop();
    this.serverless.cli.log(`${stackName} status: ${status}`);

    if (status.match(/(FAILED|ROLLBACK)/)) {
      throw new Error(`serverless-frontend-plugin stack: ${stackName} failed with a status of ${status}`);
    }

    if (status.match(/(COMPLETE)/)) {
      return null;
    }

    await new Promise(res => setTimeout(res, 3000));
    return this.waitForStackComplete();
  }
}

module.exports = ServerlessFrontendPlugin;
