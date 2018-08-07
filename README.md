# homebridge-LC7001
Homebridge plugin to communicate with Legrand LC7001. (RFLC, Adorne, and On-Q)

This plugin requires the following addition to config.json:
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
The "platform" field is coded into the plugin.

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
