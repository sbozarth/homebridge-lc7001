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
	this.log = log;
	this.config = config;
	this.hardware = require('./lib/lc7001.js');
	this.hardware.log = log;
	this.accessories = [];
	if (api) {
		this.api = api;
		this.api.on('didFinishLaunching', function() {
			platform.log('DidFinishLaunching');
		}.bind(this));
	}
	if (config['lc7001-hostname']) {
		this.hardware.hostname = config['lc7001-hostname'];
		if (config['lc7001-port']) {
			this.hardware.port = config['lc7001-port'];
		}
		this.log('Attempting to connect to LC7001 at ' + this.hardware.hostname + ':' + this.hardware.port + '.');
		this.hardware.openConnection();
	} else {
		this.log('No hostname configured. Nothing to do.');
	}
	this.hardware.emitter.on('initialized',function() {
		this.accessories.forEach(function(value,index,array) {
			var hardwareMatch = this.hardware.accessories.findIndex(function(value,index,array) {
				return value.PropertyList.Name == this.displayName;
			},value);
			if (hardwareMatch >= 0) {
				value.lc7001ZID = hardwareMatch;
				this.hardware.accessories[hardwareMatch].platformAccessoryIndex = index;
				this.updateAccessoryfromLC7001(hardwareMatch);
			} else {
				array.splice(index,1);
			}
		},this);
		this.hardware.accessories.forEach(function(value,index,array) {
			if (value.platformAccessoryIndex === undefined) {
				this.addAccessory(value.PropertyList.Name,index);
			}
		},this);
	}.bind(this));
	this.hardware.emitter.on('accessoryupdate', this.updateAccessoryfromLC7001.bind(this));
}

platformLC7001.prototype.configureAccessory = function(accessory) {
	this.log(accessory.displayName, 'Configure Accessory');
	var platform = this;
	accessory.reachable = true;

	accessory.on('identify', function(paired, callback) {
		platform.log(accessory.displayName, "Identify!!!");
		callback();
	});

	if (accessory.getService(Service.Lightbulb)) {
		accessory.getService(Service.Lightbulb)
		.getCharacteristic(Characteristic.On)
		.on('set', function(value, callback) {
			if (accessory.lc7001ZID === undefined) {
				this.log('Tried to set value before LC7001 initialized. No action taken.');
			} else {
				var propertyList = {};
				propertyList.Power = value;
				platform.hardware.sendCMD(platform.hardware.cmdSetAccessory(accessory.lc7001ZID,propertyList));
				callback();
			}
		});
		accessory.getService(Service.Lightbulb)
		.getCharacteristic(Characteristic.Brightness)
		.on('set', function(value, callback) {
			if (accessory.lc7001ZID === undefined) {
				this.log('Tried to set value before LC7001 initialized. No action taken.');
			} else {
				var propertyList = {};
				propertyList.PowerLevel = value;
				platform.hardware.sendCMD(platform.hardware.cmdSetAccessory(accessory.lc7001ZID,propertyList));
				callback();
			}
		});
	}

	this.accessories.push(accessory);
}

platformLC7001.prototype.configurationRequestHandler = function(context, request, callback) {
	this.log('Context: ', JSON.stringify(context));
	this.log('Request: ', JSON.stringify(request));

	if (request && request.response && request.response.inputs && request.response.inputs.name) {
		this.addAccessory(request.response.inputs.name);

		callback(null, 'platform', true, {"platform":"platformLC7001"});
	}

	var respDict = {
		"type":"Interface",
		"interface":"input",
		"title":"Add Accessory",
		"items":[
			{
				"id":"name",
				"title":"Name",
				"placeholder":"LC7001 Light"
			}
		]
	}

	context.ts = 'Hello';

	callback(respDict);
}

platformLC7001.prototype.addAccessory = function(accessoryName,lc7001Index) {
	this.log('Add Accessory');
	var platform = this;
	var uuid;

	uuid = UUIDGen.generate(accessoryName);

	var newAccessory = new Accessory(accessoryName, uuid);
	newAccessory.lc7001ZID = lc7001Index;

	newAccessory.on('identify', function(paired, callback) {
		platform.log(newAccessory.displayName, 'Identify!!!');
		callback();
	});

	newAccessory.addService(Service.Lightbulb,accessoryName)
	.getCharacteristic(Characteristic.On)
	.on('set', function(value, callback) {
		if (newAccessory.lc7001ZID === undefined) {
			this.log('Tried to set value before LC7001 initialized. No action taken.');
		} else {
			var propertyList = {};
			propertyList.Power = value;
			platform.hardware.sendCMD(platform.hardware.cmdSetAccessory(newAccessory.lc7001ZID,propertyList));
			callback();
		}
	});
 	if (platform.hardware.accessories[newAccessory.lc7001ZID].PropertyList.DeviceType == 'Dimmer') {
		newAccessory.getService(Service.Lightbulb)
		.getCharacteristic(Characteristic.Brightness)
		.on('set', function(value, callback) {
			if (newAccessory.lc7001ZID === undefined) {
				this.log('Tried to set value before LC7001 initialized. No action taken.');
			} else {
				var propertyList = {};
				propertyList.PowerLevel = value;
				platform.hardware.sendCMD(platform.hardware.cmdSetAccessory(newAccessory.lc7001ZID,propertyList));
				callback();
			}
		});
	}

	this.accessories.push(newAccessory);
	this.api.registerPlatformAccessories('homebridge-LC7001', 'LC7001', [newAccessory]);
}

platformLC7001.prototype.updateAccessoryfromLC7001 = function(lc7001ZID) {
	if (lc7001ZID !== undefined) {
		var updatedAccessory = this.accessories.find(function(value,index,array) {
			return value.lc7001ZID === lc7001ZID;
		});
	}
	if (updatedAccessory === undefined) {
		this.log('Attempted to update an accessory with no LC7001 zone association. The ZID was ' + lc7001ZID + '.');
	} else {
		if (this.hardware.accessories[lc7001ZID].PropertyList.Name != updatedAccessory.displayName) {
			console.log('Name change!');
			console.log('LC7001: ' + this.hardware.accessories[lc7001ZID].PropertyList.Name + ' Homebridge: ' + updatedAccessory.displayName);
			//updatedAccessory.displayName = value.Name;
		}
		if (this.hardware.accessories[lc7001ZID].PropertyList.Power != updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).value) {
			updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).updateValue(this.hardware.accessories[lc7001ZID].PropertyList.Power);
		}
		if (this.hardware.accessories[lc7001ZID].PropertyList.PowerLevel != updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).value) {
			updatedAccessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).updateValue(this.hardware.accessories[lc7001ZID].PropertyList.PowerLevel);
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

platformLC7001.prototype.removeAccessory = function() {
	this.log('Remove Accessory');
	this.api.unregisterPlatformAccessories('homebridge-LC7001', 'LC7001', this.accessories);

	this.accessories = [];
}

platformLC7001.prototype.processAccessories = function() {
	if (this.accessories.length == 0) {
		console.log('No platform accessories.');
	}
}
