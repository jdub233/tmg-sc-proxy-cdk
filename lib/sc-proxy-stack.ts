import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_ecs_patterns as ecs_patterns } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';

import { config } from 'dotenv';
config();

import path = require('path');

// Optional ACM certificate paramters, if a cert is specified it will be used to create an HTTPS listener.
// Also set the proxy targets from the environment.
const {
  CERT_ID: certID = '', 
  CERT_ARN: certArn = '',
  PUBLISH_ENDPOINT: publishEndpoint = '',
  EDIT_ENDPOINT: editEndpoint = '',
  SC_BASIC_AUTH: scBasicAuth = '',
} = process.env;

export class ScProxyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'SuperContainerProxyVpc', {
      maxAzs: 2,
      natGateways: 0,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          name: 'SCProxySubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,
          cidrMask: 24,
        }
      ],
    });

    const cluster = new ecs.Cluster(this, 'SuperContainerProxyCluster', {
      vpc: vpc
    });

    const fargate = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'SuperContainerProxyFargateService', {
      cluster: cluster,
      cpu: 256,
      desiredCount: 1,
      assignPublicIp: true,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../src/')),
        environment: {
          "name": "Serverless Fargate",
          'PUBLISH_ENDPOINT': publishEndpoint,
          'EDIT_ENDPOINT': editEndpoint,
          'SC_BASIC_AUTH': scBasicAuth,
        },
      },
      ...certArn && {protocol: elbv2.ApplicationProtocol.HTTPS},
      ...certArn && {redirectHTTP: true},
      ...certArn && {certificate: acm.Certificate.fromCertificateArn(this, certID, certArn)},
      memoryLimitMiB: 512,
    });
  }
}
