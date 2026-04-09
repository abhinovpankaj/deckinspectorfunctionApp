"use strict";
var express = require('express');
var router = express.Router();
const projects = require("../model/project");
const ErrorResponse = require('../model/error');
const newErrorResponse = require('../model/newError');
const path = require('path');
const fs = require('fs'); 
var mime = require('mime-types')
var fsp = require('fs/promises');
const {generateProjectReport,getProjectHtml}= require('../service/projectreportgeneration.js');
const {getProjectHierarchyMetadata,getSingleProjectMetadata} = require('../service/projectmetadata/getProjectMetaData.js');
const {generateExcelForProject} = require('../service/generateExcelForProject.js');
const projectService = require('../service/projectService');
require("dotenv").config();
const multer = require('multer');
const upload = multer({ dest: path.join(__dirname, '..') });
const {v4 : uuidv4} = require('uuid');
var uploadBlob = require('../database/uploadimage');
const projectReports = require("../model/projectReports");
const WebSocket = require('ws');
const { WebPubSubServiceClient } = require('@azure/web-pubsub');
const users = require("../model/user.js");
const emailService = require("../service/emailService.js");
var tenantService = require('../service/tenantService');
const ProjectReportType = require("../model/projectReportType.js");
const { saveDocReportForLocation } = require('../service/sectionParts/util/locationGeneration/locationreportgeneration.js');
const { fork } = require('child_process');
router.route('/add')
.post(async function (req, res) {
  try {
    // Get user input
    const { name, description, address, createdBy, url, assignedTo, projecttype } = req.body;

    // Validate user input
    if (!name) {
      const errResponse = new ErrorResponse(400, "Name is required", "");
      res.status(400).json(errResponse);
      return;
    }

    // Create a new project object
    var newProject = {
      "name": name,
      "description": description,
      "address": address,
      "createdby": createdBy,
      "url": url,
      "lasteditedby": createdBy,
      "assignedto": assignedTo,
      "editedat": new Date().toISOString(),
      "children": [],
      "projecttype": projecttype,
      "createdat": new Date().toISOString(),
      "iscomplete":false,
      "isInvasive":false
    }

    // Save the new project to the database
    var result = await projectService.addProject(newProject);
    
    if (result.reason) {
      return res.status(result.code).json(result);
    }
    if (result) {
      //console.debug(result);
      return res.status(201).json(result);
    }
  }
  catch (exception) {
    const errResponse = new newErrorResponse(500, false, exception);
    return res.status(500).json(errResponse);
  }
});

router.route('/allprojects')
  .get(async function (req, res) {
    try {
      var errResponse;
      var result = await projectService.getAllProjects();
      if (result.reason) {
        return res.status(result.code).json(result);
      }
      if (result) {
        //console.debug(result);
        return res.status(201).json(result);
      }
    }
    catch (exception) {
      errResponse = new newErrorResponse(500, false, exception);
      return res.status(500).json(errResponse);
    }
  });

router.route('/filterprojects')
  .post(async function (req, res) {
    try {
      var errResponse;
      const { name, isdeleted, iscomplete, createdon } = req.body;

      var result = await projectService.getProjectsByNameCreatedOnIsCompletedAndDeleted({ name, isdeleted, iscomplete, createdon });
      if (result.reason) {
        return res.status(result.code).json(result);
      }
      if (result) {
        return res.status(201).json(result);
      }
    }
    catch (exception) {
      errResponse = new newErrorResponse(500, false, exception);
      return res.status(500).json(errResponse);
    }
  });

  
router.route('/getProjectById')
  .post(async function (req, res) {
    try {
      var errResponse;
      const projectId = req.body.projectid;
      var result = await projectService.getProjectById(projectId);
      if (result.reason) {
        return res.status(result.code).json(result);
      }
      if (result) {
        //console.debug(result);
        return res.status(201).json(result);
      }
    }
    catch {
      errResponse = new newErrorResponse(500, false, exception);
      return  res.status(500).json(errResponse);
    }
  })

