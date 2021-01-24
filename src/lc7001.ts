import crypto from 'crypto';

import {
    EventEmitter
} from 'events';

import {
    Socket,
    TcpSocketConnectOpts
} from 'net';

import {
    PlatformLC7001
} from './platform';

export class LC7001 {
    //Interface to platform
    public accessories:                 any[] = [];
    public isInitialized:               boolean = false;

    //Node.js objects
    public emitter:                     EventEmitter;
    private interface:                  Socket;
    private readonly tcpOptions:        TcpSocketConnectOpts;

    //Private properties
    private _commandID:                 number = 0;
    private passwordHash:               Buffer;
    private isAuthenticated:            boolean;
    private readonly delimiter:         string;
    private tcpBuffer:                  string = '';
    private readonly tcpRetrySeconds:   number;
    private readonly tcpTimeout:        number;
    private readonly tcpTimeoutSeconds: number;
    private commandQueue:               any[] = [];
    private responseQueue:              any[] = [];

    //LC7001-supplied properties
    private addALight:                  any = false;
    private addASceneController:        any = false;
    private authExempt:                 any = undefined;
    private configured:                 any = undefined;
    private connectionSequenceNumber:   any = undefined;
    private daylightSavingtime:         any = undefined;
    private effectiveTimeZone:          any = undefined;
    private firmwareBranch:             any = undefined;
    private firmwareDate:               any = undefined;
    private firmwareVersion:            any = undefined;
    private firstSystemTime:            any = undefined;
    private firstTimeRecorded:          any = undefined;
    private freeMemory:                 any = undefined;
    private freeMemLowWater:            any = undefined;
    private free_Count:                 any = undefined;
    private houseID:                    any = undefined;
    private jsonConnections:            any = undefined;
    private jsonErr:                    any = undefined;
    private location:                   any = undefined;
    private locationInfo:               any = undefined;
    private mac:                        any = undefined;
    public  macAddress:                 any = undefined;
    private malloc_Count:               any = undefined;
    private mobileAppData:              any = undefined;
    private model:                      any = undefined;
    private otherRecvErr:               any = undefined;
    private peakRamUsage:               any = undefined;
    private qmotionTryFind:             any = undefined;
    private shortMACAddress:            any = undefined;
    private staticRamUsage:             any = undefined;
    private supportsSceneFadeRate:      any = undefined;
    private taskHeartbeatBitmask:       any = undefined;
    private timeZone:                   any = undefined;
    private updateState:                any = undefined;
    private zoneList:                   any[] = [];
    //Depricated properties
    //private samsungUserToken:         any = undefined;
    //private samsungRefreshToken:      any = undefined;

    //LC7001-derived properties
    private lastDiagTime:               any = undefined;
    private lastMemTime:                any = undefined;
    private lastNTPTime:                any = undefined;
    private lastPingSeq:                any = undefined;
    private lastPingTime:               any = undefined;
    private lastSysPropTime:            any = undefined;

