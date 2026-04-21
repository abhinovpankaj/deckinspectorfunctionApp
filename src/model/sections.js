"use strict";
var ObjectId = require('mongodb').ObjectId;
const { QueryCollectionFormat } = require('@azure/core-http');
const { JsonWebTokenError } = require('jsonwebtoken');
var mongo = require('../database/mongo');
const couchbase = require('../database/couchbase');
const RatingMapping  = require("./ratingMapping.js");
const Locations = require('./location.js');

async function getSectionsCollection() {
    await couchbase.connectToDatabase();
    return couchbase.Sections;
}

var addSection = async function (section) {
    var response = {};
    try {
        var result = await mongo.Sections.insertOne(section);
        var insertedId = result.insertedId;
        if (result.insertedId) {
            var projresult = await mongo.Locations.updateOne({ _id: new ObjectId(section.parentid) }, {
                $push:
                {
                    sections:
                    {
                        "_id": result.insertedId,
                        "name": section.name,
                        "visualsignsofleak": section.visualsignsofleak,
                        "furtherinvasivereviewrequired": section.furtherinvasivereviewrequired,
                        "conditionalassessment": section.conditionalassessment,
                        "visualreview": section.visualreview,
                        "count":0
                    }
                }
            }
            );
            if (projresult.modifiedCount > 0) {
                var msg = "Section inserted successfully,parent updated successfully."
            }
            else
                var msg = "Section inserted successfully,parent failed to updated."
            //console.log(msg);
           
            var result = await markInvasive(section);

            response = {
                "data": {
                    "id": insertedId,
                    "message": msg,
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


var markInvasive = async function(section) {
    if (section.furtherinvasivereviewrequired === true) {
        var parentId = section.parentid;
        var parentType = section.parenttype.toLowerCase().trim();
        //console.log( "  ----  " ,parentId, "  ----  " ,parentType);
        while (parentId && parentType) {
            //console.log(parentId, "  ----  " ,parentType);
            if (parentType === 'buildinglocation' ||
                parentType === 'projectlocation' ||
                parentType === 'apartment') {
                var result = await mongo.Locations.updateOne({ _id: new ObjectId(parentId) }, {
                    $set: {
                        isInvasive: true
                    }
                });
                var location = await mongo.Locations.findOne({ _id: new ObjectId(parentId) });
                parentId = location.parentid;
                parentType = location.parenttype.toLowerCase().trim();
            }
            else if (parentType === 'subproject') {
                var result = await mongo.SubProjects.updateOne({ _id: new ObjectId(parentId) }, {
                    $set: {
                        isInvasive: true
                    }
                });
                //console.log(result.modifiedCount);
                var subProject = await mongo.SubProjects.findOne({ _id: new ObjectId(parentId) });
                parentId = subProject.parentid;
                parentType = subProject.parenttype.toLowerCase().trim();
            }
            else if (parentType === 'project') {
                var result = await mongo.Projects.updateOne({ _id: new ObjectId(parentId) }, {
                    $set: {
                        isInvasive: true
                    }
                });
                //console.log(result.modifiedCount);
                var project = await mongo.Projects.findOne({ _id: new ObjectId(parentId) });
                parentId = undefined
                parentType = undefined;
            }
        }
    }
    return result;
}


var transformData = function(section) {
      section.visualreview = capitalizeWords(section.visualreview);
      section.visualsignsofleak = capitalizeWords(section.visualsignsofleak.toString());
      section.furtherinvasivereviewrequired = capitalizeWords(section.furtherinvasivereviewrequired.toString());
      section.conditionalassessment = capitalizeWords(section.conditionalassessment.toString());
      section.eee = RatingMapping[section.eee];
      section.lbc = RatingMapping[section.lbc];
      section.awe = RatingMapping[section.awe];

};

var capitalizeWords = function (word) {
    if(word)
    {
    var finalWord = word[0].toUpperCase() + word.slice(1);
    return finalWord;
    }
    return word;
}

var normalizeSectionIdentifiers = function (section, fallbackId) {
    if (!section) {
        return section;
    }

    const resolvedId = section.id || section._id || fallbackId;
    if (resolvedId !== undefined && resolvedId !== null) {
        section.id = resolvedId.toString();
        section._id = resolvedId.toString();
    }

    return section;
}

var getDynamicSectionById = async function (id) {
    var response = {};
    try {
        const result = await mongo.DynamicSections.findOne({ _id: new ObjectId(id) }); 
        if (result) {
            normalizeSectionIdentifiers(result, id);
            //transformData(result);
            response = {
                "data": {
                    "item": result,
                    "message": "Section found.",
                    "code": 201
                }
            };
            return response;
        } else {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Section found."
                }
            }
            return response;
        }
    }
    catch (err) {
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Section.",
                "errordata": err
            }
        }
        return response;
    }
};

var getSectionById = async function (id) {
    var response = {};
    try {
        const collection = await getSectionsCollection();

        console.log("Fetching section with ID:", id);

        const doc = await collection.get(id);
        const content = doc.content || {};
    normalizeSectionIdentifiers(content, id);

        transformData(content);

        response = {
            "data": {
                "item": content,
                "message": "Section found.",
                "code": 201
            }
        };
        return response;
    } catch (err) {
        if (err.name === "DocumentNotFoundError") {
            console.warn(`Section not found for ID: ${id}`);
            response = {
                "error": {
                    "code": 401,
                    "message": "No Section found."
                }
            };
            return response;
        }

        console.error("Error fetching section by ID:", err);
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Section.",
                "errordata": err
            }
        };
        return response;
    }
};
//details will be a flexible structure of the form.
//images: array of image urls
var updateSection = async function (section,count) {
    var response = {};
    try {
        var result = await mongo.Sections.updateOne({ _id: new ObjectId(section.id) }, {
            $set: {
                name: section.name,
                exteriorelements: section.exteriorelements,
                waterproofingelements: section.waterproofingelements,
                lasteditedby: section.lasteditedby,
                editedat: section.editedat,
                additionalconsiderations: section.additionalconsiderations,
                visualreview: section.visualreview,
                visualsignsofleak: section.visualsignsofleak,
                furtherinvasivereviewrequired: section.furtherinvasivereviewrequired,
                conditionalassessment: section.conditionalassessment,
                eee: section.eee,
                lbc: section.lbc,
                awe: section.awe,
                parentid: section.parentid
            }
        });

        if (result.matchedCount < 1) {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Section found."
                }
            }
            return response;
        } else {
            if (result.modifiedCount == 1) {

                var projresult = await mongo.Locations.updateOne(
                    {
                        "sections.id": new ObjectId(section.id)
                    },
                    {
                        $set: {
                            "sections.$.name": section.name,
                            "sections.$.visualsignsofleak": section.visualsignsofleak,
                            "sections.$.furtherinvasivereviewrequired": section.furtherinvasivereviewrequired,
                            "sections.$.conditionalassessment": section.conditionalassessment,
                            "sections.$.visualreview": section.visualreview,
                            
                        }
                    },
                    { upsert: false });
                if (projresult.modifiedCount > 0) {
                    var msg = "Section updated successfully,parent updated successfully."
                }
                else
                    var msg = "Section udated successfully,parent failed to updated."
                response = {
                    "data": {
                        "message": msg,
                        "code": 201
                    }
                };
                return response;
            }
            else {
                response = {
                    "data": {
                        "message": "Failed to update the Section details.",
                        "code": 409
                    }
                };
                return response;
            }
        }
    }
    catch (err) {
        response = {
            "error": {
                "code": 500,
                "message": "Error processing Section updates.",
                "errordata": err
            }
        }
        return response;
    }

};

