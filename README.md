# Server to control simulatos, emulators and real devices.
    Purpose of this tool is to manage all devices on а machine.
    This is very convinience when a multiple builds are triggered.

    Provides basic mathods as:

        -subscribeForDevice for device. Accepts:
            { platform :platformName, name: name, info: info, apiLevel:apiLevel }
            { platform :platformName, token: token, info: info, apiLevel:apiLevel }
            { type :deviceType, name: name, info: info, apiLevel:apiLevel }
        -unsubscribeFromDevice for {token: device.token}.
        -boot device.
        -kill device.
    
    Basically works with query of type IDevice exposed in mobile-devices-controller 

        export interface IDevice {
            name: string,
            token: string,
            type: DeviceType,
            platform: Platform,
            status?: Status,
            startedAt?: number,
            busySince?: number,
            pid?: number,
            apiLevel?: string,
            info?: string,
            config?: any,
        }

## Install

Install the node packages via:

`$ npm install`

## Using local storage 
    By default mobile-device-manager uses local storage to store device info using files. 
    Default folder location is in home folder of the user.
    To override it, set env variable `DEVICE_INFO_STORAGE`=path to storage.

## Using remote storage

    Set evn variable `USE_MONOGDB_STORAGE`=true

### Install mogodb

`$ brew update`
`$ brew install mongodb`

#### Create database default folder

`mkdir -p data/db`

#### Run mongodb

`mogod`

## Use as command line tool.
    Call mobileD to see all available options.
        --subscribe
        --unsubscribe
        --useMongoDB
        --verbose
