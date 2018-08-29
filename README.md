# homebridge-lc7001
Homebridge plugin to communicate with Legrand LC7001. (RFLC, Adorne, and On-Q)

***Currently, this plugin has only been written for light switches and dimmers.***

About the Author:
This plugin was written by a lawyer. It was not written by a professional programmer. The original author was introduced to BASIC in the 1980s, took AP computer science in high school when they still taught it in Pascal, and took non-CS introductory courses in C and FORTRAN in college where he majored in economics. Before becoming a lawyer, he did work extensively in the computer world in networking and systems. That means he could cobble together a decent bash or DOS script, and even wrote some VBScript to fill a need. Along the way, he taught himself enough PHP and SQL to get things he needed done and make a real programmer queezy. This was his first attempt at writing anything in JavaScript and he had never heard of Node.js before embarking on this journey. He wrote this because he really, really wanted the expensive Adorne light switches he bought to work with HomeKit and years of waiting for the LC7001 to be updated to support HomeKit did not yield a result. He now makes his work available to the world, not because this is a great piece of software (in fact, there are still large sections of code that he doesn't know what they do, but they came in the sample plugin), but in hopes that he can connect with more experienced programmers who can help clean it up into a finished project. So far, this works for him at his house. He hopes it can make your non-Homekit light switches work with HomeKit, too. Please, participate and contribute and make this better!

This plugin requires the following addition to the Homebridge config.json:
{
  "platforms": [
    {
      "platform" : "LC7001",
      "name" : "LC7001"
    }
  ]
}

This plugin supports two optional parameters. You may specify either one or both:

{
  "platforms": [
    {
      "platform" : "LC7001",
      "name" : "LC7001",
      "lc7001-hostname" : "LCM1.local",
      "lc7001-port" : 2112
    }
  ]
}

If you do not specify lc7001-hostname or lc7001-port, the defaults of "LCM1.local" and 2112 will be used. "LCM1.local" is a mDNS hostname that the LC7001 will answer. "LCM1.local" can be replaced with any hostname or IP address that can be resolved by the net.Socket Node.js object.
The "name" field is whatever you would like it to be; it is simply what shows up in the Homebridge log.
The "platform" field is coded into the plugin; do not change it.

Configure your LC7001 using the Legrand Lighting Control app, available here: https://www.legrand.us/home-automation/rflc/rflc-app.aspx
The plugin should work as long as the LC7001 is attached to the same network. If not in the same broadcast domain (for mDNS), you will need to specify lc7001-hostname in config.json. 
The names you give your light switches and dimmers are treated as unique indentifiers. If you rename any object in the Legrand Lighting Control app, the accessory will be removed from HomeKit and readded under the new name. You can rename the lights as much as you want within HomeKit, just not within the Legrand Lighting Control app.
