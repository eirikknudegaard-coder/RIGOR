// Deploy with JWT verification enabled. Authentication is also checked explicitly.
import {handleImportMap} from './handler.ts';
Deno.serve(request=>handleImportMap(request,{env:name=>Deno.env.get(name),fetch:globalThis.fetch}));
