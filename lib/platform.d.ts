import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
export declare class PlatformLC7001 implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory[];
    private isInitialized;
    readonly logBroadcastDiagnostics: boolean;
    readonly logBroadcastMemory: boolean;
    readonly logDebugMessages: boolean;
    readonly logEliotErrors: boolean;
    private readonly useOldUUID;
    private lc7001;
    private readonly tcpOptions;
    private readonly jsonDelimiter;
    constructor(log: Logger, config: PlatformConfig, api: API);
    private addAccessory;
    private findLC7001IndexByName;
    private matchAccessoriesToLC7001;
    private updateAccessoryFromLC7001;
    configureAccessory(accessory: PlatformAccessory): void;
}
//# sourceMappingURL=platform.d.ts.map