//UMESH todo: to refactor this
router.route('/generateexcel')
  .post(async function (req, res) {
    try {
      const projectId = req.body.projectid;
      //Umesh TODO: to move this into ProjectService class
      const fullexcelPath = await generateExcelForProject(projectId);

      // Set headers and status
      console.log(fullexcelPath);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=' + path.basename(fullexcelPath)); 
      res.sendFile(fullexcelPath, {}, (err) => {
        if (err) {
          console.error('Error sending file:', err);
        } else {
          console.log('excel sent successfully');
          fs.unlinkSync(fullexcelPath);
        }
      });
    } catch (err) {
      console.error('Error generating Excel:', err);
      return res.status(500).send('Error generating Excel');
    }
  });

  router.route('/:id')
  .put(async function (req, res) {
    try {
      var errResponse;
      const newData = req.body;
      const projectId = req.params.id;
      // Validate user input
      var result = await projectService.editProject(projectId,newData);
      if (result.reason) {
        return res.status(result.code).json(result);
      }
      if (result) {
        //console.debug(result);
        return res.status(201).json(result);
      }
    }
    catch (exception) {
      errResponse = new newErrorResponse(500, false, exception);
      return res.status(500).json(errResponse);
    }
  })
  .delete(async function (req, res) {
    try {
      var errResponse;
      const projectId = req.params.id;
      var result = await projectService.deleteProjectPermanently(projectId);
      if (result.reason) {
        return res.status(result.code).json(result);
      }
      if (result) {
        //console.debug(result);
        return res.status(201).json(result);
      }
    }
    catch (exception) {
      errResponse = new newErrorResponse(500, false, exception);
      return res.status(500).json(errResponse);
    }
  });

router.route('/:id/assign')
  .post(async function (req, res) {
    try {
      var errResponse;
      const projectId = req.params.id;
      const { username } = req.body;
      var result = await projectService.assignProjectToUser(projectId, username); 
      if (result.reason) {
        return res.status(result.code).json(result);
      }
      if (result) {
        return res.status(201).json(result);
      }
    }
    catch (exception) {
      errResponse = new newErrorResponse(500, false, exception);
      return res.status(500).json(errResponse);
    }
  });

//Umesh TODO to rewmove this
// router.route('/:id/toggleOfflineState/:state')
//   .post(async function (req, res) {
//     try {
//       var errResponse;
//       const projectId = req.params.id;
//       const state = req.params.state;
//       const isavailableoffline = state == 1 ? true : false;
//       var result = await projects.updateProjectOfflineAvailabilityStatus(projectId, isavailableoffline);
//       if (result.error) {
//         res.status(result.error.code).json(result.error);
//       }
//       if (result.data) {
//         //console.debug(result);                                          
//         res.status(result.data.code).json(result.data);
//       }
//     } catch (error) {
//       errResponse = new ErrorResponse(500, "Internal server error", error);
//       res.status(500).json(errResponse);
//     }
//   });

router.route('/:id/unassign')
  .post(async function (req, res) {
    try {
      var errResponse;
      const projectId = req.params.id;
      const { username } = req.body;
      var result = await projectService.unassignUserFromProject(projectId, username);
      if (result.reason) {
        return res.status(result.code).json(result);
      }
      if (result) {
        return res.status(201).json(result);
      }
    }
    catch (exception) {
      errResponse = new newErrorResponse(500, false, exception);
      return res.status(500).json(errResponse);
    }
  });


//TODO : Umesh to remove these API's after confirming with Rohit
// router.route('/:id/addchild')
//   .post(async function (req, res) {
//     try {
//       var errResponse;
//       const projectId = req.params.id;
//       const { id, name, type } = req.body;
//       var result = await projects.addRemoveChildren(projectId, true, { id, name, type });
//       if (result.error) {
//         res.status(result.error.code).json(result.error);
//       }
//       if (result.data) {
//         //console.debug(result);                                          
//         res.status(result.data.code).json(result.data);
//       }
//     } catch (error) {
//       //res.status(500).send("Internal server error.");
//       errResponse = new ErrorResponse(500, "Internal server error", error);
//       res.status(500).json(errResponse);
//     }
//   });

// router.route('/:id/removechild')
//   .post(async function (req, res) {
//     try {
//       var errResponse;
//       const projectId = req.params.id;
//       const { id, name, type } = req.body;
//       var result = await projects.addRemoveChildren(projectId, false, { id, name, type });
//       if (result.error) {
//         res.status(result.error.code).json(result.error);
//       }
//       if (result.data) {
//         //console.debug(result);                                          
//         res.status(result.data.code).json(result.data);
//       }
//     } catch (error) {
//       errResponse = new ErrorResponse(500, "Internal server error", error);
//       res.status(500).json(errResponse);
//     }
//   });

router.route('/:id/toggleprojectstatus/:state')
  .post(async function (req, res) {
    try {
      var errResponse;
      const projectId = req.params.id;
      const state = req.params.state;
      const iscomplete = state == 1 ? true : false;
      var result = await projectService.toggleProjectstatus(projectId, iscomplete);
      if (result.reason) {
        return res.status(result.code).json(result);
      }
      if (result) {
        return res.status(201).json(result);
      }
    }
    catch (exception) {
      errResponse = new newErrorResponse(500, false, exception);
      return res.status(500).json(errResponse);
    }
  });

