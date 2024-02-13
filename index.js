#!/usr/bin/env node

const pkg = require('./package.json')
const _ = require('lodash')
const logging = require('homeautomation-js-lib/logging.js')
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')
const klf_200_api = require('klf-200-api')
const Connection = klf_200_api.Connection
const Products = klf_200_api.Products
const Product = klf_200_api.Product
const interval = require('interval-promise')

const PING_INTERVAL = 5 * 60 * 1000 // 5 minutes

const VELUX_IP = process.env.VELUX_IP
const VELUX_PASSWORD = process.env.VELUX_PASSWORD

var topic_prefix = process.env.TOPIC_PREFIX
var mqttConnected = false
const mqttOptions = { retain: true, qos: 1 }

if (_.isNil(topic_prefix)) {
    logging.error('TOPIC_PREFIX not set, not starting')
    process.abort()
}

if (_.isNil(VELUX_IP)) {
    logging.error('VELUX_IP not set, not starting')
    process.abort()
}

if (_.isNil(VELUX_PASSWORD)) {
    logging.error('VELUX_PASSWORD not set, not starting')
    process.abort()
}

logging.info(pkg.name + ' ' + pkg.version + ' starting')


var allProducts = {}
var myProducts = {}

function findProductByName(name) {
    return myProducts.findProductByName(name)
}

async function setProductToPosition(name, position) {
    const foundProduct = myProducts.findByName(name);
    if (foundProduct) {
        logging.info("Found product: " + name + " setting to " + position)
        await foundProduct.setTargetPositionAsync(position);
    } else {
        logging.info("Found no product: " + name)
    }
}

function findProductByNodeID(nodeID) {
    var foundProduct = null

    allProducts.forEach(product => {
        if (nodeID == product.NodeID) {
            foundProduct = product
        }
    });

    return foundProduct
}

function findProductNameByNodeID(nodeID) {
    var foundProduct = findProductByNodeID(nodeID)

    if (foundProduct) {
        return foundProduct["_name"]
    }

    return null
}

function prepareName(name) {
    return _.lowerCase(mqtt_helpers.generateTopic(name))
}

async function findByName(productName) {
    return await Products.find((pr) => typeof pr !== "undefined" &&
        prepareName(pr.Name) == prepareName(productName))
}

async function processUpdate(update) {
    logging.debug('update: ' + JSON.stringify(update))
    const nodeID = update.NodeID

    if (!_.isNil(nodeID)) {
        const name = findProductNameByNodeID(nodeID)
        const foundProduct = await myProducts.findByName(name)
        var position = await foundProduct.TargetPosition;
        if (_.isNil(position)) {
            position = 0
        }

        if (!_.isNil(name)) {
            logging.info('Node ID: ' + nodeID + ' name: ' + name + ' position: ' + position)
            mqtt.smartPublish(mqtt_helpers.generateTopic(topic_prefix, name), position.toString(), mqttOptions)
        }
    }
}

async function startupConnection() {
    const conn = new Connection(VELUX_IP)
    logging.info('Logging in to: ' + VELUX_IP)
    await conn.loginAsync(VELUX_PASSWORD)

    logging.info('Logged in')

    try {
        async function updateProducts() {
            logging.info('Reading products')
            myProducts = await Products.createProductsAsync(conn)
            allProducts = myProducts.Products
        }

        await updateProducts()

        logging.info('Found ' + allProducts.length + ' products')
        allProducts.forEach(product => {
            processUpdate(product)
        });

        interval(async () => {
            logging.info('Kicking keep alive...')
            await updateProducts()
        }, PING_INTERVAL)

        logging.info('Subscribing to updates')

        conn.on((dataReceived) => {
            try {
                logging.debug('dataReceived: ' + JSON.stringify(dataReceived))
                processUpdate(dataReceived)
            } catch (ex) {
                logging.error('Update Error: ' + ex)
            }
        })
    } finally {
    }
}

startupConnection()

const mqtt = mqtt_helpers.setupClient(function () {
    mqttConnected = true

    const topicsToSubscribeTo = [topic_prefix + '/+/set']
    topicsToSubscribeTo.forEach(topic => {
        logging.info('mqtt subscribe: ' + topic)
        mqtt.subscribe(topic, { qos: 1 })
    })
}, function () {
    if (mqttConnected) {
        mqttConnected = false
        logging.error('mqtt disconnected')
    }
})

mqtt.on('error', err => {
    logging.error('mqtt: ' + err)
})


mqtt.on('message', (inTopic, inPayload) => {
    logging.info('mqtt <' + inTopic + ':' + inPayload)
    processIncomingMQTT(inTopic, inPayload)
})


async function processIncomingMQTT(inTopic, inPayload) {
    var topic = inTopic
    var payload = String(inPayload)

    const components = topic.split('/')

    if (_.endsWith(topic, '/set')) {
        var name = components[components.length - 2]
        name = name.replace(/_/g, ' ')
        logging.info('setting ' + name + ' to ' + payload)
        await setProductToPosition(name, payload)
    }
}

