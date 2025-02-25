
  "use strict";
  const { generatePdfFile } = require("./generatePdfFile");
  const ReportGeneration = require("./reportstrategy/reportGeneration.js")
  const SingleProjectReportGeneration = require("./reportstrategy/singleProjectReportGeneration.js")
  const projects = require("../model/project");
  const DocxMerger = require("docx-merger");
  
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  var fsp = require('fs/promises');
  const projectReports = require("../model/projectReports");
  const mongo = require('../database/mongo');
  const users = require("../model/user.js");
  const emailService = require("../service/emailService.js");
  var tenantService = require('../service/tenantService');
  const ProjectReportType = require("../model/projectReportType.js");
  const { WebPubSubServiceClient } = require('@azure/web-pubsub');
   
  const args = process.argv.slice(2);
  
  process.on('message', async (message) => {
    if (message.action === 'createDoc') {
      // Call a function in the child process
      await mongo.Connect();
      createDocument(args[0],args[1],args[2],args[3],args[4],args[5],args[6],args[7],args[8],args[9],args[10]);
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
            project_id:projectId,
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
          broadcastMessageToHub(projectName);

          process.send({ response: 'report created successfully' });  
      }
          
}

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

  const generateProjectReport = async function generate(projectId,sectionImageProperties,companyName,reportType,
      reportFormat, fileName)
  {
      console.time('generateprojectreport');
  
  
      try{
  
          const project  = await projects.getProjectById(projectId);
          
          // const fileName = project.data.item.name.split(' ').join('_') + "_"+ reportType;
          if (reportFormat==='pdf') {
              const projectHtml =  await getProjectHtml(project, sectionImageProperties, reportType);
              const path = await generatePdfFile(fileName,projectHtml,companyName);
              // callback( path);
          }else{
              
              var projectDocxList=  await getProjectDoc(project, sectionImageProperties,companyName, reportType,reportFormat);
              var fileList=[];
              //var headerPath = projectDocxList.shift();              
              projectDocxList.forEach(reportChunk => {
                  if (reportChunk!==undefined) {
                      try {
                        fileList.push(fs.readFileSync(reportChunk, 'binary'));
                      } catch (error) {
                        console.log("Error in reading file: "+reportChunk);
                        console.log(error);
                      }
                      
                  }
                  
              });              
              //unlink all
              
              // projectDocxList.forEach(filechunk=>{
              //     if (fs.existsSync(filechunk)) {
              //         fs.unlinkSync(filechunk);
              //     }              
              // });  
              var docx = new DocxMerger({},fileList);
             // const transientPath = path.resolve(`${fileName}_transient.${reportFormat}`);
              const absolutePath = path.resolve(`${fileName}.${reportFormat}`);
              //console.log(transientPath);
              docx.save('nodebuffer', async function (data) {
                  
                  console.log('inside document save');
                  await fsp.writeFile(absolutePath, data);       
                  //recreateFile(transientPath,headerPath,fileName,reportFormat) ;   
              });
              
              
          }
          
      }
      catch(err){
          console.log(err);
          
          // callback("");
      }
      console.timeEnd('generateprojectreport');
      
  };
  
  async function recreateFile(transientPath,headerPath,fileName,reportFormat){
    fs.copyFileSync(headerPath,'/Users/abhinovpankaj/Development/Projects/deckinspectorfunctionApp/src/projectreportfiles/projectheader.docx');
    console.log(headerPath);
    var headerBinary = fs.readFileSync('/Users/abhinovpankaj/Development/Projects/deckinspectorfunctionApp/src/projectreportfiles/projectheader.docx', 'binary');
    var transientBinary = fs.readFileSync(transientPath, 'binary');
    try {
      var newdocx = new DocxMerger({pageBreak:true},[headerBinary,transientBinary]);
      newdocx.save('nodebuffer', async function (data) {
          const absolutePath = path.resolve(`${fileName}.${reportFormat}`);
          console.log(absolutePath);
          console.log('inside internal document save');
          await fsp.writeFile(absolutePath, data);
          //fs.unlink(transientPath);
      }); 
    } catch (error) {
      console.log(error);
    }  
  }
  async function getProjectDoc(project, sectionImageProperties,companyName, reportType,reportFormat='pdf') {
      if (project.data.item.projecttype === "singlelevel") {
         return await SingleProjectReportGeneration.generateReportDoc(project,companyName, sectionImageProperties, reportType);
      }
      else if (project.data.item.projecttype  === "multilevel") {
         return await ReportGeneration.generateReportDoc(project,companyName, sectionImageProperties, reportType);
      }
  };
  
  async function getProjectHtml(project, sectionImageProperties, reportType) {
      if (project.data.item.projecttype === "singlelevel") {
         return await SingleProjectReportGeneration.generateReportHtml(project, sectionImageProperties, reportType);
      }
      else if (project.data.item.projecttype  === "multilevel") {
         return await ReportGeneration.generateReportHtml(project, sectionImageProperties, reportType);
      }
  };
  
  module.exports = { generateProjectReport,getProjectHtml};
  
  
  
