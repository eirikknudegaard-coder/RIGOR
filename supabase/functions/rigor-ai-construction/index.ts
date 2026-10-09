import {handleConstruction} from './handler.ts';
Deno.serve(request=>handleConstruction(request,{env:name=>Deno.env.get(name),fetch:globalThis.fetch}));
