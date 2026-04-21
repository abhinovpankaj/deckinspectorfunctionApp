const locations = require("../../../../model/location");
const sections = require("../../../../model/sections.js")
const SectionPartProcessExecutorFactory = require("../../sectionPartProcessExecutorFactory.js");
const projectReportType = require("../../../../model/projectReportType.js");
const docxTemplate = require('docx-templates');
const path = require('path');
const fs = require('fs');
const ProjectReportType = require("../../../../model/projectReportType.js");
const invasiveSections  = require("../../../../model/invasiveSections");
const conclusiveSections  = require("../../../../model/conclusiveSections");
const blobManager = require("../../../../database/uploadimage");
const jo = require('jpeg-autorotate');
const os = require('os');

function getSectionId(section) {
  return section?.id ?? section?._id;
}

function compareBySectionId(section1, section2) {
  const sectionId1 = getSectionId(section1);
  const sectionId2 = getSectionId(section2);
  const sectionId1Number = Number(sectionId1);
  const sectionId2Number = Number(sectionId2);

  if (Number.isFinite(sectionId1Number) && Number.isFinite(sectionId2Number)) {
    return sectionId1Number - sectionId2Number;
  }

  return String(sectionId1 ?? '').localeCompare(String(sectionId2 ?? ''));
}