    constructor(
        public readonly platform: PlatformLC7001,
        password: string = '',
        tcpOptions:TcpSocketConnectOpts,
        delimiter: string = '\0',
        tcpTimeoutSeconds: number = 30,
        tcpRetrySeconds: number = 30
    ) {
        var passwordHasher = crypto.createHash('MD5');
        passwordHasher.update(password);

        this.passwordHash = passwordHasher.digest();
        this.isAuthenticated = false;
        this.tcpOptions = tcpOptions;
        this.delimiter = delimiter;
        this.tcpRetrySeconds = tcpRetrySeconds;
        this.tcpTimeoutSeconds = tcpTimeoutSeconds;
        this.tcpTimeout = this.tcpTimeoutSeconds * 1000;

        this.emitter = new EventEmitter;
        this.interface = new Socket();
        this.interface.on('connect',() => {
            this.platform.log.info('Connection to LC7001 established.');
            this.platform.log.debug('-->IP Version:      ',this.interface.remoteFamily);
            this.platform.log.debug('-->IP Address:      ',this.interface.remoteAddress);
            this.platform.log.debug('-->TCP Port:        ',this.interface.remotePort);
            this.platform.log.debug('-->Local IP Address:',this.interface.localAddress);
            this.platform.log.debug('-->Local TCP Port:  ',this.interface.localPort);
        });
        this.interface.on('close',(hadError) => {
            this.tcpBuffer = '';
            if (hadError) {
                this.platform.log.error('Connection to LC7001 closed due to error. Waiting',this.tcpRetrySeconds,'seconds to reconnect....');
                setTimeout(this.connectLC7001.bind(this),(this.tcpRetrySeconds * 1000));
            } else {
                this.platform.log.info('Connection to LC7001 closed. Reconnecting....');
                this.connectLC7001();
            }
        });
        this.interface.on('data',(data: string) => {
            this.platform.log.debug('Data received from LC7001 (stringified):',JSON.stringify(data));
            if (data.length <= 0) {
                this.platform.log.debug('Length of data is zero! Nothing to do.')
            } else {
                this.processBuffer(data);
            }
        });
        this.interface.on('error',(err) => {
            this.platform.log.error('Error on LC7001 connection:',err.toString());
        });
        this.interface.on('ready',() => {
            this.platform.log.debug('Connection to LC7001 ready for use.')
            //Previously, before authentication requirement, this is where commands began issuing. Moved to 'data' emitter.
            //this.sendCMDArray([this.cmdGetSystemInfo(),this.cmdGetLC7001Properties(),this.cmdListAccessories()]);
        });
        this.interface.on('timeout',() => {
            this.platform.log.warn('Connection to LC7001 has been inactive for',this.tcpTimeoutSeconds,'seconds. Destroying connection....');
            this.interface.destroy();
        });

        this.connectLC7001();
    }

    private answerChallenge(challenge: Buffer): void {
        var answer: string;
        var answerCipher = crypto.createCipheriv('AES-128-ECB',this.passwordHash,null);
        this.platform.log.debug('Generating challenge answer....');
        this.platform.log.debug('Using challenge:',challenge.toString('hex').toUpperCase());
        //this.platform.log.debug('Using password hash:',this.passwordHash.toString('hex').toUpperCase());
        answer = answerCipher.update(challenge).toString('hex').toUpperCase();
        this.platform.log.debug('Answer generated:',answer);
        this.platform.log.debug('Sending answer to LC7001....')
        this.interface.write(answer,'ascii');
    }

    private checkInitialized(): void {
        this.platform.log.debug('Testing to see if LC7001 interface is initialized....');
		this.isInitialized = this.isInitializedTest();
        if (this.isInitialized) {
            this.platform.log.debug('LC7001 interface is initialized. Emitting "initialized" event....');
            this.emitter.emit('initialized');
        } else {
            this.platform.log.debug('LC7001 interface is not initialized.')
        }

    }

    //LC7001 sends a response with the name ID as the command. We utilize an ID field that is inrecemented every time it is requested to serialize commands.
    private get commandID(): number {
        if (this._commandID >= Number.MAX_SAFE_INTEGER) {
            this._commandID = 1;
        } else {
            this._commandID = this._commandID + 1;
        }
        return this._commandID;
    }

    private cmdGetAccessory(id: number): object {
		var cmd: any = {};
        this.platform.log.debug('Building ReportZoneProperties command....')
		cmd.ID = this.commandID;
		cmd.Service = 'ReportZoneProperties';
        cmd.ZID = id;
        this.platform.log.debug('Command:',cmd)
		return cmd;
	}

    private cmdGetLC7001Properties(): object {
		var cmd:any = {};
        this.platform.log.debug('Building ReportSystemProperties command....')
		cmd.ID = this.commandID;
		cmd.Service = 'ReportSystemProperties';
        this.platform.log.debug('Command:',cmd)
		return cmd;
	}

