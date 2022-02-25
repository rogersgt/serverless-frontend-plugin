'use strict';
const readDir = require('recursive-readdir');
const { readFileSync } = require('fs');
const serverless = require('serverless'); // eslint-disable-line no-unused-vars
const { CloudFormation, S3 } = require('aws-sdk');
const {
  execCmd,
} = require('./lib/child_process');

const templates = require('./templates');

class ServerlessFrontendPlugin {
  /**
   *
   * @param {serverless} serverless Serverless Instance
   * @param {object} cliOptions serverless CLI options
   * @param {object} serverlessUtils serverless utility tools like log
   */
  constructor(serverless, cliOptions, serverlessUtils) {
    this.serverless = serverless;
    this.name = 'serverless-frontend-plugin';
    this.log = serverlessUtils.log;

    const region = this.getRegion();
    this.cfClient = new CloudFormation({ region });
    this.s3Client = new S3({ region });

    this.hooks = {
      'before:package:finalize': this.buildClient.bind(this),
      'before:deploy:deploy': this.deployClient.bind(this),
      'before:remove:remove': this.deleteClient.bind(this),
      'offline:start:init': this.dev.bind(this),
    };
  }

  async buildClient() {
    this.log.info('Checking for frontend build commands...');
    const frontendConfig = this.getConfig();
    const {
      build = {},
    } = frontendConfig;

    const {
      cwdDir = 'client',
      command = ['echo', 'no', 'frontend', 'build', 'command'],
      env = {},
    } = build;

    const cmd = command[0];
    const options = command.splice(1, command.length -1);
    this.log.debug(`Executing cmd: ${cmd} with options: ${options}`);

    await execCmd(cmd, options, cwdDir, env, this.log);
  }

