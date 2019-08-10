declare module '*.svg' {
    const content: any;
    export default content;
}

type CloudfrontEvent = {
    Records: [CloudfrontRecord];
};
type CloudfrontRecord = { cf: {
    config: CloudfrontConfiguration;
    request: CloudfrontRequest;
    origin?: CloudfrontOrigin;
} };

type CloudfrontConfiguration = {
    readonly distributionDomainName: string;
    readonly distributionId: string;
    readonly eventType: string;
    readonly requestId?: string;
};

type CloudfrontRequest = {
    body: {
        readonly inputTruncated: boolean;
        action: 'read-only' | 'replace';
        encoding: 'text' | 'base64';
        data: string;
    };
    readonly clientIp: string;
    readonly queryString: string;
    uri: string;
    readonly method: string;
    headers: CloudfrontHeaders;
};

type CloudfrontOrigin = CloudfrontS3Origin;

type CloudfrontS3Origin = {
    s3: {
        authMethod: string;
        customHeaders: CloudfrontHeaders;
        domainName: string;
        path: string;
        region: string;
    };
};

type CloudfrontHeaders = {
    [normalizedHeaderKey: string]: {
        key: string;
        value: string;
    }[];
};
