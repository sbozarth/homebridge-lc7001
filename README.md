# homebridge-lc7001
Homebridge plugin to communicate with Legrand LC7001. (RFLC, Adorne, and On-Q)

***Currently, this plugin has only been written for light switches and dimmers.***

About the Author:
This plugin was written by a lawyer. It was not written by a professional programmer. The original author was introduced to BASIC in the 1980s, took AP computer science in high school when they still taught it in Pascal, and took non-CS introductory courses in C and FORTRAN in college where he majored in economics. Before becoming a lawyer, he did work extensively in the computer world in networking and systems. That means he could cobble together a decent bash or DOS script, and even wrote some VBScript to fill a need. Along the way, he taught himself enough PHP and SQL to get things he needed done and make a real programmer queezy. This was his first attempt at writing anything in JavaScript and he had never heard of Node.js before embarking on this journey. He wrote this because he really, really wanted the expensive Adorne light switches he bought to work with HomeKit and years of waiting for the LC7001 to be updated to support HomeKit did not yield a result. He now makes his work available to the world, not because this is a great piece of software, but in hopes that he can connect with more experienced programmers who can help clean it up into a finished project. So far, this works for him at his house. He hopes it can make your non-Homekit light switches work with HomeKit, too. Please, participate and contribute and make this better!

This plugin requires the following addition to the Homebridge config.json:
{
  "platforms": [
    {
      "platform" : "LC7001",
      "name" : "LC7001"
    }
  ]
}

All other parameters are optional:

{
  "platforms": [
    {
      "platform" : "LC7001",
      "name" : "LC7001",
      "lc7001-password: : "********",
      "lc7001-hostname" : "LCM1.local",
      "lc7001-port" : 2112,
      "lc7001-localaddress" : undefined,
      "lc7001-localport" : undefined,
      "lc7001-family" : 0,
      "lc7001-delimiter" : "\0",
      "logBroadcastDiagnostics" : false,
      "logBroadcastMemory" : false,
      "logDebugMessages" : false,
      "logEliotErrors" : false,
      "useOldUUID" : false
    }
  ]
}

Parameter | Description
--------- | -----------
platform | This is coded into the plugin and must match PLATFORM_NAME in src/settings.ts; do not change one unless you change the other.
name | This is whatever you would like it to be; it is what shows up in the Homebridge log.
lc7001-password | If your LC7001 has authentication enabled, you will need to supply the password in this field.
lc7001-hostname | If you do not specify the hostname/IP of the LC7001, the default of "LCM1.local" will be used. "LCM1.local" is a mDNS hostname that the LC7001 will answer. "LCM1.local" can be replaced with any hostname or IP address that can be resolved by the net.Socket Node.js object.
lc7001-port | If you do not specify the TCP port number for the LC7001, the default of 2112 will be used.
lc7001-localaddress | Allows you to specify which source IP address will be used to contact the LC7001.
lc7001-localport | Allows you to specify the source TCP port that will be used to contact the LC7001.
lc7001-family | Allows you to specify the IP version to use to contact the LC7001. 4:IPv4, 6:IPv6, and 0:Default IPv4 or IPv6.
lc7001-delimiter | Allows you to specify the character the LC7001 uses to separate JSON objects. You should not need to change this unless the LC7001 firmware is changed.
logBroadcastDiagnostics | The LC7001 regularly transmits diagnostic information. This logs those messages.
logBroadcastMemory | The LC7001 regularly transmits memory usage information. This logs those messages.
logDebugMessages |  The LC7001 frequently transmits debug messages. This logs those messages. (Homebridge debugging is enabled by passing the -D switch to homebridge.)
logEliotErrors | The LC7001 frequenty transmits messages labled "EliotErrors." This logs those messages.
useOldUUID | Prior to version 1.0.0, this plugin used the name of an accessory on the LC7001 to generate the UUID. Staring with version 1.0.0, this plugin uses a mix of the name and the MAC address of the LC7001. This change was made to prevent UUID collisions. Setting this option to true will cause the plugin to use the old method.

Configure your LC7001 using the Legrand Lighting Control app, available here: https://www.legrand.us/home-automation/rflc/rflc-app.aspx
The plugin should work as long as the LC7001 is attached to the same network. If not in the same broadcast domain (for mDNS), you will need to specify lc7001-hostname in config.json. 
The names you give your light switches and dimmers are treated as unique indentifiers. If you rename any object in the Legrand Lighting Control app, the accessory will be removed from HomeKit and readded under the new name. You can rename the lights as much as you want within HomeKit, just not within the Legrand Lighting Control app.