var editSection = async function(sectionId,newSectionData)
{
    var response ={};
    try{
        const updateObject = { $set: newSectionData };
        if(newSectionData.furtherinvasivereviewrequired ){
             newSectionData.furtherinvasivereviewrequired = (newSectionData.furtherinvasivereviewrequired.toLowerCase() === 'true');
        }
        var result = await mongo.Sections.updateOne({ _id: new ObjectId(sectionId) },updateObject,{upsert:false});    
        if(result.modifiedCount<1 && result.matchedCount<1){
            response = {
                "error": {
                    "code": 401,
                    "message": "No Location found."
                  }
            }
            return response;
        } else{
            if(result.modifiedCount==1){
                var section = await mongo.Sections.findOne({ _id: new ObjectId(sectionId) });
                if(newSectionData.furtherinvasivereviewrequired ){
                    if(newSectionData.furtherinvasivereviewrequired === true)
                    {
                        await markInvasive(section);
                    }
                }
                var  projectResult =  await Locations.updateSectionInLocationsRemove(section.parentid,sectionId);
                var projectResult2 = await Locations.updateSectionInLocationsAdd(section.parentid,sectionId,section);
                response = {
                    "data" :{                   
                        "message": "Location updated successfully.",
                        "code":201
                    }   
                };
                return response;
            }           
            else{
                response = {
                    "data" :{                    
                        "message": "Failed to update the Location details.",
                        "code":409
                    }   
                };
                return response;
            }                   
        }   
    }
    catch(err){
        console.log(err);
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Location.",
                "errordata": err
              }
        }
        return response;
    }
    
};
//Soft Delete/undelete
var updateSectionVisibilityStatus = async function (id, name, parentId, isVisible) {
    var response = {};
    try {
        //update the Projects collection as well.        
        var result = await mongo.Sections.updateOne({ _id: new ObjectId(id) },
            { $set: { isdeleted: !isVisible } });
        if (result.matchedCount == 0) {
            response = {
                "error": {
                    "code": 405,
                    "message": "No Section found, invalid id."
                }
            }
            return response;
        }
        if (result.modifiedCount == 1) {
            const sectionDetails = await mongo.Sections.findOne({ _id: new ObjectId(id) });
            if (!isVisible) {

                var projresult = await mongo.Locations.updateOne({ _id: new ObjectId(parentId) },
                    { $pull: { sections: { "id": new ObjectId(id) } } });
            }
            else {

                var projresult = await mongo.Locations.updateOne({ _id: new ObjectId(parentId) },
                    {
                        $push:
                        {
                            sections:
                            {
                                "id": new ObjectId(id),
                                "name": name,
                                "visualsignsofleak": sectionDetails.visualsignsofleak,
                                "furtherinvasivereviewrequired": sectionDetails.furtherinvasivereviewrequired,
                                "conditionalassessment": sectionDetails.conditionalassessment,
                                "visualreview": sectionDetails.visualreview,
                            }
                        }
                    });
            }

            if (projresult.modifiedCount > 0) {
                var message = `Section state updated successfully,is Visible:${isVisible}.parent  updated successfully.`;
            }
            else
                var message = `Section state updated successfully,is Visible:${isVisible}.parent failed to update.`;

            response = {
                "data": {
                    "message": message,
                    "code": 201
                }
            };
            return response;

        }
        else {
            response = {
                "error": {
                    "code": 405,
                    "message": "No Section modified, try with changed visibility state."
                }
            }
            return response;
        }
    } catch (error) {
        response = {
            "error": {
                "code": 500,
                "message": "Error changing visibility of Section.",
                "errordata": err
            }
        }
        return response;
    }
};

