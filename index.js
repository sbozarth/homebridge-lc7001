var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridgeAPI) {
	console.log('homebridge API version: ' + homebridgeAPI.version);

	Accessory = homebridgeAPI.platformAccessory;

	Service = homebridgeAPI.hap.Service;
	Characteristic = homebridgeAPI.hap.Characteristic;
	UUIDGen = homebridgeAPI.hap.uuid;

	homebridgeAPI.registerPlatform('homebridge-LC7001', 'LC7001', platformLC7001, true);
}

function platformLC7001(log, config, api) {
	log('LC7001 platform initialization.');
	var platform = this;

	this.accessories = [];
	this.config = config;
	this.hardware = require('./lib/lc7001.js');
	this.hardware.log = log;
	this.hostname = 'LCM1.local';
	this.log = log;
	this.port = 2112;

	if (api) {
		this.api = api;
		this.api.on('didFinishLaunching', function() {
			this.log('Homebridge issued DidFinishLaunching event.');
			this.log('Reading configuration for LC7001.');
			if (config['lc7001-hostname']) {
				this.hostname = config['lc7001-hostname'];
			}
			if (config['lc7001-port']) {
				this.port = config['lc7001-port'];
			}
			this.log('Attempting to connect to LC7001 at ' + this.hostname + ':' + this.port + '.');
			this.hardware.interface.connect(this.port,this.hostname,function() {
				this.setEncoding('ascii');
			});
		}.bind(this));
	}

	this.hardware.emitter.on('initialized',this.matchAccessorieswithLC7001.bind(this));
	this.hardware.emitter.on('accessoryupdate',function(lc7001ZID) {
		var updatedAccessory = this.getAccessoryfromZID(lc7001ZID);
		if (updatedAccessory === undefined) {
			this.log('LC7001 updated an accessory that is not registered with the plugin.');
		} else {
			this.updateAccessoryfromLC7001(updatedAccessory);
		}
	}.bind(this));
}

platformLC7001.prototype.configureAccessory = function(accessory) {
	this.log(accessory.displayName, 'Configure Accessory');
	var platform = this;
	accessory.reachable = true;

	accessory.on('identify', function(paired, callback) {
		platform.log(accessory.displayName, "Identify!!!");
		callback();
	});

	this.accessories.push(accessory);
}

platformLC7001.prototype.addAccessory = function(accessoryName,lc7001Index) {
	this.log('Adding accessory ' + accessoryName + ' with ZID ' + lc7001Index + '.');
	var platform = this;
	var uuid;

	uuid = UUIDGen.generate(accessoryName);

	var newAccessory = new Accessory(accessoryName, uuid);
	newAccessory.lc7001ZID = lc7001Index;

	switch(this.hardware.accessories[newAccessory.lc7001ZID].PropertyList.DeviceType) {
		case 'Switch':
			newAccessory.addService(Service.Lightbulb,accessoryName)
			break;
		case 'Dimmer':
			newAccessory.addService(Service.Lightbulb,accessoryName)
			break;
		default:
			this.log(accessoryName + ' has DeviceType=' + this.hardware.accessories[newAccessory.lc7001ZID].PropertyList.DeviceType + ' which is not supported. No services configured.');
			break;
	}

	this.configureAccessory(newAccessory);
	this.updateAccessoryfromLC7001(newAccessory);
	this.api.registerPlatformAccessories('homebridge-LC7001', 'LC7001', [newAccessory]);
}

platformLC7001.prototype.getAccessoryfromZID = function(lc7001ZID) {
	if (lc7001ZID !== undefined) {
		var foundAccessory = this.accessories.find(function(value,index,array) {
			return value.lc7001ZID === lc7001ZID;
		});
	}
	return foundAccessory;
}

