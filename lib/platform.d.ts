import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
interface MyPlatformAccessory extends PlatformAccessory {
    lc7001Index?: number;
}
export declare class PlatformLC7001 implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: MyPlatformAccessory[];
    private isInitialized;
    readonly logBroadcastDiagnostics: boolean;
    readonly logBroadcastMemory: boolean;
    readonly logDebugMessages: boolean;
    readonly logEliotErrors: boolean;
    private readonly useOldUUID;
    private lc7001;
    private readonly password;
    private readonly tcpOptions;
    private readonly jsonDelimiter;
    private readonly tcptimeout;
    private readonly tcpretrywait;
    constructor(log: Logger, config: PlatformConfig, api: API);
    private addAccessory;
    private findLC7001IndexByName;
    private matchAccessoriesToLC7001;
    private updateAccessoryFromLC7001;
    configureAccessory(accessory: MyPlatformAccessory): void;
}
export {};
//# sourceMappingURL=platform.d.ts.map