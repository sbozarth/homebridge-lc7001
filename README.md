# homebridge-LC7001
Homebridge plugin to communicate with Legrand LC7001. (RFLC, Adorne, and On-Q)

***Currently, this plugin has only been written for light switches and dimmers.***

About the Author:
This plugin was written by a lawyer. It was not written by a professional programmer. The original author was introduced to BASIC in the 1980s, took AP computer science in high school when they still taught it in Pascal, and took non-CS introductory courses in C and FORTRAN in college where he majored in economics. Before becoming a lawyer, he did work extensively in the computer world in networking and systems. That means he could cobble together a decent bash or DOS script, and even wrote some VBScript to fill a need. Along the way, he taught himself enough PHP and SQL to get things he needed done and make a real programmer queezy. This was his first attempt at writing anything in JavaScript and he had never heard of Node.js before embarking on this journey. He wrote this because he really, really wanted the expensive Adorne light switches he bought to work with HomeKit and years of waiting for the LC7001 to be updated to support HomeKit did not yield a result. He now makes his work available to the world, not because this is a great piece of software (in fact, there are still large sections of code that he doesn't know what they do, but they came in the sample plugin), but in hopes that he can connect with more experienced programmers who can help clean it up into a finished project. So far, this works for him at his house. He hopes it can make your non-Homekit light switches work with HomeKit, too. Please, participate and contribute and make this better!

This plugin requires the following addition to the Homebridge config.json:
{
  "platforms": [
    {
      "platform" : "LC7001",
      "name" : "Adorne",
      "lc7001-hostname" : "x.x.x.x"
    }
  ]
}

Where "x.x.x.x" is the IP address of your LC7001. Replacing "x.x.x.x" with a hostname or IPv6 address should work as the string is passed to the net.Socket Node.js object without modification.
The "name" field is whatever you would like it to be; it is simply what shows up in the Homebridge log.
The "platform" field is coded into the plugin; do not change it.

If your LC7001 for some reason does not use port 2112, you may specify a different port:

{
  "platforms": [
    {
      "platform" : "LC7001",
      "name" : "Adorne",
      "lc7001-hostname" : "x.x.x.x",
      "lc7001-port" : 2112
    }
  ]
}

Configure your LC7001 using the Legrand Lighting Control app, available here: https://www.legrand.us/home-automation/rflc/rflc-app.aspx
Name your light switches and dimmers wisely, as the name is used as the unique identifier. Renaming lights in the Legrand Lighting Control app has not been tested.
The first time you run the plugin, it will poll the LC7001 and create all of the switches in HomeKit as light bulbs in the default room. You can rename the lights as much as you want within HomeKit.