platformLC7001.prototype.matchAccessorieswithLC7001 = function() {
	this.accessories.forEach(function(value,index,array) {
		var hardwareMatch = this.hardware.accessories.findIndex(function(value,index,array) {
			return value.PropertyList.Name == this.displayName;
		},value);
		if (hardwareMatch >= 0) {
			value.lc7001ZID = hardwareMatch;
			this.hardware.accessories[hardwareMatch].platformAccessoryIndex = index;
			this.updateAccessoryfromLC7001(value);
		} else {
			this.log('Unable to find accessory ' + value.displayName + ' on LC7001. Removing....');
			this.api.unregisterPlatformAccessories('homebridge-LC7001', 'LC7001', array.slice(index));
			array.splice(index,1);
		}
	},this);
	this.hardware.accessories.forEach(function(value,index,array) {
		if (value.platformAccessoryIndex === undefined) {
			this.log('Found new accessory on LC7001: ' + value.PropertyList.Name);
			this.addAccessory(value.PropertyList.Name,index);
		}
	},this);
}

platformLC7001.prototype.updateAccessoryfromLC7001 = function(updatedAccessory) {
	var platform = this;

	if ((updatedAccessory !== undefined) && (updatedAccessory.lc7001ZID !== undefined)) {
		if (this.hardware.accessories[updatedAccessory.lc7001ZID].PropertyList.Name != updatedAccessory.displayName) {
			if (this.hardware.isInitialized) {
				this.matchAccessorieswithLC7001();
			}
		}
		switch(this.hardware.accessories[updatedAccessory.lc7001ZID].PropertyList.DeviceType) {
			case 'Switch':
				if (this.hardware.accessories[updatedAccessory.lc7001ZID].PropertyList.Power != updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).value) {
					updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).updateValue(this.hardware.accessories[updatedAccessory.lc7001ZID].PropertyList.Power);
				}
				if (updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).listenerCount('set') == 0) {
					updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).on('set', function(value, callback) {
						if (updatedAccessory.lc7001ZID === undefined) {
							platform.log('Tried to set value before LC7001 initialized. This should not happen. No action taken.');
						} else {
							var propertyList = {};
							propertyList.Power = value;
							platform.hardware.sendCMD(platform.hardware.cmdSetAccessory(updatedAccessory.lc7001ZID,propertyList));
							callback();
						}
					});
				}
				break;
			case 'Dimmer':
				if (this.hardware.accessories[updatedAccessory.lc7001ZID].PropertyList.Power != updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).value) {
					updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).updateValue(this.hardware.accessories[updatedAccessory.lc7001ZID].PropertyList.Power);
				}
				if (this.hardware.accessories[updatedAccessory.lc7001ZID].PropertyList.PowerLevel != updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).value) {
					updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).updateValue(this.hardware.accessories[updatedAccessory.lc7001ZID].PropertyList.PowerLevel);
				}
				if (updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).listenerCount('set') == 0) {
					updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).on('set', function(value, callback) {
						if (updatedAccessory.lc7001ZID === undefined) {
							platform.log('Tried to set value before LC7001 initialized. This should not happen. No action taken.');
						} else {
							var propertyList = {};
							propertyList.Power = value;
							platform.hardware.sendCMD(platform.hardware.cmdSetAccessory(updatedAccessory.lc7001ZID,propertyList));
							callback();
						}
					});
				}
				if (updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).listenerCount('set') == 0) {
					updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).on('set', function(value, callback) {
						if (updatedAccessory.lc7001ZID === undefined) {
							platform.log('Tried to set value before LC7001 initialized. This should not happen. No action taken.');
						} else {
							var propertyList = {};
							propertyList.PowerLevel = value;
							platform.hardware.sendCMD(platform.hardware.cmdSetAccessory(updatedAccessory.lc7001ZID,propertyList));
							callback();
						}
					});
				}
				break;
			default:
				this.log('This plugin has not been programmed for this particular accessory.');
				break;
		}
	}
}

platformLC7001.prototype.updateAccessoriesReachability = function() {
	this.log('Update Reachability');
	for (var index in this.accessories) {
		var accessory = this.accessories[index];
		accessory.updateReachability(false);
	}
}