const generateDocReportForLocation = async function (locationId,companyName, sectionImageProperties, reportType,formId,subprojectName='') {
  try {
    const sectionDataDoc =
    [];
    //console.log(__dirname);
    const location = await locations.getLocationById(locationId);
    
    if (!location.data) {
      return "";
    } else {
      var mysections = location.data.item.sections;
          
    if(!mysections)
    {
      return "";
    }
    const newSections = mysections.filter(section =>  isSectionIncluded(reportType, section));
    newSections.sort(function(section1,section2){
    if (section1.isInvasive && !section2.isInvasive) {
        return -1; // subProj1 comes before subProj2
    } else if (!section1.isInvasive && section2.isInvasive) {
        return 1; 
    } else{
      if (section1.sequenceNo==null) {
        return compareBySectionId(section1, section2);
      }else{
        return (section1.sequenceNo-section2.sequenceNo);
      }         
    } 
  });
    
    var locationType='';
    if( location.data.item.type==='buildinglocation'){
        locationType = "Building Common"
    }
    if( location.data.item.type==='apartment'){
      locationType = "Apartment"
    }
    if( location.data.item.type==='projectlocation'){
      locationType = "Project Common"
    }
    var template;
    
    if (formId==null) {
      if (subprojectName=='') {
        template = fs.readFileSync(path.join(__dirname,'Deck2AllData.docx'));
      }else{
        template = fs.readFileSync(path.join(__dirname,'DeckAllData.docx'));
      }
    }else{
      if (subprojectName=='') {
        template = fs.readFileSync(path.join(__dirname,'Deck2AllData_Generic.docx'));
      }else{
        template = fs.readFileSync(path.join(__dirname,'DeckAllData_Generic.docx'));
      }
    }
    
    
      if (reportType === projectReportType.INVASIVEONLY || reportType === projectReportType.INVASIVEVISUAL) {
        if (location.data.item.isInvasive && location.data.item.isInvasive === true) {
          await Promise.all(newSections.map(async (section, index) => {
            // check if doct is created
            
            const filePath = path.join("sectionfiles",locationId.toString(),`${getSectionId(section)}_${reportType}.docx`);
            if (isLocationFileExists(filePath)) {
              sectionDataDoc.push(filePath);
            }else{
              const sectionData =  await sections.getSectionById(getSectionId(section));
              const invasiveSectionData = await invasiveSections.getInvasiveSectionByParentId(getSectionId(section));
              const conclusiveSectionData = await conclusiveSections.getConclusiveSectionByParentId(getSectionId(section));
              if(sectionData.data && sectionData.data.item)
              {
                var sectionDocValues;
  
                if (reportType===ProjectReportType.INVASIVEONLY ) {
                  if (invasiveSectionData.data && invasiveSectionData.data.item) {
                    
                    if (conclusiveSectionData.data && conclusiveSectionData.data.item) {
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',
                        invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : invasiveSectionData.data.item.invasiveimages,
                        conclusiveImages : conclusiveSectionData.data.item.conclusiveimages,
                        propowneragreed:conclusiveSectionData.data.item.propowneragreed?'true':'false',
                        conclusiveadditionalconsiderations:conclusiveSectionData.data.item.conclusiveconsiderations,
                        conclusiveeee:conclusiveSectionData.data.item.eeeconclusive,
                        conclusivelbc:conclusiveSectionData.data.item.lbcconclusive,
                        conclusiveawe:conclusiveSectionData.data.item.aweconclusive,
                        invasiverepairsinspectedandcompleted:conclusiveSectionData.data.item.invasiverepairsinspectedandcompleted?'true':'false',
                        };
                    }else{
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',
                        invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : invasiveSectionData.data.item.invasiveimages,   
                        invasiverepairsinspectedandcompleted:false
                        };
                    }
                    var filename = await getLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues,reportType) ;
                    sectionDataDoc[index]= filename;  
                    }
                  }else{
                    if (invasiveSectionData.data && invasiveSectionData.data.item) {
                      if (conclusiveSectionData.data && conclusiveSectionData.data.item) {
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                        waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                        visualreview:sectionData.data.item.visualreview,
                        signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                        furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                        conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                        additionalconsiderations:sectionData.data.item.additionalconsiderations,
                        eee:sectionData.data.item.eee,
                        lbc:sectionData.data.item.lbc,
                        awe:sectionData.data.item.awe,
                        images:sectionData.data.item.images,                      
                        invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : invasiveSectionData.data.item.invasiveimages,     
                        furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',                   
                        conclusiveImages : conclusiveSectionData.data.item.conclusiveimages,
                        propowneragreed:conclusiveSectionData.data.item.propowneragreed?'true':'false',
                        conclusiveadditionalconsiderations:conclusiveSectionData.data.item.conclusiveconsiderations,
                        conclusiveeee:conclusiveSectionData.data.item.eeeconclusive,
                        conclusivelbc:conclusiveSectionData.data.item.lbcconclusive,
                        conclusiveawe:conclusiveSectionData.data.item.aweconclusive,
                        invasiverepairsinspectedandcompleted:conclusiveSectionData.data.item.invasiverepairsinspectedandcompleted?'true':'false',
                        };
                      }else{
                        sectionDocValues = {
                          isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                          reportType : reportType,
                          buildingName: subprojectName,
                          parentType: locationType,
                          parentName: location.data.item.name,
                          name: sectionData.data.item.name,
                          exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                          waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                          visualreview:sectionData.data.item.visualreview,
                          signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                          furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                          conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                          additionalconsiderations:sectionData.data.item.additionalconsiderations,
                          eee:sectionData.data.item.eee,
                          lbc:sectionData.data.item.lbc,
                          awe:sectionData.data.item.awe,
                          images:sectionData.data.item.images,
                          furtherInvasiveRequired: false,
                          invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                          invasiveImages : invasiveSectionData.data.item.invasiveimages,                       
                          invasiverepairsinspectedandcompleted:'false'
                        };
                      }
                    }else{
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                        waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                        visualreview:sectionData.data.item.visualreview,
                        signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                        furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                        conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                        additionalconsiderations:sectionData.data.item.additionalconsiderations,
                        eee:sectionData.data.item.eee,
                        lbc:sectionData.data.item.lbc,
                        awe:sectionData.data.item.awe,
                        images:sectionData.data.item.images,
                        furtherInvasiveRequired: false,
                        invasiveDesc: 'Invasive inspection not done',//invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : [],//invasiveSectionData.data.item.invasiveimages,   
                        invasiverepairsinspectedandcompleted:false
                        };
                    }           
                    var filename = await getLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues,reportType) ;
                    sectionDataDoc.push(filename);  
                  
                }
                
              }
            }             
          }));
          return sectionDataDoc;
        }else{
          return "";
        }
      } else if (reportType === projectReportType.VISUALREPORT) {
          await Promise.all(newSections.map(async (section, index) => {    
          const filePath = path.join("sectionfiles",locationId.toString(),`${getSectionId(section)}_${reportType}.docx`);      
          if (isLocationFileExists(filePath)) {
            sectionDataDoc.push(filePath);
          } else{
            var sectionData;
            if (formId==null) {
               sectionData =  await sections.getSectionById(getSectionId(section));
            }else{
               sectionData =  await sections.getDynamicSectionById(getSectionId(section));
            }
                     
            if(sectionData.data && sectionData.data.item)
            {
            var sectionDocValues;
            
            if (sectionData.data.item.unitUnavailable) {
              sectionDocValues = {
                isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                reportType : reportType,
                buildingName: subprojectName,
                parentType: locationType,
                parentName: location.data.item.name,
                name: sectionData.data.item.name,                  
              };
            }else{
                if (formId==null) {
                  sectionDocValues = {
                  isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                  reportType : reportType,
                  buildingName: subprojectName,
                  parentType: locationType,
                  parentName: location.data.item.name,
                  name: sectionData.data.item.name,
                  exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                  waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                  visualreview:sectionData.data.item.visualreview,
                  signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                  furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                  conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                  additionalconsiderations:sectionData.data.item.additionalconsiderations,
                  //additionalconsiderationshtml:sectionData.data.item.additionalconsiderationshtml,
                  eee:sectionData.data.item.eee,
                  lbc:sectionData.data.item.lbc,
                  awe:sectionData.data.item.awe,
                  images:sectionData.data.item.images
                  
                  };
                }else{
                  sectionDocValues = {
                    isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                    reportType : reportType,
                    buildingName: subprojectName,
                    parentType: locationType,
                    parentName: location.data.item.name,
                    name: sectionData.data.item.name,                    
                  
                    furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                    
                    additionalconsiderations:sectionData.data.item.additionalconsiderations,
                    questions:sectionData.data.item.questions,
                    images:sectionData.data.item.images
                    
                  };
                }
              }   
              var filename = await getLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues,reportType) ;
              sectionDataDoc[index]=filename;
            }
          }         
        }));
        return sectionDataDoc;
      }
    }
  } catch (error) {
    console.log("Error is " + error);
    return "";
  }
}

