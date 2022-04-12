import {
  TcpSocketConnectOpts
} from 'net';

import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback
} from 'homebridge';

import {
  PLATFORM_NAME,
  PLUGIN_NAME
} from './settings';

import {
  LC7001
} from './lc7001';

interface MyPlatformAccessory extends PlatformAccessory {
  lc7001Index?: number;
}

export class PlatformLC7001 implements DynamicPlatformPlugin {
  //Homebridge Properties
  public readonly Service: typeof           Service = this.api.hap.Service;
  public readonly Characteristic: typeof    Characteristic = this.api.hap.Characteristic;
  // this is used to track restored cached accessories
  public readonly accessories:              MyPlatformAccessory[] = [];

  //Homebrige-derived propertis
  private isInitialized:                    boolean = false;

  //Configuration properties
  public readonly logBroadcastDiagnostics:  boolean = false;
  public readonly logBroadcastMemory:       boolean = false;
  public readonly logDebugMessages:         boolean = false;
  public readonly logEliotErrors:           boolean = false;
  private readonly useOldUUID:              boolean = false;

  //LC7001 Properties
  private lc7001:                           LC7001;
  private readonly password:                string = '';
  private readonly tcpOptions:              TcpSocketConnectOpts = {host:'LCM1.local',port:2112};
  private readonly jsonDelimiter:           string = '\0';
  private readonly tcptimeout:              number = 30;
  private readonly tcpretrywait:            number = 30;

