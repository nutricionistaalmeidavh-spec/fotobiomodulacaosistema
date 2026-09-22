import { openDatabase, listTables } from '../src/db/database.js';

const db = openDatabase(':memory:');
console.log(`F0 OK: ${listTables(db).length} tabelas carregadas.`);
db.close();
