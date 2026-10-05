import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks=vi.hoisted(()=>({visibleEntries:vi.fn()}));
vi.mock('@/lib/collections/service',()=>mocks);
import { redactExpandedContent } from '../redact-expanded-content';
beforeEach(()=>vi.clearAllMocks());
describe('expanded source permissions',()=>{
 it('removes inaccessible nested names and relationship counts with one batch',async()=>{
  mocks.visibleEntries.mockResolvedValue([{targetType:'CAPABILITY',targetId:'cap'},{targetType:'PRIMITIVE',targetId:'1'}]);
  const result=await redactExpandedContent({name:'Public heritage',capabilityLinks:[{capabilityId:'cap',capability:{id:'cap',name:'Readable',primitiveLinks:[{primitiveId:1,primitive:{id:1,name:'Public'}},{primitiveId:2,primitive:{id:2,name:'Secret'}}]}}],primitiveLinks:[{primitiveId:2,primitive:{id:2,name:'Secret'}}]},null);
  expect(result.primitiveLinks).toEqual([]);expect(result.capabilityLinks[0]?.capability.primitiveLinks).toHaveLength(1);
  expect(JSON.stringify(result)).not.toContain('Secret');expect(mocks.visibleEntries).toHaveBeenCalledTimes(1);
  expect(mocks.visibleEntries.mock.calls[0]?.[1]).toBeNull();
 });
 it('preserves granted owner/editor metadata without changing input',async()=>{
  mocks.visibleEntries.mockResolvedValue([{targetType:'ITEM',targetId:'item'}]);
  const input={itemLinks:[{itemId:'item',quantity:3,mirrored:true,item:{id:'item',name:'Private gear'}}]};
  expect(await redactExpandedContent(input,'owner')).toEqual(input);
  expect(input.itemLinks).toHaveLength(1);
 });
 it('avoids a database lookup for metadata-only responses',async()=>{
  const input=[{name:'Entry',computedBu:8}];expect(await redactExpandedContent(input,null)).toEqual(input);expect(mocks.visibleEntries).not.toHaveBeenCalled();
 });
});