  async bucketExists() {
    const bucketName = this.getBucketName();
    const s3Client = this.getS3Client();

    try {
      await s3Client.headBucket({ Bucket: bucketName }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  async deployClient() {
    const frontendConfig = this.getConfig();
    const {
      distDir = 'frontend/dist',
      bucket = {},
      distribution = {},
      mode = 'cloudfront',
    } = frontendConfig;

    const {
      existing = false,
      indexDocument = 'index.html',
      errorDocument = 'index.html',
    } = bucket;

    const {
      acmCertificateArn,
      dnsName,
      altDnsName = '',
      hostedZoneName,
    } = distribution;

    const stackName = this.getStackName();
    const cfClient = this.getCloudFormationClient();
    const bucketName = this.getBucketName();

    const stackExists = await this.stackExists();
    const cfParams = {
      StackName: stackName,
      TemplateBody: JSON.stringify(templates[mode]),
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
          ParameterValue: bucketName,
        },
        {
          ParameterKey: 'IndexDocument',
          ParameterValue: indexDocument,
        },
        {
          ParameterKey: 'ErrorDocument',
          ParameterValue: errorDocument,
        },
        {
          ParameterKey: 'DnsName',
          ParameterValue: dnsName,
        },
        {
          ParameterKey: 'AltDnsName',
          ParameterValue: altDnsName,
        },
        {
          ParameterKey: 'AcmCertificateArn',
          ParameterValue: acmCertificateArn,
        },
        {
          ParameterKey: 'HostedZoneName',
          ParameterValue: hostedZoneName || dnsName,
        },
      ],
    };

    if (!existing) {
      if (!stackExists) {
        await cfClient.createStack(cfParams).promise();
      } else {
        await cfClient.updateStack(cfParams).promise()
          .catch((e) => {
            if (e.message.match(/No updates are to be performed/)) {
              return Promise.resolve();
            }
            throw e;
          });
      }

      await this.waitForStackComplete();
    }

    const frontendFiles = await readDir(distDir);
    const s3Client = this.getS3Client();

    await Promise.all(frontendFiles.map((file) => {
      const filePathArr = file.split('/');
      const key = filePathArr[filePathArr.length - 1];

      const isIndexhtml = key === 'index.html';

      return s3Client.putObject({
        Bucket: bucketName,
        Key: key,
        Body: readFileSync(file).toString('binary'),
        CacheControl: `max-age=${isIndexhtml ? 300 : 86400}`,
      }).promise();
    }));

    this.log.debug(`frontend stack name: ${stackName} finished deploying.`);
    const outputs = await this.getStackOutputs();
    const formattedOutputsObj = outputs.reduce((prev, output) => {
      const {
        OutputKey: key,
        OutputValue: val,
      } = output;
      prev[key] = val;
      return prev;
    }, {});

    const frontendUrlsArray = formattedOutputsObj.FrontendUrls.split(',');

    this.log.info(`

      -------- Serverless Frontend Plugin -------
      URLs: ${JSON.stringify(frontendUrlsArray)}

    `);
  }

  async deleteClient() {
    const bucketExists = await this.bucketExists();

    if (bucketExists) {
      const bucketName = this.getBucketName();
      const s3Client = this.getS3Client();
      this.serverless.cli.log(`Removing objects from ${bucketName}...`);

      let existingItems = true;
      let nextMarker;

      while (existingItems) {
        const {
          IsTruncated,
          Contents,
          Marker,
        } = await s3Client.listObjects({
          Bucket: bucketName,
          ...nextMarker && { Marker: nextMarker },
        }).promise();

        await s3Client.deleteObjects({
          Bucket: bucketName,
          Delete: {
            Objects: Contents.map(({ Key }) => ({ Key })),
          },
        }).promise();

        nextMarker = Marker;
        existingItems = !IsTruncated && !!Marker;
      }
    }

    const stackName = this.getStackName();
    const stackExists = await this.stackExists();
    if (stackExists) {
      this.serverless.cli.log(`Initiating deleteStack() for ${stackName}`);
      await this.cfClient.deleteStack({
        StackName: stackName,
      }).promise();
    }
  }

  dev() {
    const {
      offline = {},
    } = this.getConfig();
    const {
      env = {},
      command = ['echo', 'no', 'frontend', 'offline', 'command'],
      cwdDir = 'frontend',
    } = offline;
    const cmd = command[0];
    const cmdOpts = command.splice(1, command.length - 1);
    execCmd(cmd, cmdOpts, cwdDir, env, this.serverless.cli.log);
  }

  getBucketName() {
    const { bucket = {} } = this.getConfig();
    const { stage } = this.serverless.service;
    return bucket.name || `${this.serverless.service.service}${!!stage ? `-${stage}` : ''}-${this.getRegion()}`;
  }

  getConfig() {
    return this.serverless.service.custom[this.name] || {};
  }

  /**
   *
   * @return {CloudFormation} CloudFormation Client
   */
  getCloudFormationClient() {
    return this.cfClient;
  }

  /**
   *
   * @return {S3} S3 Client
   */
  getS3Client() {
    return this.s3Client;
  }

  getRegion() {
    return this.serverless.service.provider.region || process.env.AWS_REGION;
  }

  getStackName() {
    return this.serverless.service.provider.stackName ||
      `${this.serverless.service.service}-${this.serverless.service.provider.stage}-frontend`;
  }

  async getStackOutputs() {
    const stackName = this.getStackName();
    const cfClient = this.getCloudFormationClient();
    const { Stacks: stacks } = await cfClient.describeStacks({ StackName: stackName }).promise();
    const { Outputs: outputs } = stacks.pop();
    return outputs;
  }

  async stackExists() {
    const cfClient = this.getCloudFormationClient();
    try {
      await cfClient.describeStacks({
        StackName: this.getStackName(),
      }).promise();
      return true;
    } catch (error) {
      return false;
    }
  }

  async waitForStackComplete() {
    const stackName = this.getStackName();
    this.log.info(`Deploying frontend stack: ${stackName}`);

    const cfClient = this.getCloudFormationClient();
    const { Stacks: stacks } = await cfClient.describeStacks({ StackName: stackName }).promise();
    const { StackStatus: status, StackStatusReason: message } = stacks.pop();
    this.log.debug(`${stackName} status: ${status}`);

    if (status.match(/(FAILED|ROLLBACK)/)) {
      // eslint-disable-next-line max-len
      const errMessage = `serverless-frontend-plugin stack: ${stackName} failed with a status of ${status} due to: ${message}`;
      throw new Error(errMessage);
    }

    if (status.match(/(COMPLETE)/)) {
      return null;
    }

    await new Promise((res) => setTimeout(res, 3000));
    return this.waitForStackComplete();
  }
}

module.exports = ServerlessFrontendPlugin;