	private cmdGetSystemInfo(): object {
		var cmd:any = {};
        this.platform.log.debug('Building SystemInfo command....')
		cmd.ID = this.commandID;
		cmd.Service = 'SystemInfo';
        this.platform.log.debug('Command:',cmd)
		return cmd;
    }

    private cmdListAccessories(): object {
		var cmd:any = {};
        this.platform.log.debug('Building ListZones command....')
        cmd.ID = this.commandID;
        cmd.Service = 'ListZones';
        this.platform.log.debug('Command:',cmd)
		return cmd;
    }

	private cmdSetAccessory(id: number,PropertyList:any) {
		var cmd:any = {};
        this.platform.log.debug('Building SetZoneProperties command....')
		cmd.ID = this.commandID;
		cmd.Service = 'SetZoneProperties';
		cmd.ZID = id;
		cmd.PropertyList = PropertyList;
        this.platform.log.debug('Command:',cmd)
		return cmd;
	}

    private connectLC7001(): void {
        this.platform.log.info('Connecting to LC7001....');
        this.platform.log.debug('TCP Options:');
        this.platform.log.debug('--> host:',this.tcpOptions.host);
        this.platform.log.debug('--> port:',this.tcpOptions.port);
        this.platform.log.debug('--> localAddress:',this.tcpOptions.localAddress);
        this.platform.log.debug('--> localPort:',this.tcpOptions.localPort);
        this.platform.log.debug('--> family:',this.tcpOptions.family);
        this.interface.connect(this.tcpOptions,() => {
            this.interface.setEncoding('ascii');
            this.interface.setTimeout(this.tcpTimeout);
        });
    }

    //LC7001 is initialized when zone list is populated and properties from each zone have been queried.
    //If the LC7001 has no zones, it will never be initialized.
    private isInitializedTest(): boolean {
        var testcase:boolean = true;

        if (this.zoneList.length == 0) {
            this.platform.log.debug('Zone list is empty: Fail');
			testcase = false;
        } else {
            this.platform.log.debug('Zone list is populated: Pass');
            if (this.accessories.length == 0) {
                this.platform.log.debug('Accessories list is empty: Fail');
                testcase = false;
            } else {
                this.zoneList.forEach((value) => {
                    if (this.accessories[value.ZID] === undefined) {
                        this.platform.log.debug('Zone',value.ZID,'is missing from accessories list: Fail')
                        testcase = false;
                    } else {
                        this.platform.log.debug('Found zone',value.ZID,'on accessories list: Pass')
                    }
                });
            }
        }
		return testcase;
    }

