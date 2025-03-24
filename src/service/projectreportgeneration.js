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
            projectDocxList.forEach(reportChunk => {
                if (reportChunk!==undefined) {
                    fileList.push(fs.readFileSync(reportChunk, 'binary'));
                }
                
            });
            //unlink all
            
            // projectDocxList.forEach(filechunk=>{
            //     if (fs.existsSync(filechunk)) {
            //         fs.unlinkSync(filechunk);
            //     }              
            // });


            var docx = new DocxMerger({},fileList);
            // const outputDir = "projectreportfiles";
            // if (!fs.existsSync(outputDir)) {
            // fs.mkdirSync(outputDir);
            // }
            //const docFilePath = path.join(outputDir,`${fileName}.docx`);
            docx.save('nodebuffer', async function (data) {
                const absolutePath = path.resolve(`${fileName}.${reportFormat}`);
                console.log(absolutePath);
                console.log('inside document save');
                  await fsp.writeFile(absolutePath, data);
                //  callback(docFilePath);     
            });         
        }
        
    }
    catch(err){
        console.log(err);
        // callback("");
    }
    console.timeEnd('generateprojectreport');
    
};

async function getProjectDoc(project, sectionImageProperties,companyName, reportType,reportFormat='pdf') {
    // if (project.data.item.projecttype === "singlelevel") {
    //    return await SingleProjectReportGeneration.generateReportDoc(project,companyName, sectionImageProperties, reportType);
    // }
    // else if (project.data.item.projecttype  === "multilevel") {
       return await ReportGeneration.generateReportDoc(project,companyName, sectionImageProperties, reportType);
    // }
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


