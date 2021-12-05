# serverless-frontend-plugin
Package and deploy any frontend with your serverless backend.

## Installation
```bash
npm install --save-dev serverless-frontend-plugin
```

## Implementation
* Include this plugin in the `plugins` section of your `severless.yml`.
```YAML
plugins:
  - serverless-frontend-plugin
```

* Add your frontend build commands and set the working directory by adding the following to the `custom` section of your `serverless.yml`:
```YAML
custom:
  serverless-frontend-plugin:
    distDir: frontend/dist
    build:
      cwdDir: frontend
      command:
        - npm
        - run
        - build
```

## Options
* `distDir`: (<string>) The directory that gets uploaded and hosted as a static site. Defaults to `frontend/dist`.
* `build`: (<Map>)
  * `command`: (<string>[]) Command and options as an array of strings. For example, `["npm", "run", "build"]` Defaults to `["echo", "no", "command"]`.
  * `cwdDir`: (<string>) The directory from which to run the `build.command`. Defaults to `./frontend`.
* `stackName`: (<string>) Name of the CloudFormation stack for the frontend. Defaults to `<service-name>-<stage>-<region>`.
* `bucket`: (<Map>)
  * `name`: (<string>) Name of the S3 Bucket to upload the `distDir` to. Defaults to a generated name.
  * `existing`: (<boolean>) Set to `true` if you want to use an existing S3 bucket instead of having the plugin create one for you.
  * `indexDocument`: (<string>) Defaults to `index.html`.
  * `errorDocument`: (<string>) Defaults to `index.html`.
* `distribution`: (<Map>)
  * `aliases`: (<string>[] *Required*) Array of DNS names to use for this Cloudfront distribution. This is required and has no default values.
  * `acmCertificateArn`: (<string>, *Required*) AWS ACM Certificate Arn that covers the domain names listed in `aliases`.
