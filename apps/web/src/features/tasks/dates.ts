export function localDateInput(instant: string | null) {
  if (!instant) return '';
  const date = new Date(instant);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function utcFromLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || localDateInput(date.toISOString()) !== value)
    throw new Error('Data ou horário local inválido.');
  return date.toISOString();
}
export function localDayInterval(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: start.toISOString(), until: new Date(end.getTime() - 1).toISOString() };
}
export const taskLabels = { TASK: 'Tarefa', FOLLOW_UP: 'Follow-up' };
export const priorityLabels = { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta' };
export const eventLabels = {
  CREATED: 'Tarefa criada',
  UPDATED: 'Tarefa atualizada',
  COMPLETED: 'Tarefa concluída',
  REOPENED: 'Tarefa reaberta',
  ARCHIVED: 'Tarefa arquivada',
  NOTE: 'Nota',
  CALL: 'Ligação',
  EMAIL: 'E-mail',
  MEETING: 'Reunião',
};
export function targetHref(type: 'contact' | 'lead' | 'opportunity', id: string) {
  return `${type === 'contact' ? '/contacts' : type === 'lead' ? '/leads' : '/crm'}/${id}`;
}