    private processBuffer(data: string): void {
        this.platform.log.debug('Processing data received from LC7001....');
        this.platform.log.debug('Starting buffer:',JSON.stringify(this.tcpBuffer));
        this.platform.log.debug('Data received:',JSON.stringify(data));
        this.platform.log.debug('Delimiter:',JSON.stringify(this.delimiter));
        var splitBuffer = data.split(this.delimiter);
        splitBuffer[0] = this.tcpBuffer + splitBuffer[0];
        this.tcpBuffer = '';
        this.platform.log.debug('Segments received:',splitBuffer.length);
        splitBuffer.forEach((value,index) => {
            this.platform.log.debug('-->',(index + 1),':',JSON.stringify(value));
        });
        if (splitBuffer.length > 0) {
            splitBuffer.forEach((value,index) => {
                this.platform.log.debug('Processing segment:',(index + 1));
                if (value.length == 0) {
                    this.platform.log.debug('Segment has length 0; skipping.');
                } else {
                    this.platform.log.debug('Checking if segment is good JSON....');
                    try {
                        this.responseQueue.push(JSON.parse(value));
                        this.platform.log.debug('Segment is good JSON. Added JSON to Receive Queue.');
                        if (!this.isAuthenticated) {
                            this.platform.log.debug('LC7001 must not require authentication. Initializing LC7001....');
                            this.isAuthenticated = true;
                            this.sendCMDArray([this.cmdGetSystemInfo(),this.cmdGetLC7001Properties(),this.cmdListAccessories()]);
                        }
                    } catch {
                        this.platform.log.debug('Segment is not good JSON. Checking if segment is an authentication message....');
                        if (/^Hello V1 /.test(value)) {
                            this.platform.log.debug('Segment is an authentication message. This LC7001 requires authentication.');
                            this.isAuthenticated = false;
                        } else if (/^[0-9A-F]{32} [0-9A-F]{12}/.test(value)) {
                            this.platform.log.debug('LC7001 has sent an authentication challenge.');
                            this.answerChallenge(Buffer.from(value.substr(0,32),'hex'));
                        } else if (/^\[SETKEY\]/.test(value)) {
                            this.platform.log.warn('Your LC7001 requires a password be configured. Please set the password using the Legrand Lighting Control app and add the password to configuration.');
                            this.platform.log.warn('This plugin will not work until a password is set on the LC7001 and entered into the configuration.');
                        } else if (/^\[OK\]/.test(value)) {
                            this.platform.log.info('Successfully authenticated to LC7001. Initializing LC7001....')
                            this.isAuthenticated = true;
                            this.sendCMDArray([this.cmdGetSystemInfo(),this.cmdGetLC7001Properties(),this.cmdListAccessories()]);
                        } else if (/^\[INVALID\]/.test(value)) {
                            this.platform.log.error('Failed to authenticate to LC7001; check the password. LC7001 will disconnect.');
                        } else {
                            this.platform.log.debug('Segment is not an authentication message. Checking for undelimited JSON....');
                            if (value.indexOf('}{') >= 0) {
                                this.platform.log.warn('Possible undelimited JSON detected. Replacing all }{s with delimited version.');
                                var splitValue = value.replace(/\}\{/g, ('}' + this.delimiter + '{')).split(this.delimiter);
                                this.platform.log.debug('Salvaged segments:',splitValue.length);
                                splitValue.forEach((value2,index2) => {
                                    this.platform.log.debug('-->',(index2 + 1),':',JSON.stringify(value2));
                                });
                                splitValue.forEach((value2,index2) => {
                                    try {
                                        this.responseQueue.push(JSON.parse(value2));
                                        this.platform.log.info('Succcesfully salvaged JSON. Added JSON to Receive Queue.');
                                    } catch(err) {
                                        this.platform.log.error('Unable to parse segment:',value2);
                                        this.platform.log.debug('Salvaged segment',(index2 + 1),'is not good JSON.');
                                        this.platform.log.debug('Skipping....');
                                    }
                                });
                            } else {
                                if (index == (splitBuffer.length - 1)) {
                                    this.platform.log.debug('Unable to parse last segment; saving in buffer.');
                                    this.tcpBuffer = value;
                                } else {
                                    this.platform.log.error('Unable to parse segment:',value);
                                    this.platform.log.debug('Skipping....');
                                }
                            }
                        }
                    }
                }
            });
        }
        this.processresponseQueue();
    }

