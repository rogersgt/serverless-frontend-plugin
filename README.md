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
* `distDir`: (<string>) The directory that gets uploaded and hosted as a static site.
* `build`: (<Map>)
  * `command`: (<string>[]) Command and options as an array of strings. For example, `["npm", "run", "build"]`
  * `cwdDir`: (<string>) The directory from which to run the `build.command`
