import { getProject, getStack } from '@pulumi/pulumi';
import { s3, cloudfront, lambda, iam } from '@pulumi/aws';

const deploymentKey = `${getProject()}-${getStack()}`;

const render = async () => {
    return {
        status: 200, 
        body: 'hello!' 
    };
};

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

const renderLambda = new lambda.CallbackFunction(`${deploymentKey}-render`, {
    callback: render,
    publish: true,
    timeout: 30,
    runtime: 'nodejs10.x',
    role: renderRole
});

// Create an AWS resource (S3 Bucket)
const staticOrigin = `${deploymentKey}-bucket-origin`;
const bucketName = `${deploymentKey}-static`;
const bucket = new s3.Bucket(bucketName, {});

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
            queryString: false,
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
    },
    enabled: true,
    isIpv6Enabled: true,
    origins: [
        {
            domainName: bucket.bucketRegionalDomainName,
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
    defaultRootObject: 'render.js',
});

export const cloudfrontUrl = cf.domainName;
export const bucketId = bucket.id;