    private processresponseQueue(): void {
        var message: any = {};
        var postProcessing: boolean[];
        var runCheckInitialized: boolean = false;
        var runScanAccessories: boolean = false;

        this.platform.log.debug('Processing Receive Queue....');
        this.platform.log.debug('Receive Queue length:',this.responseQueue.length);
        if (this.responseQueue.length == 0) {
            this.platform.log.debug('Receive Queue empty; nothing to do.')
        } else {
            this.platform.log.debug('Receive Queue contents:')
            this.responseQueue.forEach((value,index) => {
                this.platform.log.debug('-->',(index + 1),':',JSON.stringify(value))
            },this);
            while (this.responseQueue.length > 0) {
                message = this.responseQueue.shift();
                if ('ID' in message && message.ID > 0) {
                    this.platform.log.debug('Message contains non-zero ID. Checking Command Queue for matching command....')
                    this.commandQueue.forEach((value,index,array) => {
                        if (value.ID == message.ID) {
                            this.platform.log.debug('Found matching command:',value);
                            this.platform.log.debug('Removing command from Command Queue.');
                            array.splice(index,1);
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
            } else {
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

    private processLC7001Message(message: any): boolean[] {
        var checkInitializedWhenDone: boolean = false;
        var rescanAccessoriesWhenDone: boolean = false;
        this.platform.log.debug('Processing message:',JSON.stringify(message));
        if ('ID' in message) {
            if ('Service' in message) {
                switch(message.Service) {
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
                            this.platform.log.info('LC7001 BroadcastDiagnostices message:\n',message);
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
                            this.platform.log.info('LC7001 BroadcastMemory message:\n',message);
                        }
                        break;
                    case 'ListZones':
                        this.platform.log.debug('Message type: ZoneList');
                        this.zoneList = message.ZoneList;
                        if (message.ZoneList.length == 0) {
                            this.platform.log.warn('LC7001 reports having no zones. Perhaps you need to add some lights.');
                        } else {
                            this.platform.log.debug('Received zone list:\n',message.ZoneList);
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
                                    this.platform.log.info('LC7001 exited AddASceneController state.')
                                }
                                this.addASceneController = message.PropertyList.AddASceneController;
                            }
                            if ('AddALight' in message.PropertyList) {
                                if (message.PropertyList.AddALight && !this.addALight) {
                                    this.platform.log.info('LC7001 entered AddALight state.');
                                }
                                if (this.addALight && !message.PropertyList.AddALight) {
                                    this.platform.log.info('LC7001 exited AddALight state.')
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
                            this.platform.log.error('LC7001 failed set zone:',message);
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
                            this.platform.log.info('LC7001 ready to update to firmware version',message.UpdateState.UpdateVersion+':',message.UpdateState.ReleaseNotes)
                        }
                        break;
                    case 'SystemPropertiesChanged':
                        this.platform.log.debug('Message type: SystemPropertiesChanged');
                        this.platform.log.debug('LC7001 reports system properties changed; rescanning....')
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
                            this.platform.log.warn('LC7001 updated unknown zone:',message.ZID);
                            this.platform.log.debug('Requesting rescan of accessories in post-processing.');
                            rescanAccessoriesWhenDone = true;
                        } else {
                            this.platform.log.debug('Updating accessory.... Zone:',message.ZID);
                            if (this.accessories[message.ZID].PropertyList === undefined) {
                                this.platform.log.debug('Accessory PropertyList undefined; copying wholesale.')
                                this.accessories[message.ZID].PropertyList = message.PropertyList;
                            } else {
                                Object.assign(this.accessories[message.ZID].PropertyList,message.PropertyList);
                            }
                            if (this.accessories[message.ZID].platformAccessoryIndex === undefined) {
                                this.platform.log.debug('Zone has not yet been matched to platform; not emitting event.')
                            } else {
                                this.platform.log.debug('LC7001 module emitting "accessoryUpdate" event....')
                                this.emitter.emit('accessoryUpdate',this.accessories[message.ZID].platformAccessoryIndex);
                            }
                        }
                        break;
                    default:
                        if (/^\*+ Got NTP -- IP:/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP');
                            this.platform.log.debug('NTP succeeded on LC7001.');
                            this.lastNTPTime = message.PropertyList.CurrentTime;
                        } else if (/^\*+ NTP one shot did not work/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP');
                            this.platform.log.warn('NTP failed on LC7001.');
                        } else if (/^\*+ NTP ALT TIME WORKED/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP');
                            this.platform.log.warn('Alternative NTP succeeded on LC7001.')
                            this.lastNTPTime = message.PropertyList.CurrentTime;
                        } else if (/^\*+ NIST ALT TIME WORKED/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP (NIST)');
                            this.platform.log.warn('Alternative NTP (NIST) succeeded on LC7001.')
                            this.lastNTPTime = message.PropertyList.CurrentTime;
                        } else if (/^\*+ NIST ALT TIME DID NOT WORK/.test(message.Service)) {
                            this.platform.log.debug('Message type: NTP (NIST)');
                            this.platform.log.warn('Alternative NTP (NIST) failed on LC7001.')
                        } else {
                            if (message.ID == 0) {
                                this.platform.log.error('Unknown LC7001 initiated service:\n',message);
                            } else {
                                this.platform.log.error('Unknown LC7001 response service\n',message);
                            }
                        }
                        break;
                }
            } else if ('Context' in message && /^[0-9]{6}Debug/.test(message.Context)) {
                this.platform.log.debug('Message type: Debug');
                if (this.platform.logDebugMessages) {
                    this.platform.log.info('LC7001 debug message:\n',message);
                }
            } else {
                if (message.ID == 0) {
                    this.platform.log.error('Unhandled LC7001 initiated message:\n',message);
                } else {
                    this.platform.log.error('Unhanlded LC7001 response message:\n',message);
                }
            }
        } else {
            if ('MAC' in message) {
                this.platform.log.debug('Message type: MAC');
                this.mac = message.MAC;
            } else if ('Service' in message) {
                switch(message.Service) {
                    case 'EliotErrors':
                        this.platform.log.debug('Message type: EliotErrors');
                        if (this.platform.logEliotErrors) {
                            this.platform.log.info('EliotErrors:\n',message);
                        }
                        break;
                    default:
                        this.platform.log.error('Unhandled LC7001 initiaged message:\n',message);
                        break;
                }
            } else if ('ArtikEvent' in message) {
                this.platform.log.debug('Message type: ArtikEvent');
                this.platform.log.debug('ArtikEvent received:\n',message);
            } else {
                this.platform.log.error('Unhandled LC7001 message:\n',message);
            }
        }
        this.platform.log.debug('Finished processing message:',JSON.stringify(message));
        return[checkInitializedWhenDone,rescanAccessoriesWhenDone];
    }

    private queryLC7001Zones(): void {
        this.platform.log.debug('Querying LC7001 zones....');
        if (this.zoneList.length == 0) {
            this.platform.log.debug('Zone list is empty. Nothing to query.')
        } else {
            var cmdArray: object[] = [];
            this.zoneList.forEach((value: any) => {
                if ('ZID' in value){
                    this.platform.log.debug('Querying zone:',value.ZID);
                    cmdArray.push(this.cmdGetAccessory(value.ZID));
                }
            });
            this.sendCMDArray(cmdArray);
            this.platform.log.debug('Finished querying LC7001 zones.');
        }
    }

    private sendCMD(cmd: object): void {
        this.platform.log.debug('Checking if socket is not destroyed....');
        if (!this.interface.destroyed) {
            this.platform.log.debug('Socket open. Sending command:',cmd);
            this.interface.write((JSON.stringify(cmd) + this.delimiter),'ascii');
            this.commandQueue.push(cmd);
        } else {
            this.platform.log.debug('Socket destroyed.');
            this.platform.log.warn('No active connection to LC7001. Discarding command:',cmd);
        }
    }

    private sendCMDArray(cmdArray: object[]): void {
        var cmd = '';
        this.platform.log.debug('Checking if socket is not destroyed....');
        if (!this.interface.destroyed) {
            cmdArray.forEach((value) => {
                cmd = cmd + JSON.stringify(value) + this.delimiter;
                this.commandQueue.push(value);
            });
            this.platform.log.debug('Socket open. Sending command:',cmd);
            this.interface.write(cmd,'ascii');
        } else {
            this.platform.log.debug('Socket destroyed.');
            this.platform.log.warn('No active connection to LC7001. Discarding command:',cmd);
        }

    }

    public setAccessory(id:number,PropertyList:any): void {
        this.platform.log.debug('Setting zone',id,'to PropertyList:',PropertyList);
        this.sendCMDArray([this.cmdSetAccessory(id,PropertyList)]);
    }

    public scanAccessories(): void {
        this.platform.log.debug('Scanning LC7001 for accessories....');
        this.sendCMDArray([this.cmdListAccessories()]);
    }

}