  constructor(
    public readonly log:    Logger,
    public readonly config: PlatformConfig,
    public readonly api:    API,
  ) {
    this.log.info('Platform initializing....');
    this.log.debug('Parsing platform configuration:');
    for (var propertyNameConfig in this.config) {
      if (propertyNameConfig == 'lc7001-password') {
        this.log.debug('-->',propertyNameConfig,': ********');
      } else {
        this.log.debug('-->',propertyNameConfig,':',this.config[propertyNameConfig]);
      }
    };
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
    if ('lc7001-tcptimeout' in this.config) {
      this.tcptimeout = this.config['lc7001-tcptimeout'];
    }
    if ('lc7001-tcpretrywait' in this.config) {
      this.tcpretrywait = this.config['lc7001-tcpretrywait'];
    }
    if ('logBroadcastDiagnostics' in this.config) {
      this.logBroadcastDiagnostics = this.config['logBroadcastDiagnostics']
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
    this.log.debug('--> host:',this.tcpOptions.host);
    this.log.debug('--> port:',this.tcpOptions.port);
    if (this.tcpOptions.localAddress) {
      this.log.debug('--> localAddress:',this.tcpOptions.localAddress);
    };
    if (this.tcpOptions.localPort) {
      this.log.debug('--> localPort:',this.tcpOptions.localPort);
    }
    if (this.tcpOptions.family) {
      this.log.debug('--> family:',this.tcpOptions.family);
    }
    if (this.jsonDelimiter) {
      this.log.debug('Delimiter:',JSON.stringify(this.jsonDelimiter));
    }
    if (this.jsonDelimiter) {
      this.log.debug('TCP Timeout:',this.tcptimeout);
    }
    if (this.jsonDelimiter) {
      this.log.debug('TCP Retry Wait Time:',this.tcpretrywait);
    }
    
    this.log.debug('Creating LC7001 interface....');
    this.lc7001 = new LC7001(this,this.password,this.tcpOptions,this.jsonDelimiter,this.tcptimeout,this.tcpretrywait);
    this.log.debug('LC7001 interface created.');
    this.lc7001.emitter.on('initialized',() => {
      this.log.debug('Received "initialized" event from LC7001 module.');
      if (this.isInitialized) {
        this.log.debug('Platform is initialized. Running matching....');
        this.matchAccessoriesToLC7001();
      } else {
        this.log.debug('Platform net yet initialized. Matching deferred.');
      }
    });
    this.lc7001.emitter.on('accessoryUpdate',(accessoryIndex) => {
      this.log.debug('Received "accessoryUpdate" event from LC7001 module for index:',accessoryIndex);
      if (accessoryIndex in this.accessories) {
        this.updateAccessoryFromLC7001(this.accessories[accessoryIndex]);
      } else {
        this.log.warn('LC7001 requested update to accessory index:',accessoryIndex,' Index missing in accessories[].');
        if (this.lc7001.isInitialized) {
          this.log.debug('Rerunning matching....');
          this.matchAccessoriesToLC7001();
        }
      }
    });

    this.log.info('Platform initialized.')
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Received "didFinishLaunching" event from API.');
      this.isInitialized = true;
      if (this.lc7001.isInitialized) {
        this.log.debug('LC7001 is initialized. Running matching....');
        this.matchAccessoriesToLC7001();
      } else {
        this.log.debug('LC7001 not yet initialized. Matching deferred.');
      }
    });
  }

  private addAccessory(accessoryName: string,lc7001Index: number): void {
    var uuid:string;
    this.log.info('Adding accessory',accessoryName,'from zone',lc7001Index,'on LC7001.');
    this.log.debug('Generating UUID. Accessory name:',accessoryName,'MAC Address:',this.lc7001.macAddress);
    if (this.useOldUUID) {
      this.log.debug('Using old UUID key....');
      uuid = this.api.hap.uuid.generate(accessoryName);
    } else {
      uuid = this.api.hap.uuid.generate(accessoryName + this.lc7001.macAddress);
    }
    this.log.debug('UUID generated:',uuid);
    var newAccessory: MyPlatformAccessory = new this.api.platformAccessory(accessoryName,uuid);
    newAccessory.getService(this.api.hap.Service.AccessoryInformation)!
    .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "Legrand")
    .setCharacteristic(this.api.hap.Characteristic.Model, this.lc7001.accessories[lc7001Index].PropertyList.DeviceType)
    .setCharacteristic(this.api.hap.Characteristic.SerialNumber, (this.lc7001.macAddress + ("00" + lc7001Index).slice(-2)));
    newAccessory.lc7001Index = lc7001Index;
    this.log.debug('Configuring services for',accessoryName,'....');
    switch(this.lc7001.accessories[lc7001Index].PropertyList.DeviceType) {
      case 'Switch':
        this.log.debug('Configuring',accessoryName,'as a Service.Lightbulb and Switch.')
        newAccessory.addService(this.api.hap.Service.Lightbulb,accessoryName,'Switch');
        break;
      case 'Dimmer':
        this.log.debug('Configuring',accessoryName,'as a Service.Lightbulb and Dimmer.')
        newAccessory.addService(this.api.hap.Service.Lightbulb,accessoryName,'Dimmer');
        newAccessory.getService(this.api.hap.Service.Lightbulb)!.addCharacteristic(this.api.hap.Characteristic.Brightness);
        break;
      default:
        this.log.error(accessoryName,'has DeviceType =',this.lc7001.accessories[lc7001Index].PropertyList.DeviceType,'which is not supported. No services configured.');
        break;
    }
    this.configureAccessory(newAccessory);
    this.api.registerPlatformAccessories(PLUGIN_NAME,PLATFORM_NAME,[newAccessory]);
  }

  private findLC7001IndexByName(accessoryName: string): number {
    this.log.debug('Finding',accessoryName,'on LC7001 accessories list....');
    var lc7001Index = this.lc7001.accessories.findIndex((value) => {
      if (value !== undefined) {
        if ('PropertyList' in value) {
          if ('Name' in value.PropertyList) {
            return value.PropertyList.Name == accessoryName;
          } else {
            return false;
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    });
    return lc7001Index;
  }

  private matchAccessoriesToLC7001():void {
    var addAccessories:     number[] = [];
    var deleteAccessories:  PlatformAccessory[] = [];
    var cleanMatch:         boolean = false;
    while (!cleanMatch) {
      cleanMatch = true;
      this.log.debug('Matching platform accessories to LC7001 accessories....');
      if (this.accessories.length == 0) {
        this.log.debug('No platform accessories to match.');
      }
      this.accessories.forEach((value,index,array) => {
        this.log.debug('Matching',value.displayName,'to LC7001 accessories list....');
        var lc7001Match = this.findLC7001IndexByName(value.displayName);
        if (lc7001Match >= 0) {
          this.log.debug('Match found. LC7001 zone:',lc7001Match);
          value.lc7001Index = lc7001Match;
          this.lc7001.accessories[lc7001Match].platformAccessoryIndex = index;
          this.updateAccessoryFromLC7001(value);
        } else {
          this.log.debug('No matching LC7001 accessory found.');
          cleanMatch = false;
          deleteAccessories.push(value);
        }
      });
      if (deleteAccessories.length > 0) {
        deleteAccessories.forEach((value) => {
          this.log.info('Unable to find accessory',value.displayName,'on LC7001. Removing....');
          this.accessories.splice(this.accessories.indexOf(value),1);
        });
        this.api.unregisterPlatformAccessories(PLUGIN_NAME,PLATFORM_NAME,deleteAccessories);
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
    this.lc7001.accessories.forEach((value,index) => {
      if (value.platformAccessoryIndex === undefined) {
        this.log.debug('LC7001 zone',index,'is not matched to a platform accessory.');
        addAccessories.push(index);
      } else {
        this.log.debug('LC7001 zone',index,'is matched to platform accessory index',value.platformAccessoryIndex);
      }
    });
    while (addAccessories.length > 0) {
      var addIndex:number = addAccessories.shift()!;
      this.log.info('Found new accessory on LC7001:',this.lc7001.accessories[addIndex].PropertyList.Name);
      this.addAccessory(this.lc7001.accessories[addIndex].PropertyList.Name,addIndex);
    }
  }

  private updateAccessoryFromLC7001(updatedAccessory: MyPlatformAccessory): void {
    if (updatedAccessory !== undefined && updatedAccessory.lc7001Index !== undefined) {
      this.log.debug('Updating accessory',updatedAccessory.displayName,'....');
      const lc7001Accessory = this.lc7001.accessories[updatedAccessory.lc7001Index];
      if (lc7001Accessory.PropertyList.Name != updatedAccessory.displayName) {
        this.log.warn('Accessory',updatedAccessory.displayName,'has a name mismatch with LC7001 accessory',lc7001Accessory.PropertyList.Name,'at zone:',updatedAccessory.lc7001Index,'Disassociated match.');
        updatedAccessory.lc7001Index = undefined;
        lc7001Accessory.platformAccessoryIndex = undefined;
        if (this.lc7001.isInitialized) {
          this.log.debug('Rerunning matching....');
          this.matchAccessoriesToLC7001();
        }
      } else {
        switch(lc7001Accessory.PropertyList.DeviceType) {
          case 'Switch':
            if (lc7001Accessory.PropertyList.Power != updatedAccessory.getService(this.api.hap.Service.Lightbulb)!.getCharacteristic(this.api.hap.Characteristic.On).value) {
              this.log.debug('Updating Service.Lightbulb Characteristic.On.')
              updatedAccessory.getService(this.api.hap.Service.Lightbulb)!.getCharacteristic(this.api.hap.Characteristic.On).updateValue(lc7001Accessory.PropertyList.Power);
            }
            break;
          case 'Dimmer':
            if (lc7001Accessory.PropertyList.Power != updatedAccessory.getService(this.api.hap.Service.Lightbulb)!.getCharacteristic(this.api.hap.Characteristic.On).value) {
              this.log.debug('Updating Service.Lightbulb Characteristic.On.')
              updatedAccessory.getService(this.api.hap.Service.Lightbulb)!.getCharacteristic(this.api.hap.Characteristic.On).updateValue(lc7001Accessory.PropertyList.Power);
            }
            if (lc7001Accessory.PropertyList.PowerLevel != updatedAccessory.getService(this.api.hap.Service.Lightbulb)!.getCharacteristic(this.api.hap.Characteristic.Brightness).value) {
              this.log.debug('Updating Service.Lightbulb Characteristic.Brightness.')
              updatedAccessory.getService(this.api.hap.Service.Lightbulb)!.getCharacteristic(this.api.hap.Characteristic.Brightness).updateValue(lc7001Accessory.PropertyList.PowerLevel);
            }
            break;
          default:
            this.log.error('Cannot configure accessory:',lc7001Accessory.PropertyList.Name);
            this.log.error(PLUGIN_NAME,'has not been programmed for the device type:',lc7001Accessory.PropertyList.DeviceType);
            break;
        }
      }
    } else {
      if (updatedAccessory === undefined) {
        this.log.error('Method updateAccessoryFromLC7001() called on undefined accessory.');
      } else {
        this.log.debug('Asked to updated accessory',updatedAccessory.displayName,' which has no LC7001 accessory associated with it. Skipping....');
        if (this.lc7001.isInitialized) {
          this.log.debug('Rerunning matching....');
          this.matchAccessoriesToLC7001();
        }
      }
    }
  }

  public configureAccessory(accessory: MyPlatformAccessory) {
    this.log.info('Configuring accessory:',accessory.displayName);
    this.log.debug('Adding listener for "identify" event.')
   accessory.on('identify', () => {
      this.log.info('Accessory',accessory.displayName,'identified.');
    });
    if (accessory.getService(this.api.hap.Service.Lightbulb) !== undefined) {
      if (accessory.getService(this.api.hap.Service.Lightbulb)!.testCharacteristic(this.api.hap.Characteristic.On)) {
        this.log.debug('Adding listener for Service.LightBulb Characteristic.On "set" event.')
        accessory.getService(this.api.hap.Service.Lightbulb)!.getCharacteristic(this.api.hap.Characteristic.On).on('set',(value: CharacteristicValue,callback: CharacteristicSetCallback) => {
          this.log.debug('HomeKit set Service.LightBulb Characteristic.On for',accessory.displayName,'to:',value);
          if (accessory.lc7001Index === undefined) {
            this.log.debug('Accessory updated by HomeKit before LC7001 initialized. No action taken.');
          } else {
            var PropertyList:any = {};
            PropertyList.Power = value;
            this.lc7001.setAccessory(accessory.lc7001Index,PropertyList);
          }
          callback();
        });
      }
      if (accessory.getService(this.api.hap.Service.Lightbulb)!.testCharacteristic(this.api.hap.Characteristic.Brightness)) {
        this.log.debug('Adding listener for Service.LightBulb Characteristic.Brightness "set" event.')
        accessory.getService(this.api.hap.Service.Lightbulb)!.getCharacteristic(this.api.hap.Characteristic.Brightness).on('set',(value: CharacteristicValue,callback: CharacteristicSetCallback) => {
          this.log.debug('HomeKit set Service.LightBulb Characteristic.Brightness for',accessory.displayName,'to:',value);
          if (accessory.lc7001Index === undefined) {
            this.log.debug('Accessory updated by HomeKit before LC7001 initialized. No action taken.');
          } else {
            var PropertyList:any = {};
            PropertyList.PowerLevel = value;
            this.lc7001.setAccessory(accessory.lc7001Index,PropertyList);
          }
          callback();
        });
      }
    }
    var accessoryIndex = this.accessories.push(accessory) - 1;
    this.log.debug('Accessory',accessory.displayName,'configured at index:',accessoryIndex);
    if (accessory.lc7001Index !== undefined) {
      this.log.debug('LC7001 zone',this.accessories[accessoryIndex].lc7001Index,'is matched to platform accessory index',accessoryIndex);
      this.lc7001.accessories[accessory.lc7001Index].platformAccessoryIndex = accessoryIndex;
      this.updateAccessoryFromLC7001(this.accessories[accessoryIndex]);
    }
  }

}
