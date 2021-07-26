import { app, ipcMain, BrowserWindow } from 'electron';
import  path from 'path';
import  url from 'url';
import  fs from 'fs';
import PeerShare,{IHostState,IHostMessage} from './PeerShare';
const _dir = path.resolve("./");
const broadMask: string = fs.readFileSync("./broadcast.conf").toString();
let mainWindow: Electron.BrowserWindow | null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL(`file://${_dir}/page/index.html`)

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
app.on('ready', createWindow);
app.allowRendererProcessReuse = true;

const peerShare = new PeerShare(8089, broadMask);
peerShare.on("data", (message:IHostMessage) => {
  console.log("DATA: Information from :", message.address,message.payload);

});
peerShare.on("host-update", (state:IHostState) => {
  console.log("host-update: Information :",state);
});
setTimeout(() => {
	peerShare.share<string>("This is Test to check data communication");
}, 2000);
function sendMessageToRenderer(message:object) {
       mainWindow?.webContents.send('message',message);
}
ipcMain.on('message', (event:any, message:any)=>{
  
  var type = message.type;
  switch (type) {
    case 'logged':
      var email = message.email;
      mainWindow?.loadURL(`file://${_dir}/page/page.html?email=${email}`);
      break;
    case "get-hosts":
      sendMessageToRenderer({type:'host-list',list:peerShare.getPeerNetworkInformation().hostList});
      break;
   case "peer-send":
        peerShare.share<object>(message.message,message.address);
        break;
   case "data":     
        
        break;
    default:
      break;
  }
});
