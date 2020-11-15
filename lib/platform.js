"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformLC7001 = void 0;
const settings_1 = require("./settings");
const lc7001_1 = require("./lc7001");
class PlatformLC7001 {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        //Homebridge Properties
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        // this is used to track restored cached accessories
        this.accessories = [];
        //Homebrige-derived propertis
        this.isInitialized = false;
        //Configuration properties
        this.logBroadcastDiagnostics = false;
        this.logBroadcastMemory = false;
        this.logDebugMessages = false;
        this.logEliotErrors = false;
        this.useOldUUID = false;
        this.password = '';
        this.tcpOptions = { host: 'LCM1.local', port: 2112 };
        this.jsonDelimiter = '\0';
        this.log.info('Platform initializing....');
        this.log.debug('Parsing platform configuration:');
        for (var propertyNameConfig in this.config) {
            if (propertyNameConfig == 'lc7001-password') {
                this.log.debug('-->', propertyNameConfig, ': ********');
            }
            else {
                this.log.debug('-->', propertyNameConfig, ':', this.config[propertyNameConfig]);
            }
        }
        ;
        if ('lc7001-password' in this.config) {
            this.password = this.config['lc7001-password'];
        }
        if ('lc7001-hostname' in this.config) {
            this.tcpOptions.host = this.config['lc7001-hostname'];
        }
        if ('lc7001-port' in this.config) {
            this.tcpOptions.port = this.config['lc7001-port'];
        }
        if ('lc7001-localaddress' in this.config) {
            this.tcpOptions.localAddress = this.config['lc7001-localaddress'];
        }
        if ('lc7001-localport' in this.config) {
            this.tcpOptions.localPort = this.config['lc7001-localport'];
        }
        if ('lc7001-family' in this.config) {
            this.tcpOptions.family = this.config['lc7001-family'];
        }
        if ('lc7001-delimiter' in this.config) {
            this.jsonDelimiter = this.config['lc7001-delimiter'];
        }
        if ('logBroadcastDiagnostics' in this.config) {
            this.logBroadcastDiagnostics = this.config['logBroadcastDiagnostics'];
        }
        if ('logBroadcastMemory' in this.config) {
            this.logBroadcastMemory = this.config['logBroadcastMemory'];
        }
        if ('logDebugMessages' in this.config) {
            this.logDebugMessages = this.config['logDebugMessages'];
        }
        if ('logEliotErrors' in this.config) {
            this.logEliotErrors = this.config['logEliotErrors'];
        }
        if ('useOldUUID' in this.config) {
            this.useOldUUID = this.config['useOldUUID'];
        }
        this.log.debug('Finished parsing platform configuration.');
        this.log.debug('TCP Options:');
        this.log.debug('--> host:', this.tcpOptions.host);
        this.log.debug('--> port:', this.tcpOptions.port);
        if (this.tcpOptions.localAddress) {
            this.log.debug('--> localAddress:', this.tcpOptions.localAddress);
        }
        ;
        if (this.tcpOptions.localPort) {
            this.log.debug('--> localPort:', this.tcpOptions.localPort);
        }
        if (this.tcpOptions.family) {
            this.log.debug('--> family:', this.tcpOptions.family);
        }
        if (this.jsonDelimiter) {
            this.log.debug('Delimiter:', JSON.stringify(this.jsonDelimiter));
        }
        this.log.debug('Creating LC7001 interface....');
        this.lc7001 = new lc7001_1.LC7001(this, this.password, this.tcpOptions, this.jsonDelimiter);
        this.log.debug('LC7001 interface created.');
        this.lc7001.emitter.on('initialized', () => {
            this.log.debug('Received "initialized" event from LC7001 module.');
            if (this.isInitialized) {
                this.log.debug('Platform is initialized. Running matching....');
                this.matchAccessoriesToLC7001();
            }
            else {
                this.log.debug('Platform net yet initialized. Matching deferred.');
            }
        });
        this.lc7001.emitter.on('accessoryUpdate', (accessoryIndex) => {
            this.log.debug('Received "accessoryUpdate" event from LC7001 module for index:', accessoryIndex);
            if (accessoryIndex in this.accessories) {
                this.updateAccessoryFromLC7001(this.accessories[accessoryIndex]);
            }
            else {
                this.log.warn('LC7001 requested update to accessory index:', accessoryIndex, ' Index missing in accessories[].');
                if (this.lc7001.isInitialized) {
                    this.log.debug('Rerunning matching....');
                    this.matchAccessoriesToLC7001();
                }
            }
        });
        this.log.info('Platform initialized.');
        this.log.debug('Finished initializing platform:', this.config.name);
        this.api.on('didFinishLaunching', () => {
            this.log.debug('Received "didFinishLaunching" event from API.');
            this.isInitialized = true;
            if (this.lc7001.isInitialized) {
                this.log.debug('LC7001 is initialized. Running matching....');
                this.matchAccessoriesToLC7001();
            }
            else {
                this.log.debug('LC7001 not yet initialized. Matching deferred.');
            }
        });
    }
    addAccessory(accessoryName, lc7001Index) {
        var uuid;
        this.log.info('Adding accessory', accessoryName, 'from zone', lc7001Index, 'on LC7001.');
        this.log.debug('Generating UUID. Accessory name:', accessoryName, 'MAC Address:', this.lc7001.macAddress);
        if (this.useOldUUID) {
            this.log.debug('Using old UUID key....');
            uuid = this.api.hap.uuid.generate(accessoryName);
        }
        else {
            uuid = this.api.hap.uuid.generate(accessoryName + this.lc7001.macAddress);
        }
        this.log.debug('UUID generated:', uuid);
        var newAccessory = new this.api.platformAccessory(accessoryName, uuid);
        newAccessory.lc7001Index = lc7001Index;
        this.log.debug('Configuring services for', accessoryName, '....');
        switch (this.lc7001.accessories[lc7001Index].PropertyList.DeviceType) {
            case 'Switch':
                this.log.debug('Configuring', accessoryName, 'as a Service.Lightbulb and Switch.');
                newAccessory.addService(this.api.hap.Service.Lightbulb, accessoryName, 'Switch');
                break;
            case 'Dimmer':
                this.log.debug('Configuring', accessoryName, 'as a Service.Lightbulb and Dimmer.');
                newAccessory.addService(this.api.hap.Service.Lightbulb, accessoryName, 'Dimmer');
                newAccessory.getService(this.api.hap.Service.Lightbulb).addCharacteristic(this.api.hap.Characteristic.Brightness);
                break;
            default:
                this.log.error(accessoryName, 'has DeviceType =', this.lc7001.accessories[lc7001Index].PropertyList.DeviceType, 'which is not supported. No services configured.');
                break;
        }
        this.configureAccessory(newAccessory);
        this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [newAccessory]);
    }
    findLC7001IndexByName(accessoryName) {
        this.log.debug('Finding', accessoryName, 'on LC7001 accessories list....');
        var lc7001Index = this.lc7001.accessories.findIndex((value) => {
            if (value !== undefined) {
                if ('PropertyList' in value) {
                    if ('Name' in value.PropertyList) {
                        return value.PropertyList.Name == accessoryName;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    return false;
                }
            }
            else {
                return false;
            }
        });
        return lc7001Index;
    }
    matchAccessoriesToLC7001() {
        var addAccessories = [];
        var deleteAccessories = [];
        var cleanMatch = false;
        while (!cleanMatch) {
            cleanMatch = true;
            this.log.debug('Matching platform accessories to LC7001 accessories....');
            if (this.accessories.length == 0) {
                this.log.debug('No platform accessories to match.');
            }
            this.accessories.forEach((value, index, array) => {
                this.log.debug('Matching', value.displayName, 'to LC7001 accessories list....');
                var lc7001Match = this.findLC7001IndexByName(value.displayName);
                if (lc7001Match >= 0) {
                    this.log.debug('Match found. LC7001 zone:', lc7001Match);
                    value.lc7001Index = lc7001Match;
                    this.lc7001.accessories[lc7001Match].platformAccessoryIndex = index;
                    this.updateAccessoryFromLC7001(value);
                }
                else {
                    this.log.debug('No matching LC7001 accessory found.');
                    cleanMatch = false;
                    deleteAccessories.push(value);
                }
            });
            if (deleteAccessories.length > 0) {
                deleteAccessories.forEach((value) => {
                    this.log.info('Unable to find accessory', value.displayName, 'on LC7001. Removing....');
                    this.accessories.splice(this.accessories.indexOf(value), 1);
                });
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, deleteAccessories);
                deleteAccessories = [];
            }
            if (!cleanMatch) {
                this.log.debug('Indexes may have changed. Rematching....');
            }
        }
        this.log.debug('Looking for unmatched LC7001 accessories....');
        if (this.lc7001.accessories.length == 0) {
            this.log.debug('No LC7001 accessories to search.');
        }
        this.lc7001.accessories.forEach((value, index) => {
            if (value.platformAccessoryIndex === undefined) {
                this.log.debug('LC7001 zone', index, 'is not matched to a platform accessory.');
                addAccessories.push(index);
            }
            else {
                this.log.debug('LC7001 zone', index, 'is matched to platform accessory index', value.platformAccessoryIndex);
            }
        });
        while (addAccessories.length > 0) {
            var addIndex = addAccessories.shift();
            this.log.info('Found new accessory on LC7001:', this.lc7001.accessories[addIndex].PropertyList.Name);
            this.addAccessory(this.lc7001.accessories[addIndex].PropertyList.Name, addIndex);
        }
    }
    updateAccessoryFromLC7001(updatedAccessory) {
        if (updatedAccessory !== undefined && updatedAccessory.lc7001Index !== undefined) {
            this.log.debug('Updating accessory', updatedAccessory.displayName, '....');
            const lc7001Accessory = this.lc7001.accessories[updatedAccessory.lc7001Index];
            if (lc7001Accessory.PropertyList.Name != updatedAccessory.displayName) {
                this.log.warn('Accessory', updatedAccessory.displayName, 'has a name mismatch with LC7001 accessory', lc7001Accessory.PropertyList.Name, 'at zone:', updatedAccessory.lc7001Index, 'Disassociated match.');
                updatedAccessory.lc7001Index = undefined;
                lc7001Accessory.platformAccessoryIndex = undefined;
                if (this.lc7001.isInitialized) {
                    this.log.debug('Rerunning matching....');
                    this.matchAccessoriesToLC7001();
                }
            }
            else {
                switch (lc7001Accessory.PropertyList.DeviceType) {
                    case 'Switch':
                        if (lc7001Accessory.PropertyList.Power != updatedAccessory.getService(this.api.hap.Service.Lightbulb).getCharacteristic(this.api.hap.Characteristic.On).value) {
                            this.log.debug('Updating Service.Lightbulb Characteristic.On.');
                            updatedAccessory.getService(this.api.hap.Service.Lightbulb).getCharacteristic(this.api.hap.Characteristic.On).updateValue(lc7001Accessory.PropertyList.Power);
                        }
                        break;
                    case 'Dimmer':
                        if (lc7001Accessory.PropertyList.Power != updatedAccessory.getService(this.api.hap.Service.Lightbulb).getCharacteristic(this.api.hap.Characteristic.On).value) {
                            this.log.debug('Updating Service.Lightbulb Characteristic.On.');
                            updatedAccessory.getService(this.api.hap.Service.Lightbulb).getCharacteristic(this.api.hap.Characteristic.On).updateValue(lc7001Accessory.PropertyList.Power);
                        }
                        if (lc7001Accessory.PropertyList.PowerLevel != updatedAccessory.getService(this.api.hap.Service.Lightbulb).getCharacteristic(this.api.hap.Characteristic.Brightness).value) {
                            this.log.debug('Updating Service.Lightbulb Characteristic.Brightness.');
                            updatedAccessory.getService(this.api.hap.Service.Lightbulb).getCharacteristic(this.api.hap.Characteristic.Brightness).updateValue(lc7001Accessory.PropertyList.PowerLevel);
                        }
                        break;
                    default:
                        this.log.error('Cannot configure accessory:', lc7001Accessory.PropertyList.Name);
                        this.log.error(settings_1.PLUGIN_NAME, 'has not been programmed for the device type:', lc7001Accessory.PropertyList.DeviceType);
                        break;
                }
            }
        }
        else {
            if (updatedAccessory === undefined) {
                this.log.error('Method updateAccessoryFromLC7001() called on undefined accessory.');
            }
            else {
                this.log.debug('Asked to updated accessory', updatedAccessory.displayName, ' which has no LC7001 accessory associated with it. Skipping....');
                if (this.lc7001.isInitialized) {
                    this.log.debug('Rerunning matching....');
                    this.matchAccessoriesToLC7001();
                }
            }
        }
    }
    configureAccessory(accessory) {
        this.log.info('Configuring accessory:', accessory.displayName);
        this.log.debug('Adding listener for "identify" event.');
        accessory.on('identify', () => {
            this.log.info('Accessory', accessory.displayName, 'identified.');
        });
        if (accessory.getService(this.api.hap.Service.Lightbulb) !== undefined) {
            if (accessory.getService(this.api.hap.Service.Lightbulb).testCharacteristic(this.api.hap.Characteristic.On)) {
                this.log.debug('Adding listener for Service.LightBulb Characteristic.On "set" event.');
                accessory.getService(this.api.hap.Service.Lightbulb).getCharacteristic(this.api.hap.Characteristic.On).on('set', (value, callback) => {
                    this.log.debug('HomeKit set Service.LightBulb Characteristic.On for', accessory.displayName, 'to:', value);
                    if (accessory.lc7001Index === undefined) {
                        this.log.debug('Accessory updated by HomeKit before LC7001 initialized. No action taken.');
                    }
                    else {
                        var PropertyList = {};
                        PropertyList.Power = value;
                        this.lc7001.setAccessory(accessory.lc7001Index, PropertyList);
                    }
                    callback();
                });
            }
            if (accessory.getService(this.api.hap.Service.Lightbulb).testCharacteristic(this.api.hap.Characteristic.Brightness)) {
                this.log.debug('Adding listener for Service.LightBulb Characteristic.Brightness "set" event.');
                accessory.getService(this.api.hap.Service.Lightbulb).getCharacteristic(this.api.hap.Characteristic.Brightness).on('set', (value, callback) => {
                    this.log.debug('HomeKit set Service.LightBulb Characteristic.Brightness for', accessory.displayName, 'to:', value);
                    if (accessory.lc7001Index === undefined) {
                        this.log.debug('Accessory updated by HomeKit before LC7001 initialized. No action taken.');
                    }
                    else {
                        var PropertyList = {};
                        PropertyList.PowerLevel = value;
                        this.lc7001.setAccessory(accessory.lc7001Index, PropertyList);
                    }
                    callback();
                });
            }
        }
        var accessoryIndex = this.accessories.push(accessory) - 1;
        this.log.debug('Accessory', accessory.displayName, 'configured at index:', accessoryIndex);
        if (accessory.lc7001Index !== undefined) {
            this.log.debug('LC7001 zone', this.accessories[accessoryIndex].lc7001Index, 'is matched to platform accessory index', accessoryIndex);
            this.lc7001.accessories[accessory.lc7001Index].platformAccessoryIndex = accessoryIndex;
            this.updateAccessoryFromLC7001(this.accessories[accessoryIndex]);
        }
    }
}
exports.PlatformLC7001 = PlatformLC7001;
//# sourceMappingURL=platform.js.map