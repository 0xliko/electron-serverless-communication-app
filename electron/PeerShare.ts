import * as os from 'os';
import * as dgram from 'dgram';
import { EventEmitter } from 'events';

export interface IHostMessage {
	type: 'connect' | 'ping' | 'pong' | 'data';
	kind: 'new' | 'replay' | 'UNKNOWN';
	hostName: string;
	address: string;
	payload: any;
}
export interface IHostState{
  hostName:string;
  address:string;
  state: boolean;
}
interface IHost {
	hostName: string;
	live: boolean;
}
interface IHostList {
	[address: string]: IHost;
}
interface IPingPongHost {
	ping: Date;
	pong: Date;
}
interface IPingPongHostList {
	[address: string]: IPingPongHost;
}

export default class PeerShare extends EventEmitter {
	private _port: number;
	private broadCastMask: string;
	private hostList: IHostList;
	private pingPongHostList: IPingPongHostList;
	private socket: dgram.Socket;
	private hostName: string;
	private hostMessage: IHostMessage;
  private _address:  string;
	constructor(port: number, broadCastMask: string) {
		super();
		this._port = port;
		this.broadCastMask = broadCastMask;
		this.hostList = {};
    this.pingPongHostList = {};
    this.hostName = os.hostname();
    this._address = '';
    this.hostMessage = {
			hostName: this.hostName,
			kind: 'new',
			type: 'connect',
			address: broadCastMask,
			payload: null
		};
		this.socket = dgram.createSocket('udp4');
    this.socket.bind(this._port);
		this.socket.on('message', (message: any, socketInfo:dgram.Socket) =>
			this.onMessage(message, socketInfo)
		);
		this.socket.on('listening', () => this.onListening());

	}

	private onMessage(message: IHostMessage, socket: dgram.Socket) {

		message = JSON.parse(message.toString());
		this.processReceivedMessage({...message,address:socket.address.toString()});
	}

	private onListening() {
		this.sendMessageToPeers(this.hostMessage);
		setTimeout(
			() => setInterval(() => this.updatePingPongHosts(), 3000),
			1500
		);
		setInterval(() => this.scanhostList(), 3000);
	}

	private updatePingPongHosts() {
		for (const address of Object.keys(this.pingPongHostList)) {
			const stamp = this.pingPongHostList[address];
			let state = true;
			if (stamp.pong < stamp.ping) state = false;
			if (state != this.hostList[address].live) {
				this.hostList[address].live = state;
				this.emit('host-update',{address:address,hostName:this.hostList[address].hostName,state:state});
			}
		}
	}
	private scanhostList() {
		for (const address of Object.keys(this.hostList)) {
      this.pingPongHostList[address].ping = new Date();
			this.scanLiveHost(address);
		}
	}
	private scanLiveHost(address: string) {
		const message: IHostMessage = {
			type: 'ping',
			address: address,
			hostName: this.hostMessage.hostName,
			payload: null,
			kind: 'UNKNOWN'
    };
		this.sendMessageToPeers(message);
	}

	private sendMessageToPeers(message: IHostMessage) {

		if (typeof message === 'object')
			this.socket.send(
				JSON.stringify(message),
				this._port,
				message.address || this.broadCastMask,
				(error, bytes) =>
					{if(error)console.log(error,bytes)}
			);
		else console.error('Invalid Socket Message Type', typeof message);
	}

	private processReceivedMessage(message: IHostMessage) {

		switch (message.type) {
			case 'connect':{
				if (message.hostName === this.hostName){this._address = message.address;break;}
				if (!this.hostList[message.address]){
					this.hostList[message.address] = {
						hostName: message.hostName,
						live: true
          }
        }
				else {
					if (this.hostList[message.address].live === true) break;
				     	//Yet did not disconnect state, so process nothing
				  this.hostList[message.address].live = true;
				}
				this.pingPongHostList[message.address] = {
					ping: new Date(),
					pong: new Date()
				};
				if (message.kind === 'new'){
					this.sendMessageToPeers({...this.hostMessage,address:message.address, kind: 'replay' });
        }
        this.emit('host-update',{address:message.address,hostName:message.hostName,state:true});
      }
			break;
			case 'ping':
        this.sendMessageToPeers({...this.hostMessage,address:message.address,type:'pong'});
				break;
			case 'pong':
				this.pingPongHostList[message.address].pong = new Date();
				break;
			case 'data':{

        if (this.hostName !== message.hostName)
           this.emit('data',message);
        }
				break;
		}
	}

	public share<T>(data: T, address?: string) {
		this.sendMessageToPeers({
			...this.hostMessage,
			address: address ? address : this.hostMessage.address,
			type: 'data',
			payload: data
		});
	}
	public closeConnection() {
		//Clear all connection
		//Do Garbage Collection etc
	}
	public getPeerNetworkInformation() {
		return {
			myHost: {
				hostName: this.hostName,
				live: true,
				address: this._address
			},
			hostList: this.hostList
		};
	}
}
