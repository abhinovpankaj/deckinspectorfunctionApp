"use strict";
var express = require('express');
var router = express.Router();

var path = require('path');
const projectReports = require("../model/projectReports");
var jwt = require('jsonwebtoken');
const Role=require('../model/role');
const ProjectReportType = require("../model/projectReportType.js");
const { saveDocReportForLocation } = require('../service/sectionParts/util/locationGeneration/locationreportgeneration.js');
require("dotenv").config();

router.route('/add')
.post( function(req, res)  {  
try {
    // Get document input
    const { project_id, name, url, uploader } = req.body;
    var timestamp = (new Date(Date.now())).toISOString();
    // Validate document input
    if (!(project_id && name && url)) {
      res.status(400).send("All input is required");
    }
 
    // Create document in our database
    projectReports.addProjectReport({
        project_id,
        name,
        url,
        uploader,
        timestamp
    },function(err,result){
        if (err) { 
            res.status(err.status).send(err.message); 
        }
        if (result){
            res.status(201).json(result);
        }
    });
    
  }catch (err) {
    console.log(err);
  }
  
});

router.route('/:project_id')
.get(async function(req,res){
  try{
    const project_id = req.params.project_id;
    projectReports.getProjectReportsbyProjectId(project_id ,async function(err,records){
      if (err) { res.status(err.status).send(err.message); 
      }
      else {
          if (records){
            res.status(200).json(records); 
          }                     
            else
              res.status(401).send("reports not found.");
      }
  });    
  }
  catch{
    res.status(500).send("Internal server error.");
  }
});

router.route('/delete')
.post(async function(req,res){
  try {
      // Get user input
      const document = req.body; 
      projectReports.removeReport(document._id,function(err,result){
        if(err){
          res.status(err.status).send(err.message);
        }
        else{
          res.status(result.status).send(result.message);      
        }
      })          
      
     }     
  catch (err) {    
    console.log(err);
    res.status(500).send(`Internal server error ${err}`)
  }
});
router.route('/download/Report')
    .get(async function(req,res){   
      console.log('sending report file... ');
      const requestQueryParams = req.query; 

// get target_site_id from the request query parameters
      
      //const parsedData = await req.json();
      const reportType = requestQueryParams.type;
      const reportFormat = requestQueryParams.format;
      let projectName = requestQueryParams.name;
      projectName = projectName.replaceAll('%20',' ');
      const attachmentName = `${projectName}_${reportType}.${reportFormat}`;
      const reportFileName = path.join('projectreportfiles',`${projectName}_${reportType}.${reportFormat}`);
  try {
      // const fileData = await fsp.readFile(reportFileName);
      // var contentType = mime.lookup(reportFileName);
      res.download(reportFileName, attachmentName, (err) => {
        if (err) {
          console.log(err);
          //publish message
        } else {
          //publish succes message
        }
      });
  } catch (error) {
    console.error('Error generating Report:', error);
    res.status(500).send({message:`Error while reading data ${error}`});
  }  
});
router.route('/locationupdated')
.post(async function(req,res){
  try {
    var locationId = req.body.locationId;
    var subProjectName = req.body.subProjectName
    
    res.status(200).send('Generating location report');
    
    await saveDocReportForLocation(locationId,ProjectReportType.VISUALREPORT,subProjectName);
    await saveDocReportForLocation(locationId,ProjectReportType.INVASIVEVISUAL,subProjectName);
    await saveDocReportForLocation(locationId,ProjectReportType.INVASIVEONLY, subProjectName);
  } catch (error) {
    console.log(error);
    res.status(500).send('failed, but has no impact.');
  }
})
module.exports = router ;