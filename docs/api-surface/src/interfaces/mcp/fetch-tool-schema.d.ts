export declare const fetchToolInputSchema: {
    type: 'object';
    properties: {
        url: {
            type: string;
            minLength: number;
            maxLength: number;
            description: string;
        };
        reason: {
            type: string;
            minLength: number;
            maxLength: number;
            pattern: string;
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
export declare function parseFetchToolArguments(value: unknown): Promise<{
    url: string;
    reason: string;
} | undefined>;
