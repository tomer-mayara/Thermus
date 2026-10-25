export declare const NOTICE_HEADERS: Readonly<Record<string, string>>;
export declare const FORM_HEADERS: Readonly<Record<string, string>>;
export declare function htmlDocument(title: string, content: readonly string[]): string;
export declare function postForm(action: string, fields: readonly string[], button: string): string[];
export declare function hiddenField(name: string, value: string): string;
