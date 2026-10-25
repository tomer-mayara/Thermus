type Environment = Readonly<Record<string, string | undefined>>;
export declare class AdRulesFileError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
export declare function readAdRulesFile(environment: Environment): string;
export {};
