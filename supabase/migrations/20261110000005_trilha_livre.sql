-- =====================================================================
-- Trilha livre: o professor pode liberar todas as fases de uma turma.
-- Os critérios de conclusão de cada fase continuam valendo.
-- =====================================================================
alter table public.classes add column if not exists free_mode boolean not null default false;

-- O professor dono da turma pode ligar/desligar (a política de UPDATE já restringe ao dono).
grant update (free_mode) on public.classes to authenticated;

create or replace function private.phase_unlocked(p_student uuid, p_phase int)
returns boolean
language sql stable
set search_path = public
as $$
  select p_phase = 1
    or exists (select 1 from public.students st join public.classes c on c.id = st.class_id
               where st.id = p_student and c.free_mode)
    or exists (select 1 from public.phase_progress
               where student_id = p_student and phase_id = p_phase - 1 and status = 'completed')
    or exists (select 1 from public.phase_progress
               where student_id = p_student and phase_id = p_phase and (manually_unlocked or status = 'completed'));
$$;

-- student_me e student_login passam a informar se a turma está em trilha livre.
create or replace function public.student_me()
returns json
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_id uuid := public.current_student_id();
  r record;
begin
  if v_id is null then
    return null;
  end if;
  select st.id, st.display_name, st.started_at, c.id as class_id, c.name as class_name, c.free_mode
    into r
    from public.students st join public.classes c on c.id = st.class_id
   where st.id = v_id;
  return json_build_object('id', r.id, 'display_name', r.display_name, 'class_id', r.class_id,
                           'class_name', r.class_name, 'started_at', r.started_at, 'free_mode', r.free_mode);
end;
$$;

create or replace function public.teacher_set_free_mode(p_class uuid, p_enabled boolean)
returns void
language plpgsql volatile security definer
set search_path = public, private
as $$
declare
  v_teacher uuid := private.require_teacher();
begin
  if not public.teacher_owns_class(p_class) then
    raise exception 'class_not_found' using errcode = '42501';
  end if;
  update public.classes set free_mode = coalesce(p_enabled, false) where id = p_class;
  insert into public.audit_log (teacher_id, class_id, action, after)
  values (v_teacher, p_class, case when p_enabled then 'free_mode_on' else 'free_mode_off' end,
          jsonb_build_object('free_mode', coalesce(p_enabled, false)));
end;
$$;

revoke all on function public.teacher_set_free_mode(uuid, boolean) from public, anon;
grant execute on function public.teacher_set_free_mode(uuid, boolean) to authenticated;
revoke all on function public.student_me() from public, anon;
grant execute on function public.student_me() to authenticated;
revoke all on function private.phase_unlocked(uuid, int) from public, anon, authenticated;