router.route('/getProjectsByUser/:username')
.get(async function(req,res){
  try{
    var errResponse;
    const username = req.params.username;
    var result = await projectService.getProjectByAssignedToUserId(username);
    if (result.reason) {
      return res.status(result.code).json(result);
    }
    if (result) {
      return res.status(201).json(result);
    }
  }
  catch (exception) {
    errResponse = new newErrorResponse(500, false, exception);
    return res.status(500).json(errResponse);
  }
})

//Umesh TODO: To refactor this entire thing
router.route('/getProjectsMetaDataByUserName/:username')
.get(async function(req,res){
  try{
    var errResponse;
    const username = req.params.username;
    var result = await getProjectHierarchyMetadata(username);
    if (result.error) {
      return res.status(result.error.code).json(result.error);
    }
    if (result.data) {
      return res.status(201).json(result.data);
    }
  }catch(error)
  {
    console.log(error);
    errResponse = new ErrorResponse(500, "Internal server error", error);
    return res.status(500).json(errResponse);
  }
});

//Umesh TODO: To refactor this entire thing
router.route('/getProjectMetadata/:id')
.get(async function(req,res){
  try{
    var errResponse;
    const projectId = req.params.id;
    var result = await getSingleProjectMetadata(projectId);
    if (result.error) {
      return res.status(result.error.code).json(result.error);
    }
    if (result.data) {
      return res.status(201).json(result.data);
    }
  }catch(error)
  {
    console.log(error);
    errResponse = new ErrorResponse(500, "Internal server error", error);
    return res.status(500).json(errResponse);
  }
});


/** UMESH TODO  -- REFACTOR this code 
 *  Add request Validation
 * */
router.route('/generatereport')
.post(async function (req, res) {
          
  const hostname = req.headers.host; 
  const companyIdentifier = req.user.company;
    try{
        const outputDir = path.join("projectreportfiles");
            if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
            }
            var projectReportId;
            const projectId = req.body.id;
            const sectionImageProperties = req.body.sectionImageProperties;
            const companyName = req.user.company;
            const reportType = req.body.reportType;
            const reportFormat = req.body.reportFormat;
            // const requestType = req.body.requestType;
            // const reportId = uuidv4();
            // console.log(`reportID: ${reportId}`);
            const projectName = req.body.projectName.replace(/[^\w\s]/g, '');
            
            const uploader = req.body.user;
        // const docpath = `${projectName}_${reportType}_${reportId}`;
        
            const now = new Date();
            
            const docpath = path.join(outputDir,`${projectName}_${reportType}`);
            
            let project_id = projectId;
            let name = projectName;
            
            let reporttimestamp = (new Date(Date.now())).toISOString();
            
            //check if report is already in progress
            var isReportInProgress = await projectReports.isProjectReportinProgress(project_id,reportType);
            if (isReportInProgress) {
              
              return res.status(200).send('Report generation already in progress.');
              broadcastMessageToHub(projectName,false);
              
            }
            projectReports.addProjectReport({
            project_id,
            name,
            url:"",
            reportType,
            isReportInProgress:true,
            uploader,
            timestamp:reporttimestamp
            },function(err,result){
                if (err) { 
                    console.log(err)
                    res.status(500).send('Error Generating report');
                    return;
                }
                if (result){
                    if (result._id===undefined) {
                        projectReportId = result.insertedId;
                    }else{
                        projectReportId = result._id;
                    }
                    //createDocument(companyIdentifier,hostname,projectId,sectionImageProperties,companyName,reportType, reportFormat, docpath,uploader,projectReportId,projectName)                
                    // Fork a child process
                    const child = fork('src/service/forkedchild.js',[companyIdentifier,hostname,projectId,sectionImageProperties,companyName,reportType, reportFormat, docpath,uploader,projectReportId,projectName]);

                    // Send a message to the child process
                    child.send({ action: 'createDoc' });

                    // Listen for messages from the child process
                    child.on('message', (message) => {
                      console.log('Message from child:', message);
                      child.kill();
                    });
                    console.log(result)
                }
            });

            res.status(200).send('Generating report');
            
            
        } catch (err) {
            console.error('Error generating Report:', err);
        //return res.status(500).send('Error generating Report');
        }
    });

  async function createDocument (companyIdentifier,hostname,projectId,sectionImageProperties,companyName,reportType, reportFormat, 
    docpath,uploader,projectReportId,projectName){
      
        
    await generateProjectReport(projectId,sectionImageProperties,companyName,reportType, reportFormat, docpath);
    
    const absolutePath = path.resolve(`${docpath}.${reportFormat}`);

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
    console.log(absolutePath);
    //const containerName = projectName;
    const uploadOptions = {
    metadata: {
        'uploader': uploader,
      },
      tags: {
          'projectId': projectId,
          'owner': uploader
      }
    };
    //const newContainerName = containerName.replace(/\s+/g, '').toLowerCase();
    const fileName = `${projectName}_${reportType}_${timestamp}.${reportFormat}`;
    const newfileName = fileName.replace(/\s+/g, '').toLowerCase();
    //here we will save the file on server.
    //var result = await uploadBlob.uploadFile(newContainerName, newfileName, absolutePath, uploadOptions);
    
    //http://localhost:7071/api/downloadReport?name=Tiara Del Pacifica Homeowners Asssociation&type=Visual&format=docx
    const fileUrl = (`https://${hostname}/api/projectreports/download/Report?name=${encodeURIComponent(projectName)}&type=${reportType}&format=${reportFormat}`);
    console.log(fileUrl);

    var result=  (`{"message":"${fileName} succeeded","url":"${fileUrl}"}`);
    
    var response = JSON.parse(result);
    if (response.error) {
        //responseError = new ErrorResponse(500, 'Internal server error', result.error);
        console.log(response);
        // res.status(500).json(responseError);
        return;
    }
    if (response.message) {
        
        //fs.unlinkSync(absolutePath);
        //Update images Url
        let url = response.url;
        //update report
        projectReports.updateProjectReport({
            _id:projectReportId,
            projectId,
            fileName,                   
            url,
            isReportInProgress:false                   
            },function(err,result){
                if (err) { 
                    console.log(err)
                }
                if (result){
                    console.log(result)
                }
            });
        // console.log(projectId);
        // console.log('report uploaded');
        
        try{
          const reportFileStats = fs.statSync(absolutePath);
          const reportFileSize = reportFileStats.size;
          
          
          const result = tenantService.editTenant(companyIdentifier, reportFileSize);
          if (result.reason){
            console.log(result);
          }
          //update size in tenant
        }
        catch(ex){
          console.log(`Exception: ${ex}`);
        }
        //send email.
        var emailId = await users.getEmailIdByUserName(uploader);
        await emailService.sendEmail(`${projectName}'s ${reportType} report is ready`,emailId,
        `Hi,
          The ${reportType} report for Project ${projectName} is ready. Please download it from the reports sections or click on the below url.
          ${url.replaceAll(' ','%20')}`);
          //broadcastMessageToHub(projectName);
      }
          
}
router.route('/downloadReport')
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
//server to client communication.

