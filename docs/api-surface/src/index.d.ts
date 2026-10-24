import { type Application, type ApplicationLogger } from './app/application.ts';
import { type ListenAddress } from './runtime/config/deployment-config.ts';
type Environment = Readonly<Record<string, string | undefined>>;
export interface ProcessSignals {
    once(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
    off(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
}
export interface ServeOptions {
    readonly listen: ListenAddress;
    readonly publicBaseUrl: string;
    readonly logger: ApplicationLogger;
    readonly signals: ProcessSignals;
}
export declare function serve(environment: Environment, logger: ApplicationLogger, signals: ProcessSignals): Promise<void>;
export declare function serveApplication(open: () => Application | Promise<Application>, options: ServeOptions): Promise<void>;
export type StopSignal = Disposable & {
    readonly received: Promise<NodeJS.Signals>;
};
export declare function stopSignal(signals: ProcessSignals): StopSignal;
export {};
