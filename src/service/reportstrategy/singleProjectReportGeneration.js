const {generateReportForSubProject} = require("../subprojectreportgeneration.js");
const {generateReportForLocation} = require("../sectionParts/util/locationGeneration/locationreportgeneration.js")
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const ProjectReportType = require("../../model/projectReportType.js");
const filePath = path.join(__dirname, 'projectfile.ejs');
const template = fs.readFileSync(filePath, 'utf8');
const SectionPartProcessExecutorFactoryForSingleLevelProject = require("../sectionParts/sectionPartProcessExecutorFactoryForSingleLevelProject.js");

function getEntityId(entity) {
    return entity?.id ?? entity?._id;
}
//TODO UMESH Refactoring required
class SingleProjectReportGeneration{
    async generateReportHtml(project,sectionImageProperties,reportType){
        try{
            console.time("generateReportHtml");
            const promises = [];
            const secHtmls = []; 
            project.data.item.projectHeader = this.getProjectHeader(reportType);
            let projectHtml = ejs.render(template, project.data.item);
            const sections = project.data.item.sections;
            const newSections = sections.filter(section => this.isSectionIncluded(reportType, sections));
            for (let key in newSections) {
                const sectionId = getEntityId(newSections[key]);
                const executor = SectionPartProcessExecutorFactoryForSingleLevelProject.getProcessExecutorChain(sectionId,sectionImageProperties,reportType);
                const promise = executor.executeProcess()   
                .then((secHtml) => {
                    secHtmls[key] = secHtml;
                });
              promises.push(promise);
            }
            await Promise.all(promises);
            const pageBreak = '<div style="page-break-before: always;"></div>';
            for (let key in secHtmls) {
                projectHtml += pageBreak;
                projectHtml += secHtmls[key];
            }
            console.timeEnd("generateReportHtml");
            return projectHtml;
        }
        catch(err){
            console.log(err);
        }
    }

   getProjectHeader(reportType){
        if(ProjectReportType.VISUALREPORT === reportType)
        {
            return "Visual Inspection Report";
        }
        else if(ProjectReportType.INVASIVEONLY === reportType)
        {
            return "Invasive only Project Report";
        }
        else if(ProjectReportType.INVASIVEVISUAL === reportType)
        {   
            return "Invasive Project Report";
        }
     }

     isSectionIncluded  (reportType, section) {
        if (reportType === ProjectReportType.INVASIVEONLY || reportType === ProjectReportType.INVASIVEVISUAL) {
          return section.furtherinvasivereviewrequired === true;
        } else if (reportType === ProjectReportType.VISUALREPORT) {
          return true;
        }
      }
     
}



module.exports = new SingleProjectReportGeneration();