router.route('/generatereporthtml').post(async function (req, res) {
  try {
    const projectId = req.body.id;
    const sectionImageProperties = req.body.sectionImageProperties;
    const reportType = req.body.reportType;
    const project  = await projects.getProjectById(projectId);
    const htmlContent = await getProjectHtml(project, sectionImageProperties, reportType);
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (err) {
    console.error('Error generating HTML:', err);
    return res.status(500).send('Error generating HTML');
  }
});

router.route('/finalreport')
.post(async function (req, res){
  try{
    const {companyName} = req.body;
    const absolutePath = path.join(__dirname, '..', (companyName === 'Wicr')? 'WICR_FinalTemplate.docx' :'Deck_FinalTemplate.docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.sendFile(absolutePath, {}, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          return res.status(500).send('Error sending file');
        } else {
          console.log('Report sent successfully');
        }
      }); 

  } catch(err){
    console.error('Error generating final report: ', err);
    return res.status(500).send('Error generating final report');
  }
})

router.route('/replacefinalreporttemplate')
.post(upload.single('file'), async function (req, res){
  try{
    console.log("started upload");
    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const {companyName} = req.body;

    if (!companyName) {
      return res.status(400).json({ message: 'Company name is missing.' });
    }

    const existingFileName = (companyName === 'Wicr')? 'WICR_FinalTemplate.docx' :'Deck_FinalTemplate.docx';
    const filePath = path.join(__dirname, '..', existingFileName);

      // Check if the file to be replaced exists
      if (fs.existsSync(filePath)) {
        // Delete the existing file
        fs.unlinkSync(filePath);
      }

    //Rename the uploaded file
    fs.renameSync(uploadedFile.path, filePath);
    res.status(200).json({ message: 'File replaced successfully.' });
  } catch(err){
    console.error('Error replacing final report template: ', err);
    return res.status(500).send('Error replacing final report template');
  }
})

async function broadcastMessageToHub(projectName, isReady=true){
  try {
    const hubName = 'reportnotificationhub';
  const serviceClient = new WebPubSubServiceClient(process.env.WebPubSubConnectionString, hubName);
  // Send a JSON message
  if (isReady) {
    await serviceClient.sendToAll({ message: `Report for project: ${projectName} is ready, please visit reports sections to download.` });
  }else{
    await serviceClient.sendToAll({ message: `Report for project: ${projectName} is still generating, please wait...` });
  }
  } catch (error) {
    console.log(error);
  }
}

module.exports = router;
