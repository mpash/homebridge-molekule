"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MolekulePlatformAccessory = void 0;
const cognito_1 = require("./cognito");
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class MolekulePlatformAccessory {
    constructor(platform, accessory, config, log) {
        this.platform = platform;
        this.accessory = accessory;
        this.config = config;
        this.log = log;
        /**
         * These are just used to create a working example
         * You should implement your own code to track the state of your accessory
         */
        this.state = {
            state: 0,
            Speed: 0,
            Filter: 100,
            On: 0,
            Auto: 0,
        };
        this.caller = new cognito_1.HttpAJAX(this.log, this.config);
        // set accessory information
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Molekule')
            .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.serialNumber)
            .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.firmwareVersion);
        // get the AirPurifier service if it exists, otherwise create a new AirPurifier service
        // you can create multiple services for each accessory
        this.service =
            this.accessory.getService(this.platform.Service.AirPurifier) ||
                this.accessory.addService(this.platform.Service.AirPurifier);
        // set the service name, this is what is displayed as the default name on the Home app
        // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        // each service must implement at-minimum the "required characteristics" for the given service type
        // see https://developers.homebridge.io/#/service/AirPurifier
        // register handlers for the On/Off Characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.handleActiveSet.bind(this)) // SET - bind to the `handleActiveSet` method below
            .onGet(this.handleActiveGet.bind(this)); // GET - bind to the `handleActiveGet` method below
        // register handlers for the CurrentAirPurifierState Characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState)
            .onGet(this.getState.bind(this)); // GET - bind to the `getState` method below
        // register handlers for the TargetAirPurifierState Characteristic
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
            .onSet(this.handleAutoSet.bind(this))
            .onGet(this.handleAutoGet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onSet(this.setSpeed.bind(this))
            .onGet(this.getSpeed.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
            .onGet(this.getFilterChange.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
            .onGet(this.getFilterStatus.bind(this));
        /**
         * Creating multiple services of the same type.
         *
         * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
         * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
         * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
         *
         * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
         * can use the same sub type id.)
         */
    }
    /**
     * Handle "SET" requests from HomeKit
     * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
     */
    async handleActiveSet(value) {
        // implement your own code to turn your device on/off
        let data = '"on"}';
        if (!value)
            data = '"off"}';
        const response = await this.caller.httpCall('POST', this.accessory.context.device.serialNumber + '/actions/set-power-status', '{"status":' + data, 1);
        if (response.status === 204) {
            this.service.updateCharacteristic(this.platform.Characteristic.Active, value);
            if (value) {
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, 2);
                this.state.state = 2;
                this.state.On = 1;
            }
            else {
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, 0);
                this.state.On = 0;
            }
        }
        this.platform.log.info('Attempted to set: ' +
            value +
            ' state on device: ' +
            this.accessory.context.device.name +
            ' Server Reply: ' +
            JSON.stringify(response));
    }
    /**
     * Handle the "GET" requests from HomeKit
     * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
     *
     * GET requests should return as fast as possbile. A long delay here will result in
     * HomeKit being unresponsive and a bad user experience() in general.
     *
     * If your device takes time to respond you should update the status of your device
     * asynchronously instead using the `updateCharacteristic` method instead.
     * @example
     * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
     */
    async handleActiveGet() {
        if ((await this.updateStates()) === 1)
            throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        this.log.info(this.accessory.context.device.name + ' state is: ' + this.state.On);
        return this.state.On;
        // if you need to return an error to show the device as "Not Responding" in the Home app:
        // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    async getState() {
        return this.state.state;
    }
    async handleAutoSet(value) {
        try {
            if (value === 1) {
                await this.setSpeed((100 / 3) * 2);
            }
        }
        catch (err) {
            throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        }
        this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, value);
    }
    async handleAutoGet() {
        if ((await this.updateStates()) === 1)
            throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        return this.state.Auto;
    }
    /**
     * Handle "SET" requests from HomeKit
     * These are sent when the user changes the state of an accessory, for example, changing the speed
     */
    async setSpeed(value) {
        const clamp = Math.round(Math.min(Math.max(value / 33.33333333, 1), 3));
        const setFanSpeedRequest = await this.caller.httpCall('POST', this.accessory.context.device.serialNumber + '/actions/set-fan-speed', '{"fanSpeed": ' + clamp + '}', 1);
        if (setFanSpeedRequest.status === 204) {
            this.state.Speed = clamp * 33.33333333;
            this.state.Auto = clamp === 2 ? 1 : 0;
        }
        this.platform.log.info(this.accessory.context.device.name + ' set speed -> ', '{"fanSpeed":' + clamp + '}');
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.Auto);
    }
    async getSpeed() {
        return this.state.Speed;
    }
    async getFilterChange() {
        if (this.state.Filter > this.config.threshold)
            return 0;
        else
            return 1;
    }
    async getFilterStatus() {
        this.log.debug('Check Filter State: ' + this.state.Filter);
        return this.state.Filter;
    }
    async updateStates() {
        const re = await this.caller.httpCall('GET', '', '', 1);
        const response = await re.json();
        if (response === undefined)
            return 1;
        for (let i = 0; i < Object.keys(response.content).length; i++) {
            if (response.content[i].serialNumber ===
                this.accessory.context.device.serialNumber) {
                this.platform.log.info('Get Speed ->', response.content[i].fanspeed);
                this.state.Speed = response.content[i].fanspeed * 33.33333333;
                this.state.Filter = response.content[i].pecoFilter;
                this.state.Auto = response.content[i].fanspeed === '2' ? 1 : 0;
                if (response.content[i].online === 'false') {
                    this.log.error(this.accessory.context.device.name +
                        ' was reported to be offline by the Molekule API.');
                    return 1;
                }
                if (response.content[i].mode !== 'off') {
                    this.state.On = 1;
                    this.state.state = 2;
                }
                else {
                    this.state.On = 0;
                    this.state.state = 0;
                }
            }
        }
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.state.state);
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.state.On);
        return 0;
    }
}
exports.MolekulePlatformAccessory = MolekulePlatformAccessory;
//# sourceMappingURL=platformAccessory.js.map