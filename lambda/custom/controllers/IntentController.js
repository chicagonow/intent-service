const LocationHandler = require('../handlers/location/LocationHandler');
const EventsHandler = require('../handlers/events/EventsHandler');
const BusHandler = require('../handlers/transit/bus/BusHandler');
const CtaTrainHandler = require('../handlers/transit/train/CtaTrainHandler');
const ParameterHelper = require('../helpers/ParameterHelper');
const logger = require("../logging/Logger");
const AmazonDateParser = require('amazon-date-parser');
const TrainRepository = require('../repositories/transit/CtaTrainRepository');
const _ = require('lodash');

exports.getEvents = async (event) => {
    let eventLocationIntentSlots = event.request.intent.slots;
    let alexaResponse = "There was an error using events handler";

    let eventLocation = eventLocationIntentSlots.venueName.value || "";
    if (!eventLocation) {
        eventLocation = eventLocationIntentSlots.landmark.value || "";
    }

    let locationParameters;
    let locationObj = {
        latitude : "",
        longitude : ""
    };
    if (eventLocation.trim() === "") {
        locationParameters = ParameterHelper.getLocationParameters(event.context.System);
        locationObj = await LocationHandler.asyncGetLocation(locationParameters.apiEndpoint, locationParameters.token, locationParameters.deviceID);
    }

    let timeFrame = eventLocationIntentSlots.timeFrame.value || "";


    let parsedDate = {
        startDate: "",
        endDate: ""
    };

    if (timeFrame.trim()) {
        try {
            parsedDate = new AmazonDateParser(timeFrame);
        } catch (error) {
            logger.error(error);
        }
    }

    let eventGenre = eventLocationIntentSlots.eventGenre.value || "";

    try {
        alexaResponse = await EventsHandler.asyncGetEvents(eventGenre, eventLocation, parsedDate.startDate, parsedDate.endDate, locationObj.latitude, locationObj.longitude);
    } catch (error) {
        logger.error(error);
    }

    return alexaResponse;
};

/**
 * Returns events within the specified time frame
 * @param {string} apiEndpoint
 * @param {string} token
 * @param {string} deviceID
 * @param {string} date
 */
exports.getEventsWithinTimeFrame = async function getEventsWithinTimeFrame(apiEndpoint, token, deviceID, date) {
    // Get location
    let locationObj = await LocationHandler.asyncGetLocation(apiEndpoint, token, deviceID)
        .catch(error => {
            logger.error(error);
        });

    // Get Date time frame
    let timeFrame;
    try {
        timeFrame = new AmazonDateParser(date);
    } catch (error) {
        logger.error(error);
    }

    // Return response
    let alexaResponse = await EventsHandler.asyncGetEventsWithinTimeFrame(locationObj.latitude, locationObj.longitude, timeFrame.startDate, timeFrame.endDate)
        .catch(error => {
            logger.error(error);
        });

    return alexaResponse;
};

exports.getBusesWithUserLocation = async function getBusesWithUserLocation(apiEndpoint, token, deviceID, route, direction) {
    let locationObj = await LocationHandler.asyncGetLocation(apiEndpoint, token, deviceID)
        .catch(error => {
            logger.error(error);
        });

    let alexaResponse = await BusHandler.asyncGetBusesWithUserLocation(route, direction, locationObj.latitude, locationObj.longitude)
        .catch(error => {
            logger.error(error);
        });

    return alexaResponse;
};

exports.getBusesByStop = async function getBusesByStop(route, stopId) {
    let alexaResponse = await BusHandler.asyncGetBusesByStop(route, stopId)
        .catch(error => {
            logger.error(error);
        });

    return alexaResponse;
};

exports.getStatusOfTrainStation = async function getStatusOfTrainStation(mapid, route) {
    let alexaTrainStatusResponse = await CtaTrainHandler.asyncCallCta(mapid, route)
        .catch(error => {
            logger.error(error);
        });

    return alexaTrainStatusResponse;
};

exports.asyncGetTrain = async function asyncGetTrain(stationName, trainLine, direction) {
    // Search the repo for any stations matching the given station name
    let stations = await TrainRepository.getPotentialTrainStations(stationName);

    // No matching names were found
    if (stations.length === 0) {
        logger.log({level: "info", message: "No train stations found matching name"});
        return "No train stations were found that match the name " + stationName + ". Please try again";
    }

    // If the user wants to filter by trainLine, get those results
    if (trainLine) {        
        stations = _.filter(stations, [trainLine.toLowerCase(), true]);
    }

    // No matching colors were found
    if (stations.length === 0) {
        logger.log({level: "info", message: "No train stations found matching line"});
        return "No train stations were found that match that train line. Please try again";
    }

    // If the user wants to filter by direction as well, get those matching stations
    if (direction) {
        stations = _.filter(stations, ['direction_id', direction.toUpperCase()]);
    }

    // No matching stations at all. You suck
    if (stations.length === 0) {
        logger.log({level: "info", message: "No train stations found matching direction"});
        return "No train stations were found that match that direction. Please try again";
    } else {
        let stationMatch = stations[0];
        let alexaResponse = await CtaTrainHandler.asyncCallCta(stationMatch.stop_id);
        return alexaResponse;
    }
};
