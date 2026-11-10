import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, seedClass } from './renderApp';
import { createDemoBackend } from '../services/demoBackend';
import { parseCsv } from '../lib/csv';

const readBlob = (b: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsText(b);
  });

function captureDownloads() {
  const blobs: Blob[] = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return 'blob:teste';
  });
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
  return blobs;
}

describe('painel do professor', () => {
  beforeEach(() => localStorage.clear());

  it('valida o formulário de login', async () => {
    const user = userEvent.setup();
    renderApp('/professor/entrar');
    await user.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('Digite um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText(/pelo menos 6 caracteres/)).toBeInTheDocument();
  });

  it('cria turma, cadastra alunos e mostra os códigos uma única vez', async () => {
    const user = userEvent.setup();
    renderApp('/professor/entrar');
    await user.type(await screen.findByLabelText('E-mail'), 'prof@escola.br');
    await user.type(screen.getByLabelText('Senha'), 'senha-segura');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await user.click(await screen.findByRole('link', { name: 'Criar a primeira turma' }));
    await user.type(await screen.findByLabelText('Nome'), '8º B');
    await user.click(screen.getByRole('button', { name: 'Criar' }));
    await screen.findByRole('heading', { name: /Cadastrar alunos em 8º B/ });
    await user.type(screen.getByLabelText(/Nomes \(um por linha\)/), 'Lia{enter}Rui');
    await user.click(screen.getByRole('button', { name: /Cadastrar e gerar códigos/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Lia')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)).toHaveLength(2);
    await user.click(within(dialog).getByRole('button', { name: /Já guardei/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)).not.toBeInTheDocument();
  });

  it('acompanha a turma com filtros, exporta CSV e libera fase com motivo', async () => {
    const [ana] = await seedClass(['Ana', 'Bruno']);
    const sb = createDemoBackend();
    await sb.student.login(ana.code);
    await sb.student.submitQuiz(1, { q1: 'a', q2: 'b', q3: 'a', q4: 'a' });
    await sb.student.logout();
    await sb.teacher.signIn('prof@escola.br', 'senha-segura');
    const blobs = captureDownloads();
    const user = userEvent.setup();
    renderApp('/professor/turma');
    expect(await screen.findByRole('link', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bruno' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Aluno'), 'ana');
    expect(screen.queryByRole('link', { name: 'Bruno' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Situação'), 'nao_iniciou');
    expect(screen.getByText(/Nenhum aluno encontrado/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Situação'), '');
    await user.clear(screen.getByLabelText('Aluno'));

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    const rows = parseCsv(await readBlob(blobs[0]));
    expect(rows[0]).toContain('Aluno');
    expect(rows.map((r) => r[1])).toEqual(expect.arrayContaining(['Ana', 'Bruno']));

    await user.click(screen.getByRole('link', { name: 'Ana' }));
    expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /1\. Conhecendo o Kodu/ }));
    expect(screen.getByText(/não aprovado · melhor 0\/4 · 1 tent\./)).toBeInTheDocument();
    expect(screen.getByText('Respostas aos testes')).toBeInTheDocument();
    expect(screen.getByText(/0\/4/, { selector: 'strong' })).toBeInTheDocument();

    const liberar = screen.getAllByRole('button', { name: 'Liberar' })[0];
    await user.click(liberar);
    const dlg = await screen.findByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Liberar' }));
    expect(within(dlg).getByText(/Escreva o motivo/)).toBeInTheDocument();
    await user.type(within(dlg).getByLabelText(/Motivo/), 'Aluna já domina o conteúdo');
    await user.click(within(dlg).getByRole('button', { name: 'Liberar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/Fase liberada manualmente \(fase 2\) — motivo: Aluna já domina/)).toBeInTheDocument();
  });

  it('a visão geral mostra indicadores reais (sem dados fictícios)', async () => {
    await seedClass(['Ana', 'Bruno', 'Caio']);
    await createDemoBackend().teacher.signIn('prof@escola.br', 'senha-segura');
    renderApp('/professor');
    expect(await screen.findByText('alunos cadastrados')).toBeInTheDocument();
    expect(screen.getByText('alunos cadastrados').previousSibling).toHaveTextContent('3');
    expect(screen.getByText('ainda não entraram').previousSibling).toHaveTextContent('3');
    expect(screen.getByText(/Ainda não há alunos com progresso registrado/)).toBeInTheDocument();
  });
});

describe('trilha livre', () => {
  it('o professor liga a trilha livre e o aluno passa a ver as 20 fases liberadas', async () => {
    const [ana] = await seedClass(['Ana']);
    await createDemoBackend().teacher.signIn('prof@escola.br', 'senha-segura');
    const user = userEvent.setup();
    const view = renderApp('/professor');
    const sw = await screen.findByRole('switch', { name: /7º A/ });
    expect(sw).not.toBeChecked();
    await user.click(sw);
    await waitFor(() => expect(screen.getByRole('switch', { name: /7º A/ })).toBeChecked());
    expect(screen.getByText('Todas as fases liberadas')).toBeInTheDocument();
    view.unmount();

    const b = createDemoBackend();
    await b.teacher.signOut();
    await b.student.login(ana.code);
    renderApp('/trilha');
    expect(await screen.findByText(/Trilha livre:/)).toBeInTheDocument();
    expect(screen.queryAllByText(/🔒 Bloqueada/)).toHaveLength(0);
    expect(screen.getAllByText('Disponível')).toHaveLength(20);
    expect((await b.student.saveChecklist(17, ['copia'])).phaseId).toBe(17);
  });
});
