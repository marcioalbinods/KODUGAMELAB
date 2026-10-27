import { supabaseConfigProblems } from '../src/services/supabaseConfig';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url && !key) {
  console.log('::warning::Secrets do Supabase ausentes: site publicado em MODO DEMONSTRAÇÃO.');
  process.exit(0);
}
const problems = supabaseConfigProblems(url, key);
if (problems.length) {
  for (const p of problems) console.log(`::error::${p}`);
  console.log('Corrija em Settings > Secrets and variables > Actions e rode a publicação de novo.');
  process.exit(1);
}
console.log('Configuração do Supabase válida: site conectado ao banco (modo real).');
