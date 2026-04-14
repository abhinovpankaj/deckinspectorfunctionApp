"use strict";
const { DocumentNotFoundError, MutateInSpec } = require('couchbase');
var couchbase = require('../database/couchbase');
const Role = require('./role');

// Get bucket name and scope name for N1QL queries
const DB_BUCKET_NAME = couchbase.DB_BUCKET_NAME;
const DB_SCOPE_NAME = couchbase.DB_SCOPE_NAME;

var isProjectReportinProgress = async function(project_id, reportType) {
    try {
        const collection = couchbase.ProjectReports;
        const docId = `${project_id}_${reportType}`;
        const result = await collection.get(docId);
        return result.content?.isReportInProgress || false;
    } catch (err) {
        if (err.name === "DocumentNotFoundError") {
            return false;
        }
        console.error('Error in isProjectReportinProgress:', err);
        return false;
    }
}

var addProjectReport = async function (projectReport, callback) {
    try {
        const collection = couchbase.ProjectReports;
        const docId = `${projectReport.project_id}_${projectReport.reportType}`;
        const reportData = {
            project_id: projectReport.project_id,
            url: projectReport.url,
            name: projectReport.name,
            timestamp: projectReport.timestamp,
            reportType: projectReport.reportType,
            isReportInProgress: true,
            uploader: projectReport.uploader
        };
        
        try {
            await collection.get(docId);
            // Update existing report
            await collection.replace(docId, reportData);
            callback(null, { ...reportData, _id: docId });
        } catch (err) {
            if (err.name !== "DocumentNotFoundError") {
                throw err;
            }
            // Insert new report
            await collection.insert(docId, reportData);
            callback(null, { ...reportData, _id: docId });
        }
    } catch (err) {
        const error = new Error("addProjectReport(): " + err.message);
        error.status = 500;
        callback(error);
    }
};

var updateProjectReport = async function (projectReport, callback) {
    try {
        const collection = couchbase.ProjectReports;
        
        const updateData = {
            url: projectReport.url,
            isReportInProgress: false,
            fileName: projectReport.fileName
        };

        if (projectReport.reportType !== undefined) {
            updateData.reportType = projectReport.reportType;
        }
        
        const mutateOperations = [
            MutateInSpec.upsert('url', projectReport.url),
            MutateInSpec.upsert('isReportInProgress', false),
            MutateInSpec.upsert('fileName', projectReport.fileName)
        ];

        if (projectReport.reportType !== undefined) {
            mutateOperations.push(MutateInSpec.upsert('reportType', projectReport.reportType));
        }

        await collection.mutateIn(projectReport._id, mutateOperations);
        callback(null, { _id: projectReport._id, ...updateData });
    } catch (err) {
        const error = new Error("updateProjectReport(): " + err.message);
        error.status = 500;
        callback(error);
    }
};

var getProjectReportsbyProjectId = async function (project_id, callback) {
    try {
        const cluster = couchbase.cluster;
        
        const result = await cluster.query(
            `SELECT META().id as _id, ProjectReports.* FROM \`${DB_BUCKET_NAME}\`.\`${DB_SCOPE_NAME}\`.ProjectReports 
             WHERE project_id = $1`,
            { parameters: [project_id] }
        );
        
        const reports = result.rows;
        
        if (reports.length === 0) {
            const error1 = new Error("getProjectReportsbyProjectId().\nMessage: No Document Found.");
            error1.status = 404;
            callback(error1);
            return;
        }
        callback(null, reports);
    } catch (err) {
        const error = new Error("getProjectReportsbyProjectId(): " + err.message);
        error.status = 500;
        callback(error);
    }
};

var removeReport = async function (id, callback) {
    try {
        const collection = couchbase.ProjectReports;
        
        const result = await collection.remove(id);
        
        if (result) {
            callback(null, { status: 201, message: "Document deleted successfully." });
        } else {
            const error = new Error("removeReport(): Failed to delete document");
            error.status = 500;
            callback(error);
        }
    } catch (err) {
        const error = new Error("removeReport(): " + err.message);
        error.status = 500;
        callback(error);
    }
};

module.exports = {
    addProjectReport: addProjectReport,
    getProjectReportsbyProjectId: getProjectReportsbyProjectId,
    removeReport: removeReport,
    updateProjectReport: updateProjectReport,
    isProjectReportinProgress: isProjectReportinProgress
};