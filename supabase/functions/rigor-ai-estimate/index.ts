import {handleEstimate} from './handler.ts';
Deno.serve(request=>handleEstimate(request,{env:name=>Deno.env.get(name),fetch:globalThis.fetch}));
