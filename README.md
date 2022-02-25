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
    distribution:
      acmCertificateArn: <your certificate arn>
      dnsName: <your-domain.com> # Route53 record value
      altDnsName: <another.your-domain.com> # Route53 record value
      hostedZoneName: <your-domain.com> # Route53 Hosted Zone Name
```

## Options
* `mode`: (*string*) Type of frontend hosting. Currently the only supported mode is `cloudfront`.
* `distDir`: (*string*) The directory that gets uploaded and hosted as a static site. Defaults to `frontend/dist` if the directory exists.
* `build`: (*Map*)
  * `command`: (*string*[]) Command and options as an array of strings. For example, `["npm", "run", "build"]` Defaults to `["echo", "no", "frontend", "build", "command"]`.
  * `cwdDir`: (*string*) The directory from which to run the `build.command`. Defaults to `./frontend` if the directory exists.
  * `env`: (*Map*) A key/value mapping of environment variables and values to inject into the frontend build.
* `stackName`: (*string*) Name of the CloudFormation stack for the frontend. Defaults to `<service-name>-<stage>-<region>`.
* `bucket`: (*Map*)
  * `name`: (*string*) Name of the S3 Bucket to upload the `distDir` to. Defaults to a generated name.
  * `indexDocument`: (*string*) Defaults to `index.html`.
  * `errorDocument`: (*string*) Defaults to `index.html`.
  * `forbiddenDocument`: (*string*) Defaults to `index.html`.
* `distribution`: (*Map*)
  * `dnsName`: (*string* *Required*) A DNS name to use for this Cloudfront distribution. This is required and has no default values.
  * `altDnsName`: (*string*) Another DNS name to use for this Cloudfront distribution.
  * `acmCertificateArn`: (*string*, *Required*) AWS ACM Certificate Arn that covers the domain names listed in `aliases`.
  * `hostedZoneName`: (*string*) Name of the AWS Route53 Hosted Zone to create the Route53 records. Defaults to the value of `dnsName`.
  * `mimeTypes`: (*Map*) A key/value mapping of file extensions and mime types to override. For example:
  ```YAML
  ...
    distribution:
      mimeTypes:
        html: text/html # default
  ```
* `offline`: (*Map*)
  * `command`: (*string*[]) Command and options as an array of strings. For example, `["npm", "start"]` Defaults to `["echo", "no", "frontend", "offline", "command"]`.
  * `env`: (*Map*) A key/value mapping of environment variables and values to inject into the frontend start command.
  * `cwdDir`: (*string*) The directory from which to run the `offline.command`. Defaults to `./frontend` if the directory exists.

## Offline Integration
This plugin seamlessly integrates with [`serverless-offline`](https://www.npmjs.com/package/serverless-offline). Simply Add an `offline` configuration under `custom.serverless-frontend-plugin` in your `serverless.yml`. See `offline` options above.

## Examples
See [the test configs](https://github.com/rogersgt/serverless-frontend-plugin/tree/master/tests/configs) on Github for working examples. Just be sure to replace the following section in the `serverless.yml`:

```YAML
# Replace this
plugins:
  - ../../../index.js

# With this
plugins:
- serverless-frontend-plugin
```

## Serverless Framework Version Compatibility
| `serverless-frontend-plugin` | `serverless` |
| :-------: | :----: |
| `1.x`   | `2.x` |
| `2.x` | `3.x` |
