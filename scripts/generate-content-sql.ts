import { writeFileSync } from 'node:fs';
import { buildContentSql, CONTENT_SQL_PATH } from './content-sql';
import { validateContent } from '../src/content/validate';
import { PHASES } from '../src/content/phases';
import { QUIZ_KEYS } from '../src/content/quizKeys';

const problems = validateContent(PHASES, QUIZ_KEYS);
if (problems.length) {
  console.error('Conteúdo com problemas:\n' + problems.join('\n'));
  process.exit(1);
}
writeFileSync(CONTENT_SQL_PATH, buildContentSql());
console.log(`Gerado ${CONTENT_SQL_PATH} (${PHASES.length} fases).`);