var deleteSectionPermanently = async function (id) {
    try {
        var section = await mongo.Sections.findOne({ _id: new ObjectId(id) });

        if(!section)
        {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Section found."
                }
            }
            return response;
        }

        //Update Parent
        await Locations.updateSectionInLocationsRemove(section.parentid,section._id);

        //Delete self
        var result = await mongo.Sections.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount == 1) {
           
            var response = {
                "data": {
                    "message": "Section deleted successfully.",
                    "code": 201
                }
            };
            return response;
        }
        else {
            response = {
                "error": {
                    "code": 401,
                    "message": "No Section found."
                }
            }
            return response;
        }
    }
    catch (err) {
        response = {
            "error": {
                "code": 500,
                "message": "Error deleting Section.",
                "errordata": err
            }
        }
        return response;
    }

};

var addRemoveImages = async function (sectionId,count, isAdd, url) {
    var response = {};
    try {
        if (isAdd){
            var result = await mongo.Sections.updateOne({ _id: new ObjectId(sectionId) }, 
            { $push: { images: url } });

            var projresult = await mongo.Locations.updateOne(
                {
                    "sections.id": new ObjectId(sectionId)
                },
                {
                    $set: {
                        "sections.$.count":++count
                    }
                });
        
        }
        else{
            var result = await mongo.Sections.updateOne({ _id: new ObjectId(sectionId) }, 
            { $pull: { images: url } });
            var projresult = await mongo.Locations.updateOne(
                {
                    "sections.id": new ObjectId(sectionId)
                },
                {
                    $set: {
                        "sections.$.count":--count
                    }
                });
        }
            

        if (result.matchedCount == 0) {  
            response = {
                "error": {
                    "code": 409,
                    "message": "No Section found."
                }
            }
            return response;
        }
        if (result.modifiedCount == 1) {
            response = {
                "data": {
                    "message": "image added/removed to/from the Section successfully.",
                    "code": 201
                }
            };
            return response;
        }
        else {
            response = {
                "error": {
                    "code": 409,
                    "message": "Error adding/removing common Section to/from the Section."
                }
            }
            return response;
        }
    } catch (error) {
        response = {
            "error": {
                "code": 500,
                "message": "Error adding common Section to the Section.",
                "errordata": err
            }
        }
        return response;
    }
}

var getSectionMetaDataForLocationId = async function(locationId){
    try{
        var response = {};
        const sectionDetails = await mongo.Sections.find(
            {parentid:new ObjectId(locationId)}
            ).toArray();
        if (sectionDetails.length>0) {
                response = {
                    "data": {
                        "item": sectionDetails,
                        "message": "Section found.",
                        "code": 201
                    }
                };
                return response;
            } else {
                response = {
                    "error": {
                        "code": 401,
                        "message": "No Section found."
                    }
                }
                return response;
            }    
    }catch(error){
        response = {
            "error": {
                "code": 500,
                "message": "Error fetching Section.",
                "errordata": error
            }
        }
        return response;
    }
}
module.exports = {
    addSection,
    updateSectionVisibilityStatus,
    deleteSectionPermanently,
    updateSection,
    getSectionById,
    addRemoveImages,
    getSectionMetaDataForLocationId,
    editSection,
    getDynamicSectionById
};