"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LC7001 = void 0;
//LC7001 module will emit events when it initializes or an accessory is updated.
const events_1 = require("events");
const net_1 = require("net");
class LC7001 {
    constructor(platform, tcpOptions, delimiter = '\0') {
        this.platform = platform;
        //Interface to platform
        this.accessories = [];
        this.isInitialized = false;
        //Private properties
        this._commandID = 0;
        this.tcpBuffer = '';
        this.commandQueue = [];
        this.responseQueue = [];
        //LC7001-supplied properties
        this.addALight = false;
        this.addASceneController = false;
        this.authExempt = undefined;
        this.configured = undefined;
        this.connectionSequenceNumber = undefined;
        this.daylightSavingtime = undefined;
        this.effectiveTimeZone = undefined;
        this.firmwareBranch = undefined;
        this.firmwareDate = undefined;
        this.firmwareVersion = undefined;
        this.firstSystemTime = undefined;
        this.firstTimeRecorded = undefined;
        this.freeMemory = undefined;
        this.freeMemLowWater = undefined;
        this.free_Count = undefined;
        this.houseID = undefined;
        this.jsonConnections = undefined;
        this.jsonErr = undefined;
        this.location = undefined;
        this.locationInfo = undefined;
        this.mac = undefined;
        this.macAddress = undefined;
        this.malloc_Count = undefined;
        this.mobileAppData = undefined;
        this.model = undefined;
        this.otherRecvErr = undefined;
        this.peakRamUsage = undefined;
        this.qmotionTryFind = undefined;
        this.shortMACAddress = undefined;
        this.staticRamUsage = undefined;
        this.supportsSceneFadeRate = undefined;
        this.taskHeartbeatBitmask = undefined;
        this.timeZone = undefined;
        this.updateState = undefined;
        this.zoneList = [];
        //Depricated properties
        //private samsungUserToken:         any = undefined;
        //private samsungRefreshToken:      any = undefined;
        //LC7001-derived properties
        this.lastDiagTime = undefined;
        this.lastMemTime = undefined;
        this.lastNTPTime = undefined;
        this.lastPingSeq = undefined;
        this.lastPingTime = undefined;
        this.lastSysPropTime = undefined;
        this.tcpOptions = tcpOptions;
        this.delimiter = delimiter;
        this.emitter = new events_1.EventEmitter;
        this.interface = new net_1.Socket();
        this.interface.on('connect', () => {
            this.platform.log.info('Connection to LC7001 established.');
            this.platform.log.debug('-->IP Version:      ', this.interface.remoteFamily);
            this.platform.log.debug('-->IP Address:      ', this.interface.remoteAddress);
            this.platform.log.debug('-->TCP Port:        ', this.interface.remotePort);
            this.platform.log.debug('-->Local IP Address:', this.interface.localAddress);
            this.platform.log.debug('-->Local TCP Port:  ', this.interface.localPort);
        });
        this.interface.on('close', (hadError) => {
            if (hadError) {
                this.platform.log.error('Connection to LC7001 closed due to error. Waiting 30 seconds to reconnect....');
                setTimeout(this.connectLC7001.bind(this), 30000);
            }
            else {
                this.platform.log.info('Connection to LC7001 closed. Reconnecting....');
                this.connectLC7001();
            }
        });
        this.interface.on('data', (data) => {
            this.platform.log.debug('Data received from LC7001 (stringified):', JSON.stringify(data));
            if (data.length <= 0) {
                this.platform.log.debug('Length of data is zero! Nothing to do.');
            }
            else {
                this.processBuffer(data);
            }
        });
        this.interface.on('error', (err) => {
            this.platform.log.error('Error on LC7001 connection:', err.toString());
        });
        this.interface.on('ready', () => {
            this.platform.log.debug('Connection to LC7001 ready for use.');
            this.sendCMDArray([this.cmdGetSystemInfo(), this.cmdGetLC7001Properties(), this.cmdListAccessories()]);
        });
        this.interface.on('timeout', () => {
            this.platform.log.warn('Connection to LC7001 has been inactive for 30 seconds. Destroying connection....');
            this.interface.destroy();
        });
        this.connectLC7001();
    }
    checkInitialized() {
        this.platform.log.debug('Testing to see if LC7001 interface is initialized....');
        this.isInitialized = this.isInitializedTest();
        if (this.isInitialized) {
            this.platform.log.debug('LC7001 interface is initialized. Emitting "initialized" event....');
            this.emitter.emit('initialized');
        }
        else {
            this.platform.log.debug('LC7001 interface is not initialized.');
        }
    }
    //LC7001 sends a response with the name ID as the command. We utilize an ID field that is inrecemented every time it is requested to serialize commands.
    get commandID() {
        if (this._commandID >= Number.MAX_SAFE_INTEGER) {
            this._commandID = 1;
        }
        else {
            this._commandID = this._commandID + 1;
        }
        return this._commandID;
    }
    cmdGetAccessory(id) {
        var cmd = {};
        this.platform.log.debug('Building ReportZoneProperties command....');
        cmd.ID = this.commandID;
        cmd.Service = 'ReportZoneProperties';
        cmd.ZID = id;
        this.platform.log.debug('Command:', cmd);
        return cmd;
    }
    cmdGetLC7001Properties() {
        var cmd = {};
        this.platform.log.debug('Building ReportSystemProperties command....');
        cmd.ID = this.commandID;
        cmd.Service = 'ReportSystemProperties';
        this.platform.log.debug('Command:', cmd);
        return cmd;
    }
    cmdGetSystemInfo() {
        var cmd = {};
        this.platform.log.debug('Building SystemInfo command....');
        cmd.ID = this.commandID;
        cmd.Service = 'SystemInfo';
        this.platform.log.debug('Command:', cmd);
        return cmd;
    }
    cmdListAccessories() {
        var cmd = {};
        this.platform.log.debug('Building ListZones command....');
        cmd.ID = this.commandID;
        cmd.Service = 'ListZones';
        this.platform.log.debug('Command:', cmd);
        return cmd;
    }
    cmdSetAccessory(id, PropertyList) {
        var cmd = {};
        this.platform.log.debug('Building SetZoneProperties command....');
        cmd.ID = this.commandID;
        cmd.Service = 'SetZoneProperties';
        cmd.ZID = id;
        cmd.PropertyList = PropertyList;
        this.platform.log.debug('Command:', cmd);
        return cmd;
    }
    connectLC7001() {
        this.platform.log.info('Connecting to LC7001....');
        this.platform.log.debug('TCP Options:');
        this.platform.log.debug('--> host:', this.tcpOptions.host);
        this.platform.log.debug('--> port:', this.tcpOptions.port);
        this.platform.log.debug('--> localAddress:', this.tcpOptions.localAddress);
        this.platform.log.debug('--> localPort:', this.tcpOptions.localPort);
        this.platform.log.debug('--> family:', this.tcpOptions.family);
        this.interface.connect(this.tcpOptions, () => {
            this.interface.setEncoding('ascii');
            this.interface.setTimeout(30000);
        });
    }
    //LC7001 is initialized when zone list is populated and properties from each zone have been queried.
    //If the LC7001 has no zones, it will never be initialized.
    isInitializedTest() {
        var testcase = true;
        if (this.zoneList.length == 0) {
            this.platform.log.debug('Zone list is empty: Fail');
            testcase = false;
        }
        else {
            this.platform.log.debug('Zone list is populated: Pass');
            if (this.accessories.length == 0) {
                this.platform.log.debug('Accessories list is empty: Fail');
                testcase = false;
            }
            else {
                this.zoneList.forEach((value) => {
                    if (this.accessories[value.ZID] === undefined) {
                        this.platform.log.debug('Zone', value.ZID, 'is missing from accessories list: Fail');
                        testcase = false;
                    }
                    else {
                        this.platform.log.debug('Found zone', value.ZID, 'on accessories list: Pass');
                    }
                });
            }
        }
        return testcase;
    }
    processBuffer(data) {
        var testJSON;
        this.platform.log.debug('Processing data received from LC7001....');
        this.platform.log.debug('Starting buffer:', JSON.stringify(this.tcpBuffer));
        this.platform.log.debug('Data received:', JSON.stringify(data));
        this.platform.log.debug('Delimiter:', JSON.stringify(this.delimiter));
        var splitBuffer = data.split(this.delimiter);
        this.platform.log.debug('Segments received:', splitBuffer.length);
        splitBuffer.forEach((value, index) => {
            this.platform.log.debug('-->', (index + 1), ':', JSON.stringify(value));
        });
        try {
            testJSON = JSON.parse(splitBuffer[0]);
        }
        catch (_a) {
            this.platform.log.debug('First segment is not good JSON.... Prepending buffer.');
            splitBuffer[0] = this.tcpBuffer + splitBuffer[0];
        }
        this.tcpBuffer = splitBuffer.pop();
        this.platform.log.debug('Processed segments:', splitBuffer.length);
        splitBuffer.forEach((value, index) => {
            this.platform.log.debug('-->', (index + 1), ':', JSON.stringify(value));
        });
        this.platform.log.debug('Ending buffer:', JSON.stringify(this.tcpBuffer));
        if (splitBuffer.length > 0) {
            this.platform.log.debug('Adding JSON to Receive Queue....');
            splitBuffer.forEach((value, index) => {
                try {
                    this.responseQueue.push(JSON.parse(value));
                }
                catch (_a) {
                    if (value.indexOf('}{') >= 0) {
                        this.platform.log.warn('Error parsing JSON. Possible undelimited JSON detected. Replacing all }{s with delimited version.');
                        var splitvalue = value.replace(/\}\{/g, ('}' + this.delimiter + '{')).split(this.delimiter);
                        this.platform.log.debug('Salvaged segments:', splitvalue.length);
                        splitvalue.forEach((value2, index2) => {
                            this.platform.log.debug('-->', (index2 + 1), ':', JSON.stringify(value2));
                        });
                        splitvalue.forEach((value2, index2) => {
                            try {
                                this.responseQueue.push(JSON.parse(value2));
                                this.platform.log.info('Succcesfully salvaged JSON.');
                            }
                            catch (err) {
                                this.platform.log.error('Unable to parse JSON:\n', value2);
                                this.platform.log.debug('Salvaged segment', (index2 + 1), 'is not good JSON.');
                                this.platform.log.debug('Skipping....');
                            }
                        });
                    }
                    else {
                        this.platform.log.error('Unable to parse JSON:\n', value);
                        this.platform.log.debug('Segment', (index + 1), 'is not good JSON.');
                        this.platform.log.debug('Skipping....');
                    }
                }
            });
        }
        if (this.tcpBuffer.length > 0) {
            this.platform.log.debug('Testing ending buffer for good JSON....');
            try {
                this.responseQueue.push(JSON.parse(this.tcpBuffer));
                this.platform.log.debug('Buffer is good JSON. Pushed to Receive Queue and clearing buffer.');
                this.tcpBuffer = '';
            }
            catch (_b) {
                this.platform.log.debug('Buffer is not good JSON. Holding buffer.');
            }
        }
        this.processresponseQueue();
    }
    processresponseQueue() {
        var message = {};
        var postProcessing;
        var runCheckInitialized = false;
        var runScanAccessories = false;
        this.platform.log.debug('Processing Receive Queue....');
        this.platform.log.debug('Receive Queue length:', this.responseQueue.length);
        if (this.responseQueue.length == 0) {
            this.platform.log.debug('Receive Queue empty; nothing to do.');
        }
        else {
            this.platform.log.debug('Receive Queue contents:');
            this.responseQueue.forEach((value, index) => {
                this.platform.log.debug('-->', (index + 1), ':', JSON.stringify(value));
            }, this);
            while (this.responseQueue.length > 0) {
                message = this.responseQueue.shift();
                if ('ID' in message && message.ID > 0) {
                    this.platform.log.debug('Message contains non-zero ID. Checking Command Queue for matching command....');
                    this.commandQueue.forEach((value, index, array) => {
                        if (value.ID == message.ID) {
                            this.platform.log.debug('Found matching command:', value);
                            this.platform.log.debug('Removing command from Command Queue.');
                            array.splice(index, 1);
                        }
                    });
                }
                postProcessing = this.processLC7001Message(message);
                if (postProcessing[0]) {
                    runCheckInitialized = true;
                }
                if (postProcessing[1]) {
                    this.isInitialized = false;
                    runCheckInitialized = true;
                }
            }
            if (!runCheckInitialized && !runScanAccessories) {
                this.platform.log.debug('Response Queue empty. No post-processing requested.');
            }
            else {
                this.platform.log.debug('Response Queue empty. Running post-processing....');
                if (runCheckInitialized) {
                    this.platform.log.debug('Initialization check requested.');
                    this.checkInitialized();
                }
                if (runScanAccessories) {
                    this.platform.log.debug('Accessory scan requested.');
                }
            }
        }
    }
    processLC7001Message(message) {
        var checkInitializedWhenDone = false;
        var rescanAccessoriesWhenDone = false;
        this.platform.log.debug('Processing message:', JSON.stringify(message));
        if ('ID' in message) {
            if ('Service' in message) {
                switch (message.Service) {
                    case 'BroadcastDiagnostics':
                        this.platform.log.debug('Message type: BroadcastDiagnostics');
                        this.firmwareVersion = message.FirmwareVersion;
                        this.firstSystemTime = message.firstSystemTime;
                        this.shortMACAddress = message.MACAddress;
                        this.connectionSequenceNumber = message.connectionSequenceNum;
                        this.firstTimeRecorded = message.FirstTimeRecorded;
                        this.authExempt = message.AuthExempt;
                        this.otherRecvErr = message.other_recv_err;
                        this.jsonErr = message.json_err;
                        this.qmotionTryFind = message.qmotion_try_find;
                        this.taskHeartbeatBitmask = message.task_heartbeat_bitmask;
                        this.lastDiagTime = message.CurrentTime;
                        if (this.platform.logBroadcastDiagnostics) {
                            this.platform.log.info('LC7001 BroadcastDiagnostices message:\n', message);
                        }
                        break;
                    case 'BroadcastMemory':
                        this.platform.log.debug('Message type: BroadcastMemory');
                        this.freeMemory = message.FreeMemory;
                        this.freeMemLowWater = message.FreeMemLowWater;
                        this.malloc_Count = message.Malloc_Count;
                        this.free_Count = message.Free_Count;
                        this.jsonConnections = message.JsonConnections;
                        this.staticRamUsage = message.StaticRamUsage;
                        this.peakRamUsage = message.PeakRamUsage;
                        this.lastMemTime = message.CurrentTime;
                        if (this.platform.logBroadcastMemory) {
                            this.platform.log.info('LC7001 BroadcastMemory message:\n', message);
                        }
                        break;
                    case 'ListZones':
                        this.platform.log.debug('Message type: ZoneList');
                        this.zoneList = message.ZoneList;
                        if (message.ZoneList.length == 0) {
                            this.platform.log.warn('LC7001 reports having no zones. Perhaps you need to add some lights.');
                        }
                        else {
                            this.platform.log.debug('Received zone list:\n', message.ZoneList);
                            //LC7001 does not volunteer the zone list; if we receive it, automatically query properties of each zone.
                            this.queryLC7001Zones();
                        }
                        break;
                    case 'ping':
                        this.platform.log.debug('Message type: Ping');
                        this.lastPingSeq = message.PingSeq;
                        this.lastPingTime = message.CurrentTime;
                        break;
                    case 'ReportSystemProperties':
                        this.platform.log.debug('Message type: ReportSystemProperties');
                        if ('PropertyList' in message) {
                            if ('AddASceneController' in message.PropertyList) {
                                if (message.PropertyList.AddASceneController && !this.addASceneController) {
                                    this.platform.log.info('LC7001 entered AddASceneController state.');
                                }
                                if (this.addASceneController && !message.PropertyList.AddASceneController) {
                                    this.platform.log.info('LC7001 exited AddASceneController state.');
                                }
                                this.addASceneController = message.PropertyList.AddASceneController;
                            }
                            if ('AddALight' in message.PropertyList) {
                                if (message.PropertyList.AddALight && !this.addALight) {
                                    this.platform.log.info('LC7001 entered AddALight state.');
                                }
                                if (this.addALight && !message.PropertyList.AddALight) {
                                    this.platform.log.info('LC7001 exited AddALight state.');
                                }
                                this.addALight = message.PropertyList.AddALight;
                            }
                            this.timeZone = message.PropertyList.TimeZone;
                            this.daylightSavingtime = message.PropertyList.DaylightSavingTime;
                            this.locationInfo = message.PropertyList.LocationInfo;
                            this.location = message.PropertyList.Location;
                            this.effectiveTimeZone = message.PropertyList.EffectiveTimeZone;
                            this.configured = message.PropertyList.Configured;
                            this.supportsSceneFadeRate = message.PropertyList.SupportSceneFadeRate;
                            this.mobileAppData = message.PropertyList.MobileAppData;
                            this.lastSysPropTime = message.PropertyList.CurrentTime;
                            //Depricated fields
                            //this.samsungUserToken = message.PropertyList.SamsungUserToken;
                            //this.samsungRefreshToken = message.PropertyList.SamsungRefreshToken]
                        }
                        break;
                    case 'ReportZoneProperties':
                        this.platform.log.debug('Message type: ReportZoneProperties');
                        if (this.accessories[message.ZID] === undefined) {
                            this.accessories[message.ZID] = {};
                        }
                        this.accessories[message.ZID].zid = message.ZID;
                        this.accessories[message.ZID].PropertyList = message.PropertyList;
                        if (!this.isInitialized) {
                            this.platform.log.debug('LC7001 interface is not initialized. Requesting check of initialization status in post-processing.');
                            checkInitializedWhenDone = true;
                        }
                        break;
                    case 'SetZoneProperties':
                        this.platform.log.debug('Message type: SetZoneProperties');
                        //There is no action to take for this messsage if it is a success. Do not know what non-success looks like, so log it.
                        if (message.Status != 'Success') {
                            this.platform.log.error('LC7001 failed set zone:', message);
                        }
                        break;
                    case 'SystemInfo':
                        this.platform.log.debug('Message type: SystemInfo');
                        this.model = message.Model;
                        this.firmwareVersion = message.FirmwareVersion;
                        this.firmwareDate = message.FirmwareDate;
                        this.firmwareBranch = message.FirmwareBranch;
                        this.macAddress = message.MACAddress;
                        this.houseID = message.HouseID;
                        this.updateState = message.UpdateState;
                        if ('UpdateState' in message && message.UpdateState.Status == 'Ready') {
                            this.platform.log.info('LC7001 ready to update to firmware version', message.UpdateState.UpdateVersion + ':', message.UpdateState.ReleaseNotes);
                        }
                        break;
                    case 'SystemPropertiesChanged':
                        this.platform.log.debug('Message type: SystemPropertiesChanged');
                        this.platform.log.debug('LC7001 reports system properties changed; rescanning....');
                        this.sendCMDArray([this.cmdGetLC7001Properties()]);
                        break;
                    case 'ZoneAdded':
                        this.platform.log.debug('Message type: ZoneAdded');
                        this.platform.log.info('Zone added to LC7001. Requesting rescan of accessories in post-processing.');
                        rescanAccessoriesWhenDone = true;
                        break;
                    case 'ZoneDeleted':
                        this.platform.log.debug('Message type: ZoneDeleted');
                        this.platform.log.info('Zone deleted from LC7001. Requesting rescan of accessories in post-processing.');
                        rescanAccessoriesWhenDone = true;
                        break;
                    case 'ZonePropertiesChanged':
                        this.platform.log.debug('Message type: ZonePropertiesChanged');
                        if (this.accessories[message.ZID] === undefined) {
                            this.platform.log.warn('LC7001 updated unknown zone:', message.ZID);
                            this.platform.log.debug('Requesting rescan of accessories in post-processing.');
                            rescanAccessoriesWhenDone = true;
                        }
                        else {
                            this.platform.log.debug('Updating accessory.... Zone:', message.ZID);
                            if (this.accessories[message.ZID].PropertyList === undefined) {
                                this.platform.log.debug('Accessory PropertyList undefined; copying wholesale.');
                                this.accessories[message.ZID].PropertyList = message.PropertyList;
                            }
                            else {
                                Object.assign(this.accessories[message.ZID].PropertyList, message.PropertyList);
                            }
                            if (this.accessories[message.ZID].platformAccessoryIndex === undefined) {
                                this.platform.log.debug('Zone has not yet been matched to platform; not emitting event.');
                            }
                            else {
                                this.platform.log.debug('LC7001 module emitting "accessoryUpdate" event....');
                                this.emitter.emit('accessoryUpdate', this.accessories[message.ZID].platformAccessoryIndex);
                            }
                        }
                        break;
                    default:
                        if (/^\*+ Got NTP -- IP:/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP');
                            this.platform.log.debug('NTP succeeded on LC7001.');
                            this.lastNTPTime = message.PropertyList.CurrentTime;
                        }
                        else if (/^\*+ NTP one shot did not work/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP');
                            this.platform.log.warn('NTP failed on LC7001.');
                        }
                        else if (/^\*+ NTP ALT TIME WORKED/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP');
                            this.platform.log.warn('Alternative NTP succeeded on LC7001.');
                            this.lastNTPTime = message.PropertyList.CurrentTime;
                        }
                        else if (/^\*+ NIST ALT TIME DID NOT WORK/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP');
                            this.platform.log.warn('Alternative NTP failed on LC7001.');
                        }
                        else {
                            if (message.ID == 0) {
                                this.platform.log.error('Unknown LC7001 initiated service:\n', message);
                            }
                            else {
                                this.platform.log.error('Unknown LC7001 response service\n', message);
                            }
                        }
                        break;
                }
            }
            else if ('Context' in message && /^[0-9]{6}Debug/.test(message.Context)) {
                this.platform.log.debug('Message type: Debug');
                if (this.platform.logDebugMessages) {
                    this.platform.log.info('LC7001 debug message:\n', message);
                }
            }
            else {
                if (message.ID == 0) {
                    this.platform.log.error('Unhandled LC7001 initiated message:\n', message);
                }
                else {
                    this.platform.log.error('Unhanlded LC7001 response message:\n', message);
                }
            }
        }
        else {
            if ('MAC' in message) {
                this.platform.log.debug('Message type: MAC');
                this.mac = message.MAC;
            }
            else if ('Service' in message) {
                switch (message.Service) {
                    case 'EliotErrors':
                        this.platform.log.debug('Message type: EliotErrors');
                        if (this.platform.logEliotErrors) {
                            this.platform.log.info('EliotErrors:\n', message);
                        }
                        break;
                    default:
                        this.platform.log.error('Unhandled LC7001 initiaged message:\n', message);
                        break;
                }
            }
            else if ('ArtikEvent' in message) {
                this.platform.log.debug('Message type: ArtikEvent');
                this.platform.log.debug('ArtikEvent received:\n', message);
            }
            else {
                this.platform.log.error('Unhandled LC7001 message:\n', message);
            }
        }
        this.platform.log.debug('Finished processing message:', JSON.stringify(message));
        return [checkInitializedWhenDone, rescanAccessoriesWhenDone];
    }
    queryLC7001Zones() {
        this.platform.log.debug('Querying LC7001 zones....');
        if (this.zoneList.length == 0) {
            this.platform.log.debug('Zone list is empty. Nothing to query.');
        }
        else {
            var cmdArray = [];
            this.zoneList.forEach((value) => {
                if ('ZID' in value) {
                    this.platform.log.debug('Querying zone:', value.ZID);
                    cmdArray.push(this.cmdGetAccessory(value.ZID));
                }
            });
            this.sendCMDArray(cmdArray);
            this.platform.log.debug('Finished querying LC7001 zones.');
        }
    }
    sendCMD(cmd) {
        this.platform.log.debug('Checking if socket is not destroyed....');
        if (!this.interface.destroyed) {
            this.platform.log.debug('Socket open. Sending command:', cmd);
            this.interface.write((JSON.stringify(cmd) + this.delimiter), 'ascii');
            this.commandQueue.push(cmd);
        }
        else {
            this.platform.log.debug('Socket destroyed.');
            this.platform.log.warn('No active connection to LC7001. Discarding command:', cmd);
        }
    }
    sendCMDArray(cmdArray) {
        var cmd = '';
        this.platform.log.debug('Checking if socket is not destroyed....');
        if (!this.interface.destroyed) {
            cmdArray.forEach((value) => {
                cmd = cmd + JSON.stringify(value) + this.delimiter;
                this.commandQueue.push(value);
            });
            this.platform.log.debug('Socket open. Sending command:', cmd);
            this.interface.write(cmd, 'ascii');
        }
        else {
            this.platform.log.debug('Socket destroyed.');
            this.platform.log.warn('No active connection to LC7001. Discarding command:', cmd);
        }
    }
    setAccessory(id, PropertyList) {
        this.platform.log.debug('Setting zone', id, 'to PropertyList:', PropertyList);
        this.sendCMDArray([this.cmdSetAccessory(id, PropertyList)]);
    }
    scanAccessories() {
        this.platform.log.debug('Scanning LC7001 for accessories....');
        this.sendCMDArray([this.cmdListAccessories()]);
    }
}
exports.LC7001 = LC7001;
//# sourceMappingURL=lc7001.js.map