const subProject = require("../model/subproject");
const {generateReportForLocation, generateDocReportForLocation} = require("./sectionParts/util/locationGeneration/locationreportgeneration.js")
const LocationType = require("../model/locationType.js");
var promiseLimit = require('promise-limit')

function getEntityId(entity) {
    return entity?.id ?? entity?._id;
}

function compareByEntityId(entity1, entity2) {
    const entityId1 = getEntityId(entity1);
    const entityId2 = getEntityId(entity2);
    const entityId1Number = Number(entityId1);
    const entityId2Number = Number(entityId2);

    if (Number.isFinite(entityId1Number) && Number.isFinite(entityId2Number)) {
        return entityId1Number - entityId2Number;
    }

    return String(entityId1 ?? '').localeCompare(String(entityId2 ?? ''));
}

const generateDocReportForSubProject = async function generateDocReportForSubProject(subProjectId,companyName,
    sectionImageProperties,
    reportType,formId)
{
    var limit = promiseLimit(10)
    const subProjectData = await subProject.getSubProjectById(subProjectId);
    const subprojectName = subProjectData.data.item.name;
    const promises = [];
    const subProjectdoc = [];
    const orderdLocationsInSubProject = reordersubProjectLocations(subProjectData.data.item.children);

    await Promise.all(orderdLocationsInSubProject.map((key) => {

                return limit(() => generateDocReportForLocation(getEntityId(key),companyName,sectionImageProperties,reportType,formId,subprojectName));
      })).then(loc_html => {
        
        console.log('path:', loc_html)
        // reportDocList[loc_doc.key]=loc_doc.paths;
        subProjectdoc.push(...loc_html);
      })


    // for (let key in orderdLocationsInSubProject) {
    //     const promise = generateDocReportForLocation(orderdLocationsInSubProject[key]._id,companyName,sectionImageProperties,reportType,subprojectName)
    //         .then((loc_html) => {
    //             subProjectdoc[key]= loc_html;
    //         });
    //     promises.push(promise);
        
    // }
    // await Promise.all(promises);
    let subProjectdocSorted = [];
    for (let key in subProjectdoc) {
        subProjectdocSorted.push (...subProjectdoc[key]);
    }
    return subProjectdocSorted;
}

const generateReportForSubProject = async function generateReportForSubProject(subProjectId,sectionImageProperties,reportType)
{
    const subProjectData = await subProject.getSubProjectById(subProjectId);
    const promises = [];
    const locsHtmls = []; 
    if(subProjectData.data && subProjectData.data.item && subProjectData.data.item.children && subProjectData.data.item.children.length > 0)
    {
        const orderdLocationsInSubProject = reordersubProjectLocations(subProjectData.data.item.children);
        for (let key in orderdLocationsInSubProject) {
            const promise = generateReportForLocation(getEntityId(orderdLocationsInSubProject[key]),sectionImageProperties,reportType)
                .then((loc_html) => {
                locsHtmls[key] = loc_html;
                });
            promises.push(promise);
            
        }
    }
    await Promise.all(promises);
    let subProjectHtml = '';
    for (let key in locsHtmls) {
        subProjectHtml += locsHtmls[key];
    }
    return subProjectHtml;
}

const reordersubProjectLocations = function(locations){
    const orderedlocationsInSubProjects = [];
    const subProjectApartments = [];
    const subProjectLocations = [];
    for(let key in locations)
    {
        if(locations[key].type === LocationType.APARTMENT)
        {
            subProjectApartments.push(locations[key]);
        }
        else if(locations[key].type === LocationType.BUILDINGLOCATION){
            subProjectLocations.push(locations[key]);
        }
    }
    subProjectApartments.sort(function(apt1,apt2){
            if (apt1.sequenceNo==null) {
                return compareByEntityId(apt1, apt2);
            }
            else{
                return (apt1.sequenceNo-apt2.sequenceNo);
            }
            
        });
    subProjectLocations.sort(function(loc1,loc2){
        if (loc1.sequenceNo==null) {
            return compareByEntityId(loc1, loc2);
        }
        else{
            return (loc1.sequenceNo-loc2.sequenceNo);
        }
                });
    orderedlocationsInSubProjects.push(...subProjectApartments);
    orderedlocationsInSubProjects.push(...subProjectLocations);
    return orderedlocationsInSubProjects;
}

module.exports = {generateReportForSubProject,generateDocReportForSubProject};