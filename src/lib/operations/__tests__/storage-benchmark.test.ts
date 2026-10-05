import { describe,it,expect } from "vitest";
import { estimateBenchmark } from "../storage-benchmark";
describe("storage benchmark",()=>{
 it("accounts for indexes, relationships and overhead without assuming media is in SQL",()=>{
 const sample={name:"characters",rows:20,averageRowBytes:1000,heapBytes:40000,indexBytes:10000,totalBytes:50000};
 const r=estimateBenchmark([sample,{...sample,name:"character_primitives",rows:100,averageRowBytes:100}],1000,3);
 expect(r.sessionBytes).toBe(51200000);expect(r.relationshipBytes).toBe(5000000);expect(r.indexBytes).toBeGreaterThan(0);expect(r.estimatedBytes).toBeGreaterThan(r.authoredBytes+r.versionBytes+r.sessionBytes);
 });
 it("separates historical growth from unchanged current rows",()=>{const one=estimateBenchmark([],1000,1),five=estimateBenchmark([],1000,5);expect(one.authoredBytes).toBe(five.authoredBytes);expect(five.versionBytes).toBe(one.versionBytes*5);});
});
