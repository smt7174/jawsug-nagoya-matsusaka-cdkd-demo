import type { APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

/** バケット内のオブジェクト数 (空バケット前提のためページングしない) */
async function countObjects(bucket: string): Promise<number> {
  const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
  return res.KeyCount ?? 0;
}

/** テーブルの件数 (空テーブル前提のため Scan を 1 回だけ実行) */
async function countItems(table: string): Promise<number> {
  const res = await ddb.send(new ScanCommand({ TableName: table, Select: 'COUNT' }));
  return res.Count ?? 0;
}

export const handler = async (): Promise<APIGatewayProxyResult> => {
  // 2つずつ存在する前提で、string の組として定数化する
  const [bucket1, bucket2] = (process.env.BUCKET_NAMES as string).split(',') as [string, string];
  const [table1, table2] = (process.env.TABLE_NAMES as string).split(',') as [string, string];

  // バケット2つ・テーブル2つは確定なので index を明示して全て並列実行する
  const [s3Count1, s3Count2, ddbCount1, ddbCount2] = await Promise.all([
    countObjects(bucket1),
    countObjects(bucket2),
    countItems(table1),
    countItems(table2),
  ]);

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      deployer: process.env.DEPLOYER,
      s3: {
        [bucket1]: { count: s3Count1 },
        [bucket2]: { count: s3Count2 },
      },
      dynamodb: {
        [table1]: { count: ddbCount1 },
        [table2]: { count: ddbCount2 },
      },
    }),
  };
};
