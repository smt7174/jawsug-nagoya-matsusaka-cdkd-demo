#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { DemoStack } from '../lib/demo-stack.js';

const app = new cdk.App();

// 使い方: cdk synth -c deployer=cdkd | cdk synth -c deployer=cfn
const deployer: string = (app.node.tryGetContext('deployer') ?? 'cfn').toString() as string;

// スタック名に deployer を含め、同一アカウント内で両方を共存させる
new DemoStack(app, `DemoStack-${deployer}`, {
  deployer,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'ap-northeast-1', // 東京
  },
});