const generateDocReportForSection = async function (mysections,locationId,isProjectInvasive,companyName, sectionImageProperties, reportType,formId,subprojectName='') {
  try {
    const sectionDataDoc =
    [];  
    
    if(!mysections)
    {
      return "";
    }
    const newSections = mysections.filter(section =>  isSectionIncluded(reportType, section));
    newSections.sort(function(section1,section2){
    if (section1.isInvasive && !section2.isInvasive) {
        return -1; // subProj1 comes before subProj2
    } else if (!section1.isInvasive && section2.isInvasive) {
        return 1; 
    } else{
      if (section1.sequenceNo==null) {
        return compareBySectionId(section1, section2);
      }else{
        return (section1.sequenceNo-section2.sequenceNo);
      }         
    } 
  });
    
    var locationType='Project Location';
    
    var template;
    
    if (formId==null) {
      if (subprojectName=='') {
        template = fs.readFileSync(path.join(__dirname,'Deck2AllData.docx'));
      }else{
        template = fs.readFileSync(path.join(__dirname,'DeckAllData.docx'));
      }
    }else{
      if (subprojectName=='') {
        template = fs.readFileSync(path.join(__dirname,'Deck2AllData_Generic.docx'));
      }else{
        template = fs.readFileSync(path.join(__dirname,'DeckAllData_Generic.docx'));
      }
    }
    
    
      if (reportType === projectReportType.INVASIVEONLY || reportType === projectReportType.INVASIVEVISUAL) {
        if (isProjectInvasive) {
          await Promise.all(newSections.map(async (section, index) => {
            // check if doct is created
            
            const filePath = path.join("sectionfiles",locationId.toString(),`${getSectionId(section)}_${reportType}.docx`);
            // if (isLocationFileExists(filePath)) {
            //   sectionDataDoc.push(filePath);
            // }else{
              const sectionData =  await sections.getSectionById(getSectionId(section));
              const invasiveSectionData = await invasiveSections.getInvasiveSectionByParentId(getSectionId(section));
              const conclusiveSectionData = await conclusiveSections.getConclusiveSectionByParentId(getSectionId(section));
              if(sectionData.data && sectionData.data.item)
              {
                var sectionDocValues;
  
                if (reportType===ProjectReportType.INVASIVEONLY ) {
                  if (invasiveSectionData.data && invasiveSectionData.data.item) {
                    
                    if (conclusiveSectionData.data && conclusiveSectionData.data.item) {
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',
                        invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : invasiveSectionData.data.item.invasiveimages,
                        conclusiveImages : conclusiveSectionData.data.item.conclusiveimages,
                        propowneragreed:conclusiveSectionData.data.item.propowneragreed?'true':'false',
                        additionalconsiderations:conclusiveSectionData.data.item.conclusiveconsiderations,
                        conclusiveeee:conclusiveSectionData.data.item.eeeconclusive,
                        conclusivelbc:conclusiveSectionData.data.item.lbcconclusive,
                        conclusiveawe:conclusiveSectionData.data.item.aweconclusive,
                        invasiverepairsinspectedandcompleted:conclusiveSectionData.data.item.invasiverepairsinspectedandcompleted?'true':'false',
                        };
                    }else{
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',
                        invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : invasiveSectionData.data.item.invasiveimages,   
                        invasiverepairsinspectedandcompleted:false
                        };
                    }
                    var filename = await getLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues,reportType) ;
                    sectionDataDoc[index]= filename;  
                    }
                  }else{
                    if (invasiveSectionData.data && invasiveSectionData.data.item) {
                      if (conclusiveSectionData.data && conclusiveSectionData.data.item) {
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                        waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                        visualreview:sectionData.data.item.visualreview,
                        signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                        furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                        conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                        additionalconsiderations:sectionData.data.item.additionalconsiderations,
                        eee:sectionData.data.item.eee,
                        lbc:sectionData.data.item.lbc,
                        awe:sectionData.data.item.awe,
                        images:sectionData.data.item.images,                      
                        invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : invasiveSectionData.data.item.invasiveimages,     
                        furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',                   
                        conclusiveImages : conclusiveSectionData.data.item.conclusiveimages,
                        propowneragreed:conclusiveSectionData.data.item.propowneragreed?'true':'false',
                        conclusiveadditionalconsiderations:conclusiveSectionData.data.item.conclusiveconsiderations,
                        conclusiveeee:conclusiveSectionData.data.item.eeeconclusive,
                        conclusivelbc:conclusiveSectionData.data.item.lbcconclusive,
                        conclusiveawe:conclusiveSectionData.data.item.aweconclusive,
                        invasiverepairsinspectedandcompleted:conclusiveSectionData.data.item.invasiverepairsinspectedandcompleted?'true':'false',
                        };
                      }else{
                        sectionDocValues = {
                          isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                          reportType : reportType,
                          buildingName: subprojectName,
                          parentType: locationType,
                          parentName: location.data.item.name,
                          name: sectionData.data.item.name,
                          exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                          waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                          visualreview:sectionData.data.item.visualreview,
                          signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                          furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                          conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                          additionalconsiderations:sectionData.data.item.additionalconsiderations,
                          eee:sectionData.data.item.eee,
                          lbc:sectionData.data.item.lbc,
                          awe:sectionData.data.item.awe,
                          images:sectionData.data.item.images,
                          furtherInvasiveRequired: false,
                          invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                          invasiveImages : invasiveSectionData.data.item.invasiveimages,                       
                          invasiverepairsinspectedandcompleted:'false'
                        };
                      }
                    }else{
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        //parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                        waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                        visualreview:sectionData.data.item.visualreview,
                        signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                        furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                        conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                        additionalconsiderations:sectionData.data.item.additionalconsiderations,
                        eee:sectionData.data.item.eee,
                        lbc:sectionData.data.item.lbc,
                        awe:sectionData.data.item.awe,
                        images:sectionData.data.item.images,
                        furtherInvasiveRequired: false,
                        invasiveDesc: 'Invasive inspection not done',//invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : [],//invasiveSectionData.data.item.invasiveimages,   
                        invasiverepairsinspectedandcompleted:false
                        };
                    }           
                    var filename = await getLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues,reportType) ;
                    sectionDataDoc.push(filename);  
                  
                }
                
              }
            //}             
          }));
          return sectionDataDoc;
        }else{
          return "";
        }
      } else if (reportType === projectReportType.VISUALREPORT) {
          await Promise.all(newSections.map(async (section, index) => {    
          const filePath = path.join("sectionfiles",locationId.toString(),`${getSectionId(section)}_${reportType}.docx`);      
          // if (isLocationFileExists(filePath)) {
          //   sectionDataDoc.push(filePath);
          // } else{
            var sectionData;
            if (formId==null) {
               sectionData =  await sections.getSectionById(getSectionId(section));
            }else{
               sectionData =  await sections.getDynamicSectionById(getSectionId(section));
            }
                     
            if(sectionData.data && sectionData.data.item)
            {
            var sectionDocValues;
            
            if (sectionData.data.item.unitUnavailable) {
              sectionDocValues = {
                isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                reportType : reportType,
                buildingName: subprojectName,
                parentType: locationType,
                //parentName: location.data.item.name,
                name: sectionData.data.item.name,                  
              };
            }else{
                if (formId==null) {
                  sectionDocValues = {
                  isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                  reportType : reportType,
                  buildingName: subprojectName,
                  parentType: locationType,
                  //parentName: location.data.item.name,
                  name: sectionData.data.item.name,
                  exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                  waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                  visualreview:sectionData.data.item.visualreview,
                  signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                  furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                  conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                  additionalconsiderations:sectionData.data.item.additionalconsiderations,
                  //additionalconsiderationshtml:sectionData.data.item.additionalconsiderationshtml,
                  eee:sectionData.data.item.eee,
                  lbc:sectionData.data.item.lbc,
                  awe:sectionData.data.item.awe,
                  images:sectionData.data.item.images
                  
                  };
                }else{
                  sectionDocValues = {
                    isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                    reportType : reportType,
                    buildingName: subprojectName,
                    parentType: locationType,
                    //parentName: location.data.item.name,
                    name: sectionData.data.item.name,                    
                  
                    furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                    
                    additionalconsiderations:sectionData.data.item.additionalconsiderations,
                    questions:sectionData.data.item.questions,
                    images:sectionData.data.item.images
                    
                  };
                }
              }   
              var filename = await getLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues,reportType) ;
              sectionDataDoc[index]=filename;
            }
         // }         
        }));
        return sectionDataDoc;
      }  
  } catch (error) {
    console.log("Error is " + error);
    return "";
  }
}

