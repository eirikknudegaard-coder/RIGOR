import fs from 'node:fs';import {library} from '../kalkyle-library.js';
const catalog=library.map(e=>({id:e.id,name:e.name,category:e.category,unit:e.unit,description:e.description,excludes:e.excludes,tasks:e.tasks.map(t=>({id:t.id,name:t.name}))}));
fs.writeFileSync(new URL('../supabase/functions/rigor-ai-estimate/catalog.js',import.meta.url),'// Server-owned library snapshot. Update with scripts/update-ai-catalog.mjs.\nexport const catalog='+JSON.stringify(catalog)+';\n');
