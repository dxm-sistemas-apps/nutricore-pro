// www/js/calendar-ui.js
// Componente de Calendario Mensal Interativo (Profissional/Clinica e Paciente)

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatModalityBadge(modality) {
  const map = {
    PRIMEIRA_VEZ: '1a Vez',
    RETORNO: 'Retorno',
    PLANO_TRI: 'Plano Tri',
    PLANO_SEMESTRAL: 'Plano Semestral'
  };
  return map[modality] || modality || '';
}

export function renderCalendarGrid({
  year,
  month,
  selectedDate,
  events = [],
  busySlots = [],
  scheduleCfg = {},
  mode = 'PRO'
}) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const openDays = scheduleCfg.days || [1, 2, 3, 4, 5];

  const toMin = (t) => {
    const [h, m] = String(t || '08:00').split(':').map(Number);
    return h * 60 + m;
  };
  const step = Number(scheduleCfg.slotMinutes) || 60;
  let dailyCapacity = 0;
  for (let cur = toMin(scheduleCfg.startHour || '08:00'); cur + step <= toMin(scheduleCfg.endHour || '18:00'); cur += step) {
    if (cur >= toMin(scheduleCfg.lunchStart || '12:00') && cur < toMin(scheduleCfg.lunchEnd || '13:00')) continue;
    dailyCapacity++;
  }

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(`<div class="min-h-[92px] bg-slate-50/70 rounded-xl border border-slate-100"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const weekday = new Date(year, month, day).getDay();
    const isOpenDay = openDays.includes(weekday);
    const isSelected = dateStr === selectedDate;
    const isToday = dateStr === todayStr;

    const dayEvents = events
      .filter((e) => e.date === dateStr)
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

    const occupiedCount = Math.max(
      dayEvents.length,
      busySlots.filter((b) => b.date === dateStr).length
    );
    const freeCount = Math.max(0, dailyCapacity - occupiedCount);

    let badgesHtml = '';
    if (dayEvents.length > 0) {
      badgesHtml = dayEvents
        .slice(0, 2)
        .map((ev) => {
          const modLabel = ev.modalityLabel || formatModalityBadge(ev.modality);
          const suffix = modLabel ? ` (${modLabel})` : '';
          const label = mode === 'PRO'
            ? `${ev.time} • ${ev.patientName || 'Paciente'}${suffix}`
            : `${ev.time} • ${modLabel || ev.type || 'Sua Consulta'}`;
          return `<div class="truncate text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800" title="${label}">${label}</div>`;
        })
        .join('');
      if (dayEvents.length > 2) {
        badgesHtml += `<div class="text-[10px] font-bold text-slate-500 px-1">+${dayEvents.length - 2} mais</div>`;
      }
    } else if (!isOpenDay) {
      badgesHtml = `<span class="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Fechado</span>`;
    } else if (freeCount > 0) {
      badgesHtml = `<span class="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">Livre (${freeCount})</span>`;
    } else {
      badgesHtml = `<span class="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Lotado</span>`;
    }

    cells.push(`
      <button type="button" data-cal-day="${dateStr}"
        class="min-h-[92px] p-2 rounded-xl border text-left flex flex-col justify-between transition hover:border-emerald-500 ${
          isSelected
            ? 'bg-emerald-50/70 border-2 border-brand ring-2 ring-emerald-200 shadow-sm'
            : 'bg-white border-slate-200'
        }">
        <div class="flex items-center justify-between w-full">
          <span class="text-xs font-bold ${
            isToday
              ? 'w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center'
              : 'text-slate-700'
          }">${day}</span>
          ${isOpenDay && dayEvents.length > 0 && freeCount > 0
            ? `<span class="text-[9px] font-semibold text-sky-600">${freeCount} livre(s)</span>`
            : ''}
        </div>
        <div class="w-full space-y-1 mt-1 overflow-hidden">
          ${badgesHtml}
        </div>
      </button>
    `);
  }

  return `
    <div class="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <button type="button" data-cal-nav="-1" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700">◀ Anterior</button>
          <h2 class="text-base md:text-lg font-bold text-slate-900 px-2">${MONTH_NAMES[month]} ${year}</h2>
          <button type="button" data-cal-nav="1" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700">Proximo ▶</button>
        </div>
        <div class="flex items-center gap-3 text-[11px] text-slate-500">
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-emerald-200 inline-block"></span> Agendado</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-sky-200 inline-block"></span> Livre</span>
          <button type="button" data-cal-today="1" class="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold">Hoje</button>
        </div>
      </div>

      <div class="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase text-slate-400">
        ${WEEK_DAYS.map((d) => `<div class="py-1">${d}</div>`).join('')}
      </div>

      <div class="grid grid-cols-7 gap-1.5">
        ${cells.join('')}
      </div>
    </div>
  `;
}