const saveDocReportForLocation = async function (locationId, reportType,subprojectName='') {
  try {
    const sectionDataDoc =
    [];
    let isDynamicForm = false;
    console.log('inside savedocfrlocation');
    const location = await locations.getLocationById(locationId);
    
    if (!location.data) {
      console.log('data not found for locationid');
      return "";
    } else {

      var locationType='';
      if( location.data.item.type==='buildinglocation'){
          locationType = "Building Common"
          
      }
      if( location.data.item.type==='apartment'){
        locationType = "Apartment"
        
      }
      if( location.data.item.type==='projectlocation'){
        
      }
      var template;
      
      if (subprojectName=='') {
        template = fs.readFileSync(path.join(__dirname,'Deck2AllData.docx'));
      }else{
        template = fs.readFileSync(path.join(__dirname,'DeckAllData.docx'));

      }
      
      if (reportType === projectReportType.INVASIVEONLY || reportType === projectReportType.INVASIVEVISUAL) {
        if (location.data.item.isInvasive && location.data.item.isInvasive === true) {
          var mysections = location.data.item.sections;
        
          if(!mysections)
          {
            return "";
          }
          const newSections = mysections.filter(section =>  isSectionIncluded(reportType, section));
          newSections.sort(function(section1,section2){
            
            if (section1.sequenceNo===null||section1.sequenceNo===undefined) {
                return compareBySectionId(section1, section2);
            }else{
                return (section1.sequenceNo-section2.sequenceNo);
            }
            
        });
          
          await Promise.all(newSections.map(async (section, index) => {
            const sectionData =  await sections.getSectionById(getSectionId(section));
            const invasiveSectionData = await invasiveSections.getInvasiveSectionByParentId(getSectionId(section));
            const conclusiveSectionData = await conclusiveSections.getConclusiveSectionByParentId(getSectionId(section));
            if(sectionData.data && sectionData.data.item)
            {
              var sectionDocValues;

              if (reportType===ProjectReportType.INVASIVEONLY ) {
                if (invasiveSectionData.data && invasiveSectionData.data.item) {
                  
                  if (conclusiveSectionData.data && conclusiveSectionData.data.item) {
                    sectionDocValues = {
                      isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                      reportType : reportType,
                      buildingName: subprojectName,
                      parentType: locationType,
                      parentName: location.data.item.name,
                      name: sectionData.data.item.name,
                      furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',
                      invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                      invasiveImages : invasiveSectionData.data.item.invasiveimages,
                      conclusiveImages : conclusiveSectionData.data.item.conclusiveimages,
                      propowneragreed:conclusiveSectionData.data.item.propowneragreed?'true':'false',
                      conclusiveadditionalconsiderations:conclusiveSectionData.data.item.conclusiveconsiderations,
                      conclusiveeee:conclusiveSectionData.data.item.eeeconclusive,
                      conclusivelbc:conclusiveSectionData.data.item.lbcconclusive,
                      conclusiveawe:conclusiveSectionData.data.item.aweconclusive,
                      invasiverepairsinspectedandcompleted:conclusiveSectionData.data.item.invasiverepairsinspectedandcompleted?'true':'false',
                      };
                  }else{
                    sectionDocValues = {
                      isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                      reportType : reportType,
                      buildingName: subprojectName,
                      parentType: locationType,
                      parentName: location.data.item.name,
                      name: sectionData.data.item.name,
                      furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',
                      invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                      invasiveImages : invasiveSectionData.data.item.invasiveimages,   
                      invasiverepairsinspectedandcompleted:false
                      };
                  }
                  var filename = await saveLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues,reportType) ;
                  sectionDataDoc[index]= filename;  
                  }
                }else{
                  if (invasiveSectionData.data && invasiveSectionData.data.item) {
                    if (conclusiveSectionData.data && conclusiveSectionData.data.item) {
                    sectionDocValues = {
                      isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                      reportType : reportType,
                      buildingName: subprojectName,
                      parentType: locationType,
                      parentName: location.data.item.name,
                      name: sectionData.data.item.name,
                      exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                      waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                      visualreview:sectionData.data.item.visualreview,
                      signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                      furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                      conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                      additionalconsiderations:sectionData.data.item.additionalconsiderations,
                      eee:sectionData.data.item.eee,
                      lbc:sectionData.data.item.lbc,
                      awe:sectionData.data.item.awe,
                      images:sectionData.data.item.images,                      
                      invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                      invasiveImages : invasiveSectionData.data.item.invasiveimages,     
                      furtherInvasiveRequired: invasiveSectionData.data.item.postinvasiverepairsrequired?'true':'false',                   
                      conclusiveImages : conclusiveSectionData.data.item.conclusiveimages,
                      propowneragreed:conclusiveSectionData.data.item.propowneragreed?'true':'false',
                      conclusiveadditionalconsiderations:conclusiveSectionData.data.item.conclusiveconsiderations,
                      conclusiveeee:conclusiveSectionData.data.item.eeeconclusive,
                      conclusivelbc:conclusiveSectionData.data.item.lbcconclusive,
                      conclusiveawe:conclusiveSectionData.data.item.aweconclusive,
                      invasiverepairsinspectedandcompleted:conclusiveSectionData.data.item.invasiverepairsinspectedandcompleted?'true':'false',
                      };
                    }else{
                      sectionDocValues = {
                        isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                        reportType : reportType,
                        buildingName: subprojectName,
                        parentType: locationType,
                        parentName: location.data.item.name,
                        name: sectionData.data.item.name,
                        exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                        waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                        visualreview:sectionData.data.item.visualreview,
                        signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                        furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                        conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                        additionalconsiderations:sectionData.data.item.additionalconsiderations,
                        eee:sectionData.data.item.eee,
                        lbc:sectionData.data.item.lbc,
                        awe:sectionData.data.item.awe,
                        images:sectionData.data.item.images,
                        furtherInvasiveRequired: false,
                        invasiveDesc: invasiveSectionData.data.item.invasiveDescription,
                        invasiveImages : invasiveSectionData.data.item.invasiveimages,                       
                        invasiverepairsinspectedandcompleted:'false'
                      };
                    }
                  }else{
                    sectionDocValues = {
                      isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                      reportType : reportType,
                      buildingName: subprojectName,
                      parentType: locationType,
                      parentName: location.data.item.name,
                      name: sectionData.data.item.name,
                      exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                      waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                      visualreview:sectionData.data.item.visualreview,
                      signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                      furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                      conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                      additionalconsiderations:sectionData.data.item.additionalconsiderations,
                      eee:sectionData.data.item.eee,
                      lbc:sectionData.data.item.lbc,
                      awe:sectionData.data.item.awe,
                      images:sectionData.data.item.images,
                      furtherInvasiveRequired: false,
                      invasiveDesc: 'Invasive inspection not done',//invasiveSectionData.data.item.invasiveDescription,
                      invasiveImages : [],//invasiveSectionData.data.item.invasiveimages,   
                      invasiverepairsinspectedandcompleted:false
                      };
                  }           
                  var filename = await saveLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues,reportType) ;
                  sectionDataDoc.push(filename);  
                
              }
              
            }  
            
            
          }));
          return sectionDataDoc;
        }else{
          return "";
        }
      } else if (reportType === projectReportType.VISUALREPORT) {
          var mysections = location.data.item.sections;
          
          if(!mysections)
          {
            return "";
          }
          const newSections = mysections.filter(section =>  isSectionIncluded(reportType, section));
          newSections.sort(function(section1,section2){
            
            if (section1.sequenceNo==null) {

                return compareBySectionId(section1, section2);
            }else{
                return (section1.sequenceNo-section2.sequenceNo);
            }
            
        });
       
          await Promise.all(newSections.map(async (section, index) => {
          var sectionData =  await sections.getSectionById(getSectionId(section));
          if (sectionData.error&&sectionData.error.code===401) {
            console.log('trying dynamic form fetch');
            sectionData =  await sections.getDynamicSectionById(getSectionId(section));
            isDynamicForm = true;
          }
          if(sectionData.data && sectionData.data.item)
          {

            var sectionDocValues;
            
            if (sectionData.data.item.unitUnavailable) {
              sectionDocValues = {
                isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                reportType : reportType,
                buildingName: subprojectName,
                parentType: locationType,
                parentName: location.data.item.name,
                name: sectionData.data.item.name,                  
              };
            }else{
                if (!isDynamicForm) {
                  sectionDocValues = {
                  isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                  reportType : reportType,
                  buildingName: subprojectName,
                  parentType: locationType,
                  parentName: location.data.item.name,
                  name: sectionData.data.item.name,
                  exteriorelements: sectionData.data.item.exteriorelements.toString().replaceAll(',',', '),
                  waterproofing:sectionData.data.item.waterproofingelements.toString().replaceAll(',',', '),
                  visualreview:sectionData.data.item.visualreview,
                  signsofleak : sectionData.data.item.visualsignsofleak=='True'?'Yes':'No',
                  furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                  conditionalassesment:sectionData.data.item.conditionalassessment=='Futureinspection'?'Future Inspection':sectionData.data.item.conditionalassessment,
                  additionalconsiderations:sectionData.data.item.additionalconsiderations,
                  //additionalconsiderationshtml:sectionData.data.item.additionalconsiderationshtml,
                  eee:sectionData.data.item.eee,
                  lbc:sectionData.data.item.lbc,
                  awe:sectionData.data.item.awe,
                  images:sectionData.data.item.images
                  
                  };
                }else{
                  sectionDocValues = {
                    isUnitUnavailable: sectionData.data.item.unitUnavailable?'true':'false',
                    reportType : reportType,
                    buildingName: subprojectName,
                    parentType: locationType,
                    parentName: location.data.item.name,
                    name: sectionData.data.item.name,                    
                  
                    furtherinvasive:sectionData.data.item.furtherinvasivereviewrequired=='True'?'Yes':'No',
                    
                    additionalconsiderations:sectionData.data.item.additionalconsiderations,
                    questions:sectionData.data.item.questions,
                    images:sectionData.data.item.images
                    
                  };
                }
            }
            if (!isDynamicForm) {
      if (subprojectName=='') {
        template = fs.readFileSync(path.join(__dirname,'Deck2AllData.docx'));
      }else{
        template = fs.readFileSync(path.join(__dirname,'DeckAllData.docx'));
      }
    }else{
      if (subprojectName=='') {
        template = fs.readFileSync(path.join(__dirname,'Deck2AllData_Generic.docx'));
      }else{
        template = fs.readFileSync(path.join(__dirname,'DeckAllData_Generic.docx'));
      }
    }
            var filename = await saveLocationDoc(locationId,getSectionId(sectionData.data.item),template,sectionDocValues, reportType) ;
            sectionDataDoc[index]=filename;
        }
        }));
        console.log(sectionDataDoc);
        return sectionDataDoc;
      }
    }
  } catch (error) {
    console.log("Error is " + error);
    return "";
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const getLocationDoc = async function(locationId,sectionId,template,sectionDocValues,reportType){
  const options = {
    
    jpegjsMaxResolutionInMP: 2048,
  }
  try {
    const buffer = await docxTemplate.createReport({
      template,
      failFast:false,
      data: {
          section: sectionDocValues      
      },
      additionalJsContext: {
        
        getChunks : async (imageArray,chunk_size=4) => {
          var index = 0;
          var tempArray = [];
          if (imageArray===undefined) {
            return tempArray;
          }
          var arrayLength = imageArray.length;
          for (index = 0; index < arrayLength; index += chunk_size) {
              myChunk = imageArray.slice(index, index+chunk_size);
              
              tempArray.push(myChunk);
            }
          
          return tempArray;
        },
        answersString:async (answers)=>{
            return answers.join(', ');
        },
        // getadditionalconsiderations: ()=>{
        //     console.log('inside html fetch');
        //     // if (sectionDocValues.additionalconsiderationshtml===null ||sectionDocValues.additionalconsiderationshtml===undefined) {
        //     //   return sectionDocValues.additionalconsiderations;
        //     // }else{
        //       return '<font face="Nunito"><b>This</b> is a Test <u>text in html</u> <font color="#e31c1c">format</font> with different <span>colors</span> and <i>combinations</i>.</font>';
        //       return sectionDocValues.additionalconsiderationshtml;

        //     //}            
        // },
        tile: async (imageurl) => {
          
          if (imageurl===undefined) {
            
            return;
          }
          if (!imageurl.startsWith('http')) {
            //imageurl = 'https://www.deckinspectors.com/wp-content/uploads/2020/07/logo_new_new-1.png';
            return;
          }
          
          try {
              
              // const resp = await fetch(
              //   imageurl,
              //   {setTimeout:16000}
              // );

              //const resp = await fetchPlus(imageurl,{keepAlive: true },3);
              var urlArray = decodeURIComponent (imageurl.toString()).split('/');
              var imagebuffer;
              if (imageurl.includes('deckinspectorsappdata')) {
                 imagebuffer = await blobManager.getBlobBuffer(urlArray[urlArray.length-1],urlArray[urlArray.length-2]);
              }else
               imagebuffer = await blobManager.getBlobBufferFromOld(urlArray[urlArray.length-1],urlArray[urlArray.length-2])
              
              if (imagebuffer===undefined) {
                console.log('Failed to load image .');
                return;
              }
              
              //console.log(imageurl);
                var extension  = path.extname(imageurl);
                if (extension==='.HEIC') {
                  extension='.jpg';
                }

                //fix image rotation
                try {
                  var {buffer} = await jo.rotate(Buffer.from(imagebuffer), {quality:50});
                  
                  return { height: 6,width: 4.8,  data: buffer, extension: '.jpg' };
                } catch (error) {
                  console.log('An error occurred when rotating the file: ' + error);
                  return { height: 6,width: 4.8,  data: imagebuffer, extension: '.jpg' };
                }
                  
          } catch (error) {
             console.log(imageurl);
            console.log(error);
            return ;
          }   
        }, 
    }
  });
  //const outputDir = path.join(os.tmpdir(), "projectreportfiles")
  const outputDir = path.join("sectionfiles",locationId.toString());
            if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir,{ recursive: true });
            }
    if (sectionId === undefined || sectionId === null || sectionId === "") {
      console.log("Skipping getLocationDoc: sectionId is missing");
      return "";
    }
    var filename = path.join(outputDir,`${sectionId}_${reportType}.docx`);
    fs.writeFileSync(filename, buffer);
    //console.log(filename);
    return filename;
  } catch (error) {
    console.log(error);
    return "";
  }
  
}

