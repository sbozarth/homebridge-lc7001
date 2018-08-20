const events = require('events');
const net = require('net');

var lc7001 = {
        _commandID : 0,

	delimiter : '\0',
	tcpbuffer : '',
	isInitialized : false,

	accessories : [],
	commandQueue : [],
	responseQueue : [],

	emitter : new events.EventEmitter(),
	interface : new net.Socket(),

        get commandID() {
		if (this._commandID >= Number.MAX_SAFE_INTEGER) {
			this._commandID = 1;
		} else {
                	this._commandID = this._commandID + 1;
		}
                return this._commandID;
        },

	cmdGetAccessory : function(id) {
		var cmd = {};
		cmd.ID = this.commandID;
		cmd.Service = 'ReportZoneProperties';
		cmd.ZID = id;
		return cmd;
	},

        cmdListAccessories : function() {
		var cmd = {};
                cmd.ID = this.commandID;
                cmd.Service = 'ListZones';
		return cmd;
        },

        cmdGetLC7001Properties : function() {
		var cmd = {};
		cmd.ID = this.commandID;
		cmd.Service = 'ReportSystemProperties';
		return cmd;
	},

	cmdGetSystemInfo : function() {
		var cmd = {};
		cmd.ID = this.commandID;
		cmd.Service = 'SystemInfo';
		return cmd;
	},

	cmdSetAccessory : function(id,propertyList) {
		var cmd = {};
		cmd.ID = this.commandID;
		cmd.Service = 'SetZoneProperties';
		cmd.ZID = id;
		cmd.PropertyList = propertyList;
		return cmd;
	},

	isInitializedTest : function() {
		var testcase = true;
		if (this.ZoneList === undefined) {
			testcase = false;
		} else if (this.accessories === undefined) {
			testcase = false;
		} else if (this.accessories.length == 0) {
			testcase = false;
		} else {
			this.ZoneList.forEach(function(value,index,array) {
				if (this.accessories[value.ZID] === undefined) {
					testcase = false;
				}
			},this);
		}
		return testcase;
	},

	log : function(message) {
		console.log(message);
	},

	processResponseQueue : function() {
		var response = {};
		while (this.responseQueue.length > 0) {
			response = this.responseQueue.shift();
			if (response.ID == 0) {
				if (response.ArtikEvent !== undefined) {
					this.log('ArtikEvent ignored.');
				} else if (response.Service !== undefined) {
					switch(response.Service) {
						case 'BroadcastDiagnostics':
							this.FirmwareVersion = response.FirmwareVersion;
							this.firstSystemTime = response.firstSystemTime;
							this.shortMACAddress = response.MACAddress;
							this.lastDiagTime = response.CurrentTime;
							break;
						case 'BroadcastMemory':
							this.FreeMemory = response.FreeMemory;
							this.FreeMemLowWater = response.FreeMemLowWater;
							this.Malloc_Count = response.Malloc_Count;
							this.Free_Count = response.Free_Count;
							this.JsonConnections = response.JsonConnections;
							this.StaticRamUsage = response.StaticRamUsage;
							this.PeakRamUsage = response.PeakRamUsage;
							this.lastMemTime = response.CurrentTime;
							break;
						case 'ping':
							this.lastPingSeq = response.PingSeq;
							this.lastPingTime = response.CurrentTime;
							break;
						case 'SystemPropertiesChanged':
							this.sendCMD(this.cmdGetLC7001Properties());
							break;
						case 'ZonePropertiesChanged':
							if (this.accessories[response.ZID] === undefined) {
								this.accessories[response.ZID] = {};
							}
							this.accessories[response.ZID].ZID = response.ZID;
							Object.assign(this.accessories[response.ZID].PropertyList,response.PropertyList);
							this.emitter.emit('accessoryupdate',response.ZID);
							break;
						default:
							if (/^\*\*\*\*\*\* Got NTP -- IP:/.test(response.Service)) {
								this.lastNTPTime = response.PropertyList.CurrentTime;
							} else {
								this.log('Unknown LC7001 initiated service!');
								this.log(response);
							}
							break;
					}
				} else {
					this.log('Unknown LC7001 initiated object!');
					this.log(response);
				}
			} else {
				this.commandQueue.forEach(function(value,index,array) {
					if (value.ID == response.ID) {
						array.splice(index,1);
					}
				});
				switch(response.Service) {
					case 'ListZones':
						this.ZoneList = response.ZoneList;
						response.ZoneList.forEach(function(value,index,array) {
							this.sendCMD(this.cmdGetAccessory(value.ZID));
						},this);
						break;
					case 'ReportSystemProperties':
						this.AddASceneController = response.AddASceneController;
						this.AddALight = response.AddALight;
						this.TimeZone = response.TimeZone;
						this.Location = response.Location;
						this.EffectiveTimeZone = response.EffectiveTimeZone;
						this.Configured = response.Configured;
						this.SupportsSceneFadeRate = response.SupportSceneFadeRate;
						this.SamsungUserToken = response.SamsungUserToken;
						this.SamsungRefreshToken = response.SamsungRefreshToken
						this.MobileAppData = response.MobileAppData;
						this.lastSysPropTime = response.CurrentTime;
						break;
					case 'ReportZoneProperties':
						if (this.accessories[response.ZID] === undefined) {
							this.accessories[response.ZID] = {};
						}
						this.accessories[response.ZID].ZID = response.ZID;
						this.accessories[response.ZID].PropertyList = response.PropertyList;
						this.isInitialized = this.isInitializedTest();
						if (this.isInitialized) {
							this.emitter.emit('initialized');
						}
						break;
					case 'SetZoneProperties':
						//What do I do when something is set?
						break;
					case 'SystemInfo':
						this.Model = response.Model;
						this.FirmwareVersion = response.FirmwareVersion;
						this.FirmwareDate = response.FirmwareDate;
						this.FirmwareBranch = response.FirmwareBranch;
						this.MACAddress = response.MACAddress;
						this.HouseID = response.HouseID;
						this.UpdateState = response.UpdateState;
						break;
					default:
						this.log('Unhandled service: ' + response.Service);
						break;
				}
			}
		}

	},

	sendCMD : function(cmd) {
		this.interface.write((JSON.stringify(cmd) + this.delimiter), 'ascii', this.commandQueue.push(cmd));
	}
}

lc7001.interface.on('connect', function() {
	this.log('Connection to LC7001 established.');
	this.sendCMD(this.cmdGetSystemInfo());
	this.sendCMD(this.cmdGetLC7001Properties());
	this.sendCMD(this.cmdListAccessories());
}.bind(lc7001));

lc7001.interface.on('data', function(data) {
	var splitdata = data.split(this.delimiter);
	splitdata[0] = this.tcpbuffer + splitdata[0];
	this.tcpbuffer = splitdata[(splitdata.length-1)];
	splitdata.forEach(function(value,index,array) {
		if (value.length > 0) {
			try {
				this.responseQueue.push(JSON.parse(value));
			} catch(err) {
				console.log('Error parsing JSON.');
				console.log(err);
			}
		}
	},this);
	this.processResponseQueue();
}.bind(lc7001));

lc7001.interface.on('error', function(err) {
	this.log('Error on connection to LC7001.');
	this.log(err);
}.bind(lc7001));

module.exports = lc7001;
