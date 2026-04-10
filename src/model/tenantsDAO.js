
const couchbase = require('../database/couchbase');

async function getDb() {
    await couchbase.connectToDatabase();
    return couchbase;
}

module.exports = {
    updateReportSpace: async (companyIdentifier, usedReportSpace) => {
        await couchbase.connectToDatabase();
        const result = await couchbase.prod_scope.query(
            "UPDATE Tenants SET usedReportSpace = usedReportSpace + $1, reportCount = reportCount + 1 WHERE companyIdentifier = $2",
            { parameters: [usedReportSpace, companyIdentifier] }
        );
        return { modifiedCount: result.meta.metrics.mutationCount };
    },

    getTenantDetails: async (companyIdentifier) => {
        try {
            await couchbase.connectToDatabase();
            const result = await couchbase.prod_scope.query(
                "SELECT Tenants.* FROM Tenants WHERE companyIdentifier = $1 LIMIT 1",
                { parameters: [companyIdentifier] }
            );
            if (result.rows.length > 0) {
                return result.rows[0];
            }
            return null;
        } catch (error) {
            console.error("Error getting tenant by company identifier:", error);
            throw error;
        }
    }
};
