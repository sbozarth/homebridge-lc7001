import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { PlatformLC7001 } from './platform'; 

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, PlatformLC7001);
}
