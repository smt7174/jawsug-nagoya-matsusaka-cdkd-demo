import * as cdk from 'aws-cdk-lib/core';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as path from 'node:path';

export interface DemoStackProps extends cdk.StackProps {
  /** デプロイ方式の識別子 (例: 'cdkd' | 'cfn')。タグ・環境変数・出力で区別に使う */
  readonly deployer: string;
}

/**
 * API Gateway -> Lambda -> (S3 x2, DynamoDB x2 読み取り専用)
 * + 直列に作成される SNS / SQS (デプロイ時間調整用のダミー)
 * スタック定義は cdkd / CloudFormation 共通。deployer だけが異なる。
 */
export class DemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DemoStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Deployer', props.deployer);

    // --- S3 x2 ---
    const bucket1 = new s3.Bucket(this, `JAWSUG-MATSUSAKA-Bucket1-${props.deployer}`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });
    const bucket2 = new s3.Bucket(this, `JAWSUG-MATSUSAKA-Bucket2-${props.deployer}`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // --- DynamoDB x2 ---
    const table1 = new dynamodb.Table(this, `JAWSUG-MATSUSAKA-Table1-${props.deployer}`, {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const table2 = new dynamodb.Table(this, `JAWSUG-MATSUSAKA-Table2-${props.deployer}`, {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- Lambda ---
    // ロググループを明示作成し、スタック削除時に一緒に消えるようにする
    const logGroup = new logs.LogGroup(this, `JAWSUG-MATSUSAKA-ReaderLogGroup-${props.deployer}`, {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const fn = new nodejs.NodejsFunction(this, `JAWSUG-MATSUSAKA-ReaderFunction-${props.deployer}`, {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(import.meta.dirname, '../lambda/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      logGroup,
      bundling: {
        format: nodejs.OutputFormat.ESM, // package.json の type: module に合わせる
        target: 'node24',
      },
      environment: {
        DEPLOYER: props.deployer,
        BUCKET_NAMES: [bucket1.bucketName, bucket2.bucketName].join(','),
        TABLE_NAMES: [table1.tableName, table2.tableName].join(','),
      },
    });

    // 読み取り専用 (書き込み権限は付与しない)
    bucket1.grantRead(fn);
    bucket2.grantRead(fn);
    table1.grantReadData(fn); // Scan を含む
    table2.grantReadData(fn);

    // --- API Gateway ---
    const api = new apigw.LambdaRestApi(this, `JAWSUG-MATSUSAKA-Api-${props.deployer}`, {
      handler: fn,
      proxy: true,
    });

    // --- デプロイ時間を延ばすためのダミーリソース (SNS / SQS) ---
    // Lambda からは使わない。addDependency で 1 本の鎖にして直列に作らせる。
    // Topic1 -> Queue1 -> Topic2 -> Queue2 -> Topic3 -> Queue3
    const topic1 = new sns.Topic(this, `JAWSUG-MATSUSAKA-Topic1-${props.deployer}`);
    const queue1 = new sqs.Queue(this, `JAWSUG-MATSUSAKA-Queue1-${props.deployer}`);
    const topic2 = new sns.Topic(this, `JAWSUG-MATSUSAKA-Topic2-${props.deployer}`);
    const queue2 = new sqs.Queue(this, `JAWSUG-MATSUSAKA-Queue2-${props.deployer}`);
    const topic3 = new sns.Topic(this, `JAWSUG-MATSUSAKA-Topic3-${props.deployer}`);
    const queue3 = new sqs.Queue(this, `JAWSUG-MATSUSAKA-Queue3-${props.deployer}`);
    queue1.node.addDependency(topic1);
    topic2.node.addDependency(queue1);
    queue2.node.addDependency(topic2);
    topic3.node.addDependency(queue2);
    queue3.node.addDependency(topic3);

    // RemovalPolicy を設定できる全リソースを DESTROY にする(取りこぼし防止)
    cdk.RemovalPolicies.of(this).destroy();

    new cdk.CfnOutput(this, `JAWSUG-MATSUSAKA-ApiUrl-${props.deployer}`, { value: api.url });
    new cdk.CfnOutput(this, `JAWSUG-MATSUSAKA-Deployer-${props.deployer}`, { value: props.deployer });
  }
}
