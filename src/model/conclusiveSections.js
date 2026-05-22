"use strict";
var ObjectId = require('mongodb').ObjectId;
const { QueryCollectionFormat } = require('@azure/core-http');
const { JsonWebTokenError } = require('jsonwebtoken');
var mongo = require('../database/mongo');
const couchbase = require('../database/couchbase');
const RatingMapping  = require("./ratingMapping.js");

// Get bucket name and scope name for N1QL queries
const DB_BUCKET_NAME = couchbase.DB_BUCKET_NAME;
const DB_SCOPE_NAME = couchbase.DB_SCOPE_NAME;

async function getConclusiveSectionsCollection() {
    await couchbase.connectToDatabase();
    return couchbase.ConclusiveSections;
}


var getConclusiveSectionById = async function(id){
    var response = {};
    try {
        const collection = await getConclusiveSectionsCollection();
        const docId = id.toString();
        const doc = await collection.get(docId);
        const result = doc.content || {};
        result._id = docId;
        if (result) {
            transformData(result);
            response = {
                "data": {
                    "item": result,
                    "message": "Conclusive Section found.",
                    "code": 201
                }
            };
            return response;
        } else {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Conclusive Section found."
                }
            }
            return response;
        }
    }
    catch (err) {
        if (err.name === "DocumentNotFoundError") {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Conclusive Section found."
                }
            }
            return response;
        }
        console.log(err);
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Conclusive Section.",
                "errordata": err
            }
        }
        return response;
    }

}


var transformData = function(conclusiveSection) {
    conclusiveSection.eeeconclusive = RatingMapping[conclusiveSection.eeeconclusive];
    conclusiveSection.lbcconclusive = RatingMapping[conclusiveSection.lbcconclusive];
    conclusiveSection.aweconclusive = RatingMapping[conclusiveSection.aweconclusive];
};

var getConclusiveSectionByParentId = async function(id){
    var response = {};
    try {
        await couchbase.connectToDatabase();
        const cluster = couchbase.cluster;
        const parentId = id.toString();

        const query = `SELECT META().id AS _id, ConclusiveSection.*
                       FROM \`${DB_BUCKET_NAME}\`.\`${DB_SCOPE_NAME}\`.ConclusiveSection
                       WHERE parentid = $1 OR TO_STRING(parentid) = $1 OR parentid.\`$oid\` = $1
                       LIMIT 1`;
        const queryResult = await cluster.query(query, {
            parameters: [parentId]
        });
        const result = queryResult.rows && queryResult.rows.length > 0 ? queryResult.rows[0] : null;
        
        if (result) {
            transformData(result);
            response = {
                "data": {
                    "item": result,
                    "message": "Conclusive Section found.",
                    "code": 201
                }
            };
            return response;
        } else {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Conclusive Section found."
                }
            }
            return response;
        }
    }
    catch (err) {
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Conclusive Section.",
                "errordata": err
            }
        }
        return response;
    }

}

var addConclusiveSection = async function(conclusiveSection){
    var response = {};
    try {
        const collection = await getConclusiveSectionsCollection();
        var insertedId = (conclusiveSection._id || new ObjectId()).toString();
        const conclusiveSectionToInsert = {
            ...conclusiveSection,
            _id: insertedId
        };
        await collection.insert(insertedId, conclusiveSectionToInsert);
        if(insertedId){
            response = {
                "data": {
                    "id": insertedId,
                    "message": "Conclusive Section inserted Successfully",
                    "code": 201
                }
            }
        }
        else {
            response = {
                "error": {
                    "code": 500,
                    "message": "No Section inserted."
                }
            }
        }
        return response;
    } catch (error) {
        console.log(error);
    }
};

var editConclusiveSection = async function(conclusiveSectionId,newConclusiveData)
{
    var response ={};
    try{
        const collection = await getConclusiveSectionsCollection();
        const docId = conclusiveSectionId.toString();
        const existingDoc = await collection.get(docId);
        const updatedDoc = {
            ...(existingDoc.content || {}),
            ...newConclusiveData,
            _id: docId
        };
        await collection.replace(docId, updatedDoc);
        
        response = {
            "data" :{
                "message": "Conclusive Section updated successfully.",
                "code":201
            }
        };
        return response;
    }
    catch(err){
        if (err.name === "DocumentNotFoundError") {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Conclusive Section found."
                  }
            }
            return response;
        }
        console.log(err);
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Conclusive.",
                "errordata": err
              }
        }
        return response;
    }
    
};

module.exports = {
    getConclusiveSectionById,
    getConclusiveSectionByParentId,
    addConclusiveSection,
    editConclusiveSection
};