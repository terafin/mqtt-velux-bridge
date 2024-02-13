# mqtt-velux-bridge

This is a simple docker container that I use to bridge to/from my MQTT bridge.

I have a collection of bridges, and the general format of these begins with these environment variables:

```
      TOPIC_PREFIX: /your_topic_prefix  (eg: /some_topic_prefix/somthing)
      MQTT_HOST: YOUR_MQTT_URL (eg: mqtt://mqtt.yourdomain.net)
      (OPTIONAL) MQTT_USER: YOUR_MQTT_USERNAME
      (OPTIONAL) MQTT_PASS: YOUR_MQTT_PASSWORD
```

This will publish and (optionally) subscribe to events for this bridge with the TOPIC_PREFIX of you choosing.

Generally I use 0 as 'off', and 1 as 'on' for these. (note: decimal values work too)

Example: Publish this to close the skylight

```
   topic: /velux/Atrium_Left_Skylight/set
   value: 1
```

Here's an example docker compose:

```
version: '3.3'
services:
  mqtt-velux-bridge:
    image: ghcr.io/terafin/mqtt-velux-bridge:latest
    environment:
      LOGGING_NAME: mqtt-velux-bridge
      TZ: America/Los_Angeles
      TOPIC_PREFIX: /your_topic_prefix  (eg: /velux)
      VELUX_IP: YOUR_VELUX_IP
      VELUX_PASSWORD: YOUR_VELUX_PASSWORD
      MQTT_HOST: YOUR_MQTT_URL (eg: mqtt://mqtt.yourdomain.net)
      (OPTIONAL) MQTT_USER: YOUR_MQTT_USERNAME
      (OPTIONAL) MQTT_PASS: YOUR_MQTT_PASSWORD
```

Here's an example publish for my setup:

```
/velux/Atrium_Left_Skylight 1
/velux/Atrium_Right_Skylight 1
```
