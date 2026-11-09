import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DemoStack } from '../lib/demo-stack.js';

const synth = () => {
  const app = new cdk.App();
  const stack = new DemoStack(app, 'T', { deployer: 'cdkd' });
  return Template.fromStack(stack);
};

test('resource counts', () => {
  const t = synth();
  t.resourceCountIs('AWS::S3::Bucket', 2);
  t.resourceCountIs('AWS::DynamoDB::Table', 2);
  t.resourceCountIs('AWS::Lambda::Function', 1);
  t.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  t.resourceCountIs('AWS::SNS::Topic', 3);
  t.resourceCountIs('AWS::SQS::Queue', 3);
});

test('lambda has no write actions', () => {
  const json = JSON.stringify(synth().findResources('AWS::IAM::Policy'));
  for (const bad of ['s3:Put', 's3:Delete', 'dynamodb:Put', 'dynamodb:Update', 'dynamodb:Delete', 'dynamodb:BatchWrite']) {
    expect(json).not.toContain(bad);
  }
  expect(json).toContain('dynamodb:Scan');
});

test('deployer tag is applied', () => {
  synth().hasResourceProperties('AWS::S3::Bucket', {
    Tags: Match.arrayWith([{ Key: 'Deployer', Value: 'cdkd' }]),
  });
});

test('no resource is retained', () => {
  const resources = synth().toJSON().Resources as Record<string, any>;
  for (const [id, r] of Object.entries(resources)) {
    expect([id, r.DeletionPolicy]).not.toEqual([id, 'Retain']);
    expect([id, r.DeletionPolicy]).not.toEqual([id, 'RetainExceptOnCreate']);
    expect([id, r.DeletionPolicy]).not.toEqual([id, 'Snapshot']);
  }
});

test('SNS/SQS are chained by dependencies', () => {
  const t = synth().toJSON().Resources as Record<string, any>;
  const dep = (prefix: string) =>
    Object.entries(t).find(([id]) => id.startsWith(prefix))![1].DependsOn ?? [];
  expect(dep('JAWSUGMATSUSAKAQueue1')).toEqual([expect.stringMatching(/^JAWSUGMATSUSAKATopic1/)]);
  expect(dep('JAWSUGMATSUSAKATopic2')).toEqual([expect.stringMatching(/^JAWSUGMATSUSAKAQueue1/)]);
  expect(dep('JAWSUGMATSUSAKAQueue3')).toEqual([expect.stringMatching(/^JAWSUGMATSUSAKATopic3/)]);
});
