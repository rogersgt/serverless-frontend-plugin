# nodejs-html

## deploy
```bash
export AWS_CERT_ARN=arn:aws:acm:<region>:<account-id>:certificate/<id>
export DOAMIN_NAME=<your domain>
export HOSTED_ZONE=<your hosted zone name>

serverless deploy \
  --cert-arn ${AWS_CERT_ARN} \
  --domain ${DOMAIN_NAME} \
  --hosted-zone ${HOSTED_ZONE}
```