const saveLocationDoc = async function(locationId,sectionId,template,sectionDocValues,reportType){
  try {
      const buffer = await docxTemplate.createReport({
      template,
      failFast:false,
      data: {
          section: sectionDocValues      
      },
      additionalJsContext: {
        
        getChunks : async (imageArray,chunk_size=4) => {
          var index = 0;
          var tempArray = [];
          if (imageArray===undefined) {
            return tempArray;
          }
          var arrayLength = imageArray.length;
          for (index = 0; index < arrayLength; index += chunk_size) {
              myChunk = imageArray.slice(index, index+chunk_size);
              
              tempArray.push(myChunk);
            }
          
          return tempArray;
        },
        answersString:async (answers)=>{
            return answers.join(', ');
        },
        // getadditionalconsiderations: ()=>{
        //     console.log('inside html fetch');
        //     // if (sectionDocValues.additionalconsiderationshtml===null ||sectionDocValues.additionalconsiderationshtml===undefined) {
        //     //   return sectionDocValues.additionalconsiderations;
        //     // }else{
        //       return '<font face="Nunito"><b>This</b> is a Test <u>text in html</u> <font color="#e31c1c">format</font> with different <span>colors</span> and <i>combinations</i>.</font>';
        //       return sectionDocValues.additionalconsiderationshtml;

        //     //}            
        // },
        tile: async (imageurl) => {
          
          if (imageurl===undefined) {
            
            return;
          }
          if (!imageurl.startsWith('http')) {
            //imageurl = 'https://www.deckinspectors.com/wp-content/uploads/2020/07/logo_new_new-1.png';
            return;
          }
          
          try {
            var urlArray = decodeURIComponent(imageurl.toString()).split('/');
              //var urlArray = imageurl.toString().split('/');
              var imagebuffer;
              if (imageurl.includes('deckinspectorsappdata')) {
                 imagebuffer = await blobManager.getBlobBuffer(urlArray[urlArray.length-1],urlArray[urlArray.length-2]);
              }else
               imagebuffer = await blobManager.getBlobBufferFromOld(urlArray[urlArray.length-1],urlArray[urlArray.length-2])
              
              if (imagebuffer===undefined) {
                console.log('Failed to load image .');
                return;
              }
              
              try {
                var {buffer} = await jo.rotate(Buffer.from(imagebuffer), {quality:50});
                
                return { height: 6,width: 4.8,  data: buffer, extension: '.jpg' };
              } catch (error) {
                console.log('An error occurred when rotating the file: ' + error);
                return { height: 6,width: 4.8,  data: imagebuffer, extension: '.jpg' };
              }
                  
          } catch (error) {
            console.log(imageurl);
            console.log(error);
            return ;
          }   
        }, 
    }
  });
  
  const outputDir = path.join("sectionfiles",locationId.toString());
  //const outputDir = path.join("sectionfiles");
  if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir,{ recursive: true });
  }
  if (sectionId === undefined || sectionId === null || sectionId === "") {
    console.log("Skipping saveLocationDoc: sectionId is missing");
    return "";
  }
  var filename = path.join(outputDir,`${sectionId}_${reportType}.docx`);
  fs.writeFileSync(filename, buffer);
  console.log(filename);
  return filename;
} catch (error) {
    console.log(error);
    return "";
}
}
function isLocationFileExists(filePath){
  
  if (!fs.existsSync(filePath)) {
    return false;
  } else {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return false;
    }
    return true;
  }
}
const generateReportForLocation = async function (locationId, sectionImageProperties, reportType) {
  try {
    const location = await locations.getLocationById(locationId);
    if (!location.data) {
      return "";
    } else {
      if (reportType === projectReportType.INVASIVEONLY || reportType === projectReportType.INVASIVEVISUAL) {
        if (location.data.item.isInvasive && location.data.item.isInvasive === true) {
          const sectionHtmls = await getSectionshtmls(location, location.data.item.sections, sectionImageProperties, reportType);
          return Object.values(sectionHtmls).join("");
        } else {
          return "";
        }
      } else if (reportType === projectReportType.VISUALREPORT) {
        const sectionHtmls = await getSectionshtmls(location, location.data.item.sections, sectionImageProperties, reportType);
        return Object.values(sectionHtmls).join("");
      }
    }
  } catch (error) {
    console.log("Error is " + error);
  }
}

const getSectionshtmls = async function (location, sections, sectionImageProperties, reportType) {
  try {
    const sectionHtmls = {};
    if(!sections)
    {
      return "";
    }
    const newSections = sections.filter(section =>  isSectionIncluded(reportType, section));

    await Promise.all(newSections.map(async (section, index) => {
      const processExecutor = SectionPartProcessExecutorFactory.getProcessExecutorChain(location, section.name, getSectionId(section), sectionImageProperties, reportType);
      const sectionHtml = await processExecutor.executeProcess();
      sectionHtmls[index] = sectionHtml;
    }));

    return sectionHtmls;
  } catch (error) {
    console.log(error);
  }
}

const isSectionIncluded = function (reportType, section) {
  if (reportType === projectReportType.INVASIVEONLY || reportType === projectReportType.INVASIVEVISUAL) {
    return section.furtherinvasivereviewrequired === true;
  } else if (reportType === projectReportType.VISUALREPORT) {
    return true;
  }
}

module.exports = { generateReportForLocation ,generateDocReportForLocation,saveDocReportForLocation,generateDocReportForSection};
