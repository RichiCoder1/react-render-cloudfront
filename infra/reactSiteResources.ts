import { dynamic, CustomResourceOptions, asset, Input, Output, ComponentResource } from '@pulumi/pulumi';
import { s3, sdk } from '@pulumi/aws';
import { BucketArgs } from '@pulumi/aws/s3';
import * as globby from 'globby';
import { relative, resolve } from 'path';
import { readFileSync } from 'fs';
import { fromData, parse } from 'ssri';

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

interface LazilyDeletedAssetProviderOutputs {
    path: string;
    bucket: string;
    ssri: string;
}

const LazilyDeletedAssetProvider: dynamic.ResourceProvider = {
    async create(inputs: LazilyDeletedAssetProviderInputs) {
        try {
            const path = await Promise.resolve(inputs.asset.path);
            const key = relative(inputs.root, path);

            const fileData = readFileSync(path);

            const { S3 } = sdk;
            const api = new S3({
                apiVersion: '2006-03-01',
            });

            await api
                .putObject({
                    Bucket: inputs.bucket,
                    Key: key,
                    Body: fileData,
                })
                .promise();

            const ssri = fromData(fileData);

            return {
                id: key,
                outs: {
                    path,
                    ssri: ssri.toString(),
                    bucket: inputs.bucket,
                },
            };
        } catch (e) {
            console.error(e, { inputs });
            throw e;
        }
    },
    async diff(id: string, olds: LazilyDeletedAssetProviderOutputs, news: LazilyDeletedAssetProviderInputs) {
        const { path, ssri } = olds;
        const fileData = readFileSync(path);

        const newSsri = fromData(fileData);
        if (parse(ssri).match(newSsri) === false) {
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
        const path = await news.asset.path;

        const fileData = readFileSync(path);

        const { S3 } = sdk;
        const api = new S3({
            apiVersion: '2006-03-01',
        });

        await api
            .deleteObject({
                Bucket: news.bucket,
                Key: id,
            })
            .promise();

        await api
            .putObject({
                Bucket: news.bucket,
                Key: id,
                Body: fileData,
                Tagging: 'AssetActiveState=active',
            })
            .promise();

        const ssri = fromData(fileData);

        return {
            outs: {
                bucket: news.bucket,
                path,
                ssri: ssri.toString(),
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
                Bucket: props.bucket,
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
