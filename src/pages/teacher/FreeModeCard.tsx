import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { useTeacherData } from './TeacherData';
import { ErrorAlert, useToast } from '../../components/Feedback';
import { toAppError } from '../../services/errors';

/** Liga/desliga a "trilha livre" (todas as fases liberadas) para cada turma. */
export function FreeModeCard() {
  const { backend } = useApp();
  const { data, reload } = useTeacherData();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const classes = data.classes.filter((c) => !c.archived);
  if (!classes.length) return null;

  async function toggle(id: string, name: string, enabled: boolean) {
    if (!backend) return;
    setBusy(id);
    setError(null);
    try {
      await backend.teacher.setFreeMode(id, enabled);
      toast(enabled ? `Trilha livre ligada para ${name}: todas as fases liberadas.` : `Trilha livre desligada para ${name}.`, 'ok');
      await reload();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card" aria-labelledby="trilha-livre" style={{ marginBottom: 16 }}>
      <h2 id="trilha-livre">Trilha livre</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Ligada: os alunos da turma podem abrir <strong>qualquer uma das 20 fases</strong>, sem seguir a ordem. Cada fase continua exigindo
        checklist, teste e reflexão para ser concluída, e tudo segue aparecendo no seu painel. Desligada: as fases abrem uma por vez.
      </p>
      <ErrorAlert message={error} />
      <div className="grid grid-3">
        {classes.map((c) => (
          <label key={c.id} className="row" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', margin: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              role="switch"
              aria-checked={c.freeMode}
              checked={c.freeMode}
              disabled={busy === c.id}
              onChange={(e) => toggle(c.id, c.name, e.target.checked)}
              style={{ width: 24, height: 24, accentColor: 'var(--ok)' }}
            />
            <span>
              {c.name}
              <span className={`badge ${c.freeMode ? 'badge-ok' : ''}`} style={{ marginLeft: 8 }}>
                {c.freeMode ? 'Todas as fases liberadas' : 'Fases em ordem'}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        Os alunos veem a mudança ao abrir ou atualizar a página. Ao desligar, as fases que eles não concluíram voltam a seguir a ordem; o que
        já foi concluído não se perde.
      </p>
    </section>
  );
}
