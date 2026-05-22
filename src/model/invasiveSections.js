"use strict";
var ObjectId = require('mongodb').ObjectId;
const { QueryCollectionFormat } = require('@azure/core-http');
const { JsonWebTokenError } = require('jsonwebtoken');
var mongo = require('../database/mongo');
const couchbase = require('../database/couchbase');

// Get bucket name and scope name for N1QL queries
const DB_BUCKET_NAME = couchbase.DB_BUCKET_NAME;
const DB_SCOPE_NAME = couchbase.DB_SCOPE_NAME;

async function getInvasiveSectionsCollection() {
    await couchbase.connectToDatabase();
    return couchbase.InvasiveSections;
}


var getInvasiveSectionById = async function(id){
    var response = {};
    try {
        const collection = await getInvasiveSectionsCollection();
        const docId = id.toString();
        const doc = await collection.get(docId);
        const result = doc.content || {};
        result._id = docId;

        if (result) {
            response = {
                "data": {
                    "item": result,
                    "message": "Invasive Section found.",
                    "code": 201
                }
            };
            return response;
        } else {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Invasive Section found."
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
                    "message": "No Invasive Section found."
                }
            }
            return response;
        }
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Invasive Section.",
                "errordata": err
            }
        }
        return response;
    }
}

var addInvasiveSection = async function(invasiveSection){
    var response = {};
    try {
        const collection = await getInvasiveSectionsCollection();
        var insertedId = (invasiveSection._id || new ObjectId()).toString();
        const invasiveSectionToInsert = {
            ...invasiveSection,
            _id: insertedId
        };
        await collection.insert(insertedId, invasiveSectionToInsert);
        if(insertedId){
            response = {
                "data": {
                    "id": insertedId,
                    "message": "Invasive Section inserted Successfully",
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

var getInvasiveSectionByParentId = async function(id){
    var response = {};
    try {
        await couchbase.connectToDatabase();
        const cluster = couchbase.cluster;
        const parentId = id.toString();

        const query = `SELECT META().id AS _id, InvasiveSection.*
                       FROM \`${DB_BUCKET_NAME}\`.\`${DB_SCOPE_NAME}\`.InvasiveSection
                       WHERE parentid = $1 OR TO_STRING(parentid) = $1 OR parentid.\`$oid\` = $1
                       LIMIT 1`;
        const queryResult = await cluster.query(query, {
            parameters: [parentId]
        });
        const result = queryResult.rows && queryResult.rows.length > 0 ? queryResult.rows[0] : null;

        if (result) {
            response = {
                "data": {
                    "item": result,
                    "message": "Invasive Section found.",
                    "code": 201
                }
            };
            return response;
        } else {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Invasive Section found."
                }
            }
            return response;
        }
    }
    catch (err) {
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Invasive Section.",
                "errordata": err
            }
        }
        return response;
    }
}

var editInvasiveSection = async function(invasiveSectionId,newInvasiveData)
{
    var response ={};
    try{
        const collection = await getInvasiveSectionsCollection();
        const docId = invasiveSectionId.toString();
        const existingDoc = await collection.get(docId);
        const updatedDoc = {
            ...(existingDoc.content || {}),
            ...newInvasiveData,
            _id: docId
        };
        await collection.replace(docId, updatedDoc);
        
        response = {
            "data" :{
                "message": "Invasive Section updated successfully.",
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
                    "message": "No Invasive Section found."
                  }
            }
            return response;
        }
        console.log(err);
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Invasive.",
                "errordata": err
              }
        }
        return response;
    }
    
};

module.exports = {
    getInvasiveSectionById,
    getInvasiveSectionByParentId,
    addInvasiveSection,
    editInvasiveSection
};