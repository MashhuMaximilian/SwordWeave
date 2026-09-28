import {it,expect} from "vitest";
import {readJsonResponse} from "../read-json-response";
it("reports non-JSON server failures without leaking an HTML page or clearing edits",async()=>{
 await expect(readJsonResponse(new Response("<html>server exception and details</html>",{status:500}))).rejects.toThrow("server could not complete");
 await expect(readJsonResponse(new Response("",{status:401}))).rejects.toThrow("Sign in again");
 await expect(readJsonResponse(new Response("Not found",{status:404}))).rejects.toThrow("HTTP 404");
});
it("retains structured success and validation errors for existing callers",async()=>{
 expect(await readJsonResponse(Response.json({items:[]}))).toEqual({items:[]});
 expect(await readJsonResponse(Response.json({error:"Over budget"},{status:400}))).toEqual({error:"Over budget"});
});
