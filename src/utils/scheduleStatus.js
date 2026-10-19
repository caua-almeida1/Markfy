/* Status de agendamento como o app grava hoje
   (companys/{handle}/schedules/{id}/status). */

export const SCHEDULE_STATUS = {
    pending: { label: "Pendente", tone: "warning" },
    confirmed: { label: "Confirmado", tone: "info" },
    completed: { label: "Concluído", tone: "success" },
    cancelados: { label: "Cancelado", tone: "danger" },
    cancelled: { label: "Cancelado", tone: "danger" },
    canceled: { label: "Cancelado", tone: "danger" }
};

export const getScheduleStatus = (status) =>
    SCHEDULE_STATUS[status] || { label: status || "Sem status", tone: undefined };

export const isCancelled = (status) =>
    status === "cancelados" || status === "cancelled" || status === "canceled";
