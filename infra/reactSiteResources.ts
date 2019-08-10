import { dynamic, CustomResourceOptions, asset, Input, Output, ComponentResource } from '@pulumi/pulumi';
import { s3, sdk } from '@pulumi/aws';
import { BucketArgs } from '@pulumi/aws/s3';
import { CreateResult } from '@pulumi/pulumi/dynamic';
import { PutObjectRequest } from 'aws-sdk/clients/s3';
import * as globby from 'globby';
import { resolve, relative } from 'path';
import { readFileSync } from 'fs';
import { fromData, parse } from 'ssri';
import * as mime from 'mime';
import slash = require('slash');

interface LazilyDeletedAssetInputs {
    asset: Input<asset.FileAsset>;
    bucket: Input<string>;
    root: Input<string>;
}

interface LazilyDeletedAssetProviderInputs {
    asset: asset.FileAsset;
    bucket: string;
    root: string;
}

type LazilyDeletedAssetProviderOutputs = PutObjectRequest & { 
    Metadata?: {
        'X-Integrity': string;
        [key: string]: string;
    }
    path: string;
}

async function getAssetUploadOptions(bucket: string, asset: asset.FileAsset, root: string): Promise<LazilyDeletedAssetProviderOutputs> {
    const path = await Promise.resolve(asset.path);
    const key = slash(relative(root, path));

    const fileData = readFileSync(path);
    const ssri = fromData(fileData).toString();

    const objectOptions: PutObjectRequest & { path: string } = {
        Bucket: bucket,
        Key: key,
        Body: fileData,
        ACL: 'public-read' as const,
        ContentType: mime.getType(path) || 'text/html',
        Metadata: {
            'X-Integrity': ssri
        },
        Tagging: 'AssetActiveState=active',
        path
    };
    return objectOptions;
}

const LazilyDeletedAssetProvider: dynamic.ResourceProvider = {
    async create(inputs: LazilyDeletedAssetProviderInputs): Promise<CreateResult & { outs: LazilyDeletedAssetProviderOutputs }> {
        try {

            const { S3 } = sdk;
            const api = new S3({
                apiVersion: '2006-03-01',
            });

            const { path, ...objectOptions } = await getAssetUploadOptions(inputs.bucket, inputs.asset, inputs.root);

            await api
                .putObject(objectOptions)
                .promise();

            delete objectOptions.Body;

            return {
                id: objectOptions.Key,
                outs: {...objectOptions, path },
            };
        } catch (e) {
            console.error(e, { inputs });
            throw e;
        }
    },
    async diff(id: string, olds: LazilyDeletedAssetProviderOutputs, news: LazilyDeletedAssetProviderInputs) {
        const { Metadata } = olds;
        const oldSsri = Metadata && Metadata['X-Integrity'];

        const options = await getAssetUploadOptions(news.bucket, news.asset, news.root);
        const newSsri = options.Metadata && options.Metadata['X-Integrity'];

        if (!newSsri || !oldSsri || parse(oldSsri).match(newSsri) === false) {
            return {
                changes: true,
            };
        } else {
            return {
                changes: false,
            };
        }
    },
    async update(id: string, olds: LazilyDeletedAssetProviderOutputs, news: LazilyDeletedAssetProviderInputs) {

        const { path, ...putOptions } = await getAssetUploadOptions(news.bucket, news.asset, news.root);

        const { S3 } = sdk;
        const api = new S3({
            apiVersion: '2006-03-01',
        });

        await api
            .putObject(putOptions)
            .promise();

        delete putOptions.Body;

        return {
            outs: {
                ...putOptions,
                path
            },
        };
    },
    async delete(id: string, props: LazilyDeletedAssetProviderOutputs) {
        const { S3 } = sdk;
        const api = new S3({
            apiVersion: '2006-03-01',
        });

        await api
            .putObjectTagging({
                Bucket: props.Bucket,
                Key: id,
                Tagging: {
                    TagSet: [{ Key: 'AssetActiveState', Value: 'removed' }],
                },
            })
            .promise();
    },
};

export class LazilyDeletedAsset extends dynamic.Resource {
    constructor(name: string, props: LazilyDeletedAssetInputs, options?: CustomResourceOptions) {
        super(LazilyDeletedAssetProvider, name, props, options);
    }
}

export class LazilyDeletedBucket extends ComponentResource {
    private readonly _bucket: s3.Bucket;
    public readonly _assets: LazilyDeletedAsset[];

    constructor(
        name: string,
        pattern: string[] | string | { pattern: string[] | string; options: globby.GlobbyOptions },
        bucketOptions?: BucketArgs,
        options?: CustomResourceOptions
    ) {
        super('react-site:LazilyDeletedBucket', name, bucketOptions, options);

        this._bucket = new s3.Bucket(
            `${name}-bucket`,
            {
                ...bucketOptions,
                lifecycleRules: [{ enabled: true, expiration: { days: 15 }, tags: { AssetActiveState: 'removed' } }],
            },
            {
                parent: this,
            }
        );

        const globOptions = typeof pattern === 'object' && !Array.isArray(pattern) ? pattern.options : undefined;
        const globPattern = typeof pattern === 'string' || Array.isArray(pattern) ? pattern : pattern.pattern;
        const files = globby.sync(globPattern, globOptions);
        const root = globOptions && globOptions.cwd ? globOptions.cwd : process.cwd();

        this._assets = [];
        for (const file of files) {
            const siteAsset = new LazilyDeletedAsset(
                file,
                {
                    bucket: this._bucket.bucket,
                    asset: new asset.FileAsset(resolve(root, file)),
                    root: globOptions && globOptions.cwd ? globOptions.cwd : process.cwd(),
                },
                {
                    parent: this,
                    dependsOn: [this._bucket],
                }
            );
            this._assets.push(siteAsset);
        }

        this.registerOutputs({
            bucket: this.bucket,
            bucketDomainName: this.bucketDomainName,
            bucketRegionalDomainName: this.bucketRegionalDomainName,
            assets: this.assets,
        });
    }

    public get bucket() {
        return this._bucket.bucket;
    }
    public get bucketDomainName() {
        return this._bucket.bucketDomainName;
    }
    public get bucketRegionalDomainName() {
        return this._bucket.bucketRegionalDomainName;
    }
    public get assets() {
        return this._assets;
    }
}
