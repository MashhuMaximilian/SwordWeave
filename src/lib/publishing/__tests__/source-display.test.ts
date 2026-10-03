import {describe,it,expect} from 'vitest';
import {sourceDisplayLabel} from '../source-display';
import {authorDisplayName,authorDisplayUsername,isSystemAuthoredServer} from '../author-display';
describe('SRD source and System attribution',()=>{
 it('uses the book title instead of import keys',()=>{for(const source of ['SRD','system','system:v12:curated:permission:carapace'])expect(sourceDisplayLabel(source)).toBe('SRD');});
 it('masks admin user IDs as SRD without changing community book names',()=>{expect(sourceDisplayLabel('user:internal-clerk-id',true)).toBe('SRD');expect(sourceDisplayLabel('My Campaign')).toBe('My Campaign');expect(sourceDisplayLabel(null)).toBeNull();});
 it('attributes literal SRD to System on client and server',()=>{const row={authorUsername:'editor',authorDisplayName:'Editor',sourceOrigin:'SRD'};expect(authorDisplayName(row)).toBeNull();expect(authorDisplayUsername(row)).toBeNull();expect(isSystemAuthoredServer({author:{isAdmin:false},sourceOrigin:'SRD',hasUserId:true})).toBe(true);});
});
