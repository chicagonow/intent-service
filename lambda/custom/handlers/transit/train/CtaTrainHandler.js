const request = require('request');
const buildUrl = require('build-url');
const TransitResponseBuilder = require('../TransitResponseBuilder');
const TrainRepository = require('../../../repositories/transit/CtaTrainRepository');
const LocationHandler = require('../../location/LocationHandler');
const asyncRequest = require('request-promise');

const CTA_API_KEY = '541afb8f3df94db2a7afffc486ea4fbf';
const CTA_API_DOMAIN = 'http://lapi.transitchicago.com';
const CTA_API_PATH = '/api/1.0/ttarrivals.aspx';

/**
 * Calls the CTA api with the specified parameters
 * @param {object} parameters 
 * @param {function} callback 
 */
exports.searchTrain = (parameters, callback) => {
    callCta(parameters, callback);
};

/**
 * Gets the nearest train station info
 * @param {object} parameters 
 * @param {function} callback 
 */
exports.searchTrainNearMe = (parameters, callback) => {

    LocationHandler.getLocation(parameters.apiEndpoint, parameters.token, parameters.deviceID, (location) => {
        TrainRepository.getNearestTrainMapID(location.latitude, location.longitude, (mapID) => {
            let parameters = {
                mapid: mapID,
                rt: ""
            };

            callCta(parameters, callback);
        });
    });    
};

/**
 * Calls the CTA Train API
 * @param {object} parameters 
 * @param {function} callback 
 */
let callCta = (parameters, callback) => {
    let url = buildUrl(CTA_API_DOMAIN, {
        path: CTA_API_PATH,
        queryParams: {
            key: CTA_API_KEY,
            mapid: parameters.mapid,
            rt: parameters.rt,
            outputType: "JSON"
        }
    });

    request(url,  (error, response, body) => {        
        let alexaResponse = TransitResponseBuilder.buildAlexaResponse(JSON.parse(body));
        callback(alexaResponse);        
    });
};

/**
 * Calls the CTA Train API
 * @param {object} ctaTrainParameters 
 */
exports.asyncCallCta = async function asyncCallCta(mapid, route) {
    let url = buildUrl(CTA_API_DOMAIN, {
        path: CTA_API_PATH,
        queryParams: {
            key: CTA_API_KEY,
            mapid: mapid,
            rt: route,
            outputType: "JSON"
        }
    });


    let alexaTrainStatusResponse = "";

    let responseBody = await asyncRequest(url)
        .catch(err => {
            console.error(err);
        });

    try {
        alexaTrainStatusResponse = TransitResponseBuilder.buildAlexaResponse(JSON.parse(responseBody));
    } catch (err) {
        alexaTrainStatusResponse = "There was an error with the CTA train service response.";
        console.error("The request body was: " + responseBody);
        console.error(err);
    }

    return alexaTrainStatusResponse;
};
