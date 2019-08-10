import { getProject, getStack, asset, dynamic } from '@pulumi/pulumi';
import { s3, cloudfront, lambda, iam } from '@pulumi/aws';
import { resolve } from 'path';
import { LazilyDeletedBucket } from './reactSiteResources';

const deploymentKey = `${getProject()}-${getStack()}`;

const renderRole = new iam.Role(`${deploymentKey}-render-permission`, {
    assumeRolePolicy: `{
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "",
        "Effect": "Allow",
        "Principal": {
            "Service": [
                "lambda.amazonaws.com",
                "edgelambda.amazonaws.com"
            ]
        },
        "Action": "sts:AssumeRole"
    }]
}`,
});

const lambdaSource = new asset.AssetArchive({
    'server.js': new asset.FileAsset(resolve(__dirname, '../build/server.js')),
    'server.js.map': new asset.FileAsset(resolve(__dirname, '../build/server.js.map')),
    'assets.json': new asset.FileAsset(resolve(__dirname, '../build/assets.json'))
})

const renderLambda = new lambda.Function(`${deploymentKey}-render`, {
    code: lambdaSource,
    handler: 'server.default',
    publish: true,
    timeout: 30,
    runtime: 'nodejs10.x',
    role: renderRole.arn
});

const publicAssetBucket = new LazilyDeletedBucket(`${deploymentKey}-public`, {
    pattern: '**',
    options: { cwd: resolve(__dirname, '../build/public') }
});

// Create an AWS resource (S3 Bucket)
const staticOrigin = `${deploymentKey}-bucket-origin`;

const originAccessIdentity = new cloudfront.OriginAccessIdentity(deploymentKey);

const cf = new cloudfront.Distribution(`${deploymentKey}-distribution`, {
    defaultCacheBehavior: {
        allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
        cachedMethods: ['GET', 'HEAD'],
        defaultTtl: 3600,
        forwardedValues: {
            cookies: {
                forward: 'none',
            },
            queryString: true,
            queryStringCacheKeys: ['v']
        },
        maxTtl: 86400,
        minTtl: 0,
        targetOriginId: staticOrigin,
        viewerProtocolPolicy: 'allow-all',
        lambdaFunctionAssociations: [
            {
                eventType: 'origin-request',
                includeBody: true,
                lambdaArn: renderLambda.qualifiedArn,
            },
        ],
        compress: true
    },
    enabled: true,
    isIpv6Enabled: true,
    origins: [
        {
            domainName: publicAssetBucket.bucketRegionalDomainName,
            originId: staticOrigin,
            s3OriginConfig: {
                originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
            },
        },
    ],
    priceClass: 'PriceClass_100',
    viewerCertificate: {
        cloudfrontDefaultCertificate: true,
    },
    restrictions: {
        geoRestriction: {
            restrictionType: 'none'
        }
    },
    defaultRootObject: 'render',
});

export const cloudfrontUrl = cf.domainName;
export const bucketId = publicAssetBucket.bucket;
