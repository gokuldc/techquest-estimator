import Dexie from 'dexie';

export const db = new Dexie('ConstructionAppDB');

db.version(3).stores({
    projects: 'id, name, clientName, region, createdAt',
    regions: 'id, name',
    resources: 'id, code, description',
    masterBoq: 'id, itemCode, description', // Added itemCode for unique identification
    projectBoq: 'id, projectId, masterBoqId, slNo'
});