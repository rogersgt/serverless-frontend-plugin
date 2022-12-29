'use strict';
const path = require('path');
const readDir = require('recursive-readdir');
const { readFileSync } = require('fs');
const mimeTypeLib = require('mime-types');
const serverless = require('serverless'); // eslint-disable-line no-unused-vars
const { CloudFormation, S3 } = require('aws-sdk');
const {
  execCmd,
} = require('./lib/child_process');
const { capitalizeFirstLetter } = require('./lib/capitalizeFirstLetter');

const templates = require('./templates');


class ServerlessFrontendPlugin {
  /**
   *
   * @param {serverless} serverless Serverless Instance
   * @param {object} cliOptions serverless CLI options
   * @param {object} serverlessUtils serverless utility tools like log
   */
  constructor(serverless, cliOptions, { log, writeText }) {
    this.serverless = serverless;
    this.name = 'serverless-frontend-plugin';
    this.log = log;
    this.writeText = writeText;

    const awsCredentials = serverless.getProvider('aws').getCredentials();
    const region = this.getRegion();
    this.cfClient = new CloudFormation({ region, ...awsCredentials });
    this.s3Client = new S3({ region, ...awsCredentials });

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
    this.log.debug({ frontendConfig });
    const {
      build = {},
    } = frontendConfig;

    const {
      cwdDir = 'frontend',
      command = ['echo', 'no', 'frontend', 'build', 'command'],
      env = {},
    } = build;

    const cmd = command[0];
    const options = command.splice(1, command.length -1);
    this.log.debug(`Executing cmd: ${cmd} with options: ${options}`);

    await execCmd(cmd, options, cwdDir, env, this.writeText);
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

  generateSecurityHeaderParams() {
    const frontendConfig = this.getConfig();
    const params = [];
    const {
      securityHeadersConfig = null,
    } = frontendConfig;

    const defaultParams = {
      shouldIncludeSecurityHeaders: 'true', // conditionally removes/includes security headers from cloudformation entirely
      shouldIncludeContentSecurity: 'true', // conditionally removes/includes Content-Security-Policy header
      shouldIncludeStrictTransportSecurity: 'true', // conditionally removes/includes Strict-Transport-Security header
      shouldIncludeContentTypeOptions: 'true', // conditionally removes/includes X-Content-Type-Options header
      shouldIncludeFrameOptions: 'true', // conditionally removes/includes X-Frame-Options header
      shouldIncludeReferrerPolicy: 'true', // conditionally removes/includes Referrer-Policy header
      contentSecurityPolicy: `default-src 'self'`,
      contentSecurityPolicyOverride: 'true',
      strictTransportSecurityMaxAge: '63072000',
      strictTransportSecurityIncludeSubdomains: 'true',
      strictTransportSecurityOverride: 'true',
      strictTransportSecurityPreload: 'true',
      contentTypeOptionsOverride: 'true',
      frameOption: 'SAMEORIGIN',
      frameOptionOverride: 'true',
      referrerPolicy: 'same-origin',
      referrerPolicyOverride: 'true',
    };

    if (!securityHeadersConfig) {
      return [{
        ParameterKey: ShouldIncludeSecurityHeaders,
        ParameterValue: 'false',
      }];
    }

    const {
      contentSecurityPolicy,
      contentTypeOptions,
      frameOptions,
      referrerPolicy,
      strictTransportSecurity,
    } = securityHeadersConfig;

    /**
     * Context Security Policy
     */
    if ( contentSecurityPolicy ) {
      const {
        contentSecurityPolicy: userContentSecurityPolicy,
        override: contentSecurityPolicyOverride,
      } = contentSecurityPolicy;

      if (userContentSecurityPolicy) defaultParams.contentSecurityPolicy = userContentSecurityPolicy;
      if ( contentSecurityPolicyOverride === false ) {
        defaultParams.contentSecurityPolicyOverride = contentSecurityPolicyOverride + '';
      }
    } else {
      if ( contentSecurityPolicy !== null ) {
        defaultParams.shouldIncludeContentSecurity = 'false';
      }
    }

    /**
     * Context Type Options
     */
    if ( contentTypeOptions ) {
      const {
        override: contentTypeOptionsOverride,
      } = contentTypeOptions;

      if (contentTypeOptionsOverride === false) defaultParams.contentTypeOptionsOverride = contentTypeOptionsOverride + '';
    } else {
      if ( contentTypeOptions !== null ) {
        defaultParams.shouldIncludeContentTypeOptions = 'false';
      }
    }

    /**
     * Frame Options
     */
    if (frameOptions) {
      const {
        frameOption,
        override: frameOptionOverride,
      } = frameOptions;

      if (frameOption) defaultParams.frameOption = frameOption;
      if (frameOptionOverride === false) defaultParams.frameOptionOverride = frameOptionOverride + '';
    } else {
      if (frameOptions !== null) {
        defaultParams.shouldIncludeFrameOptions = 'false';
      }
    }

    /**
     * Referrer Policy
     */
    if (referrerPolicy) {
      const {
        referrerPolicy: userReferrerPolicy,
        override: referrerPolicyOverride,
      } = referrerPolicy;

      if (userReferrerPolicy) defaultParams.referrerPolicy = userReferrerPolicy;
      if (referrerPolicyOverride === false) defaultParams.referrerPolicyOverride = referrerPolicyOverride + '';
    } else {
      if ( referrerPolicy !== null ) {
        defaultParams.shouldIncludeReferrerPolicy = 'false';
      }
    }

    /**
     * Strict Transport Security
     */
    if (strictTransportSecurity) {
      const {
        accessControlMaxAgeSec,
        includeSubdomains,
        override: strictTransportSecurityOverride,
        preload,
      } = strictTransportSecurity;

      if (accessControlMaxAgeSec) defaultParams.strictTransportSecurityMaxAge = accessControlMaxAgeSec;
      if (includeSubdomains === false) defaultParams.strictTransportSecurityIncludeSubdomains = includeSubdomains + '';
      if (strictTransportSecurityOverride === false) {
        defaultParams.strictTransportSecurityOverride = strictTransportSecurityOverride + '';
      }
      if (preload === false) defaultParams.strictTransportSecurityPreload = preload + '';
    } else {
      if ( strictTransportSecurity !== null ) {
        defaultParams.shouldIncludeStrictTransportSecurity = 'false';
      }
    }

    // defaultParams length = 1 implies a user has not included any security headers
    if (Object.keys(defaultParams).length === 1) {
      defaultParams.shouldIncludeSecurityHeaders = 'false';
    }

    Object.keys(defaultParams).forEach((key, index)=>{
      params.push({
        ParameterKey: capitalizeFirstLetter(key),
        ParameterValue: defaultParams[key],
      });
    });

    return params;
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
      indexDocument = 'index.html',
      errorDocument = 'index.html',
      forbiddenDocument = 'index.html',
    } = bucket;

    const {
      acmCertificateArn,
      dnsName,
      altDnsName = '',
      hostedZoneName,
      mimeTypes = {},
    } = distribution;

    const stackName = this.getStackName();
    const cfClient = this.getCloudFormationClient();
    const bucketName = this.getBucketName();
    const securityHeaderParams = this.generateSecurityHeaderParams();
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
          ParameterKey: 'ForbiddenDocument',
          ParameterValue: forbiddenDocument,
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
        ...securityHeaderParams,
      ],
    };

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

    const frontendFiles = await readDir(distDir);
    const s3Client = this.getS3Client();

    await Promise.all(frontendFiles.map((file) => {
      const key = file
        .replace(path.resolve(`${process.cwd()}/` + distDir), '')
        .replace(`${distDir}/`, '');

      const isHtml = key.match(/.*\.html$/);
      const mimeType = mimeTypeLib.lookup(key);
      const keyPartArr = key.split('.');
      const fileExt = keyPartArr[keyPartArr.length - 1];
      const customMimeType = mimeTypes[fileExt];

      return s3Client.putObject({
        Bucket: bucketName,
        Key: key,
        Body: readFileSync(file),
        CacheControl: `max-age=${isHtml ? 300 : 86400}`,
        ContentDisposition: 'inline',
        ...isHtml && {
          ContentType: 'text/html',
        },
        ...customMimeType && {
          ContentType: customMimeType,
        },
        ...(mimeType && !customMimeType) && { ContentType: mimeType },
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
    this.serverless.addServiceOutputSection('Cloudfront URLs', frontendUrlsArray);
  }

  async deleteClient() {
    const bucketExists = await this.bucketExists();

    if (bucketExists) {
      const bucketName = this.getBucketName();
      const s3Client = this.getS3Client();
      this.log.info(`Removing objects from ${bucketName}...`);

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
      this.log.debug(`Initiating deleteStack() for ${stackName}`);
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
    execCmd(cmd, cmdOpts, cwdDir, env, this.writeText);
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
    return this.serverless.service.custom[this.name].stackName ||
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
