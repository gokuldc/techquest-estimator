import Dexie from 'dexie';

export const db = new Dexie('ConstructionAppDB');

db.version(4).stores({
    projects: 'id, name, code, clientName, region, createdAt',
    regions: 'id, name',
    resources: 'id, code, description',
    masterBoq: 'id, itemCode, description',
    projectBoq: 'id, projectId, masterBoqId, slNo'
});