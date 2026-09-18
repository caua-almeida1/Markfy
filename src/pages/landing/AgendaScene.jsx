import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";

import { useReducedMotion, usePointerTilt } from "./hooks";

/* =========================================================
   A CENA

   A agenda desenhada em profundidade real e em movimento
   contínuo: um horário livre no rodapé da lista é reservado,
   confirma, assenta como concluído e a lista sobe uma linha
   para abrir espaço ao próximo. O ciclo se repete.

   O passo da subida é fixo (--row + --gap), então a lista
   inteira desliza com um único transform e nada aqui
   dispara layout.
========================================================= */

const PEOPLE = [
    { client: "Helena Prado", service: "Escova + hidratação" },
    { client: "Marcos Vieira", service: "Corte + barba" },
    { client: "Tatiane Rocha", service: "Coloração" },
    { client: "Diego Amaral", service: "Corte social" },
    { client: "Priscila Lemos", service: "Manicure" },
    { client: "Otávio Bastos", service: "Barba completa" },
    { client: "Renata Coelho", service: "Progressiva" },
    { client: "Caio Menezes", service: "Pézinho" }
];

const VISIBLE = 6;      // linhas à mostra
const BUFFER = 1;       // linha extra, esperando abaixo da dobra
const STEP_MINUTES = 45;

const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/* Estado inicial já em regime: a agenda enche de cima para
   baixo, então só as duas últimas linhas estão livres — a
   visível, onde o próximo agendamento cai, e a que espera
   fora da dobra. Isso mantém o padrão estável a cada ciclo
   em vez de deixar buracos subindo pela lista. */
const buildInitialRows = () => {
    const rows = [];

    let minutes = 9 * 60;

    for (let i = 0; i < VISIBLE + BUFFER; i += 1) {
        const filled = i < VISIBLE - 1;

        rows.push({
            id: i,
            time: formatTime(minutes),
            state: filled ? "done" : "open",
            ...(filled ? PEOPLE[(i + 3) % PEOPLE.length] : {})
        });

        minutes += STEP_MINUTES;
    }

    return rows;
};

const AgendaScene = () => {
    const reduced = useReducedMotion();

    const stageRef = usePointerTilt({ max: 9, disabled: reduced });

    const [rows, setRows] = useState(buildInitialRows);
    const [shifting, setShifting] = useState(false);
    const [alert, setAlert] = useState(null);

    // Contadores que sobrevivem entre ciclos.
    const nextId = useRef(VISIBLE + BUFFER);
    const nextMinutes = useRef(9 * 60 + (VISIBLE + BUFFER) * STEP_MINUTES);
    const nextPerson = useRef(0);

    useEffect(() => {
        // Com movimento reduzido a agenda fica parada num
        // estado plausível: a informação é a mesma, sem
        // nada se mexendo.
        if (reduced) {
            setRows((current) =>
                current.map((row, index) =>
                    index === VISIBLE - 1
                        ? { ...row, state: "done", ...PEOPLE[0] }
                        : row
                )
            );

            return;
        }

        /* Ao desmontar não basta limpar o timeout: a promise
           ficaria pendente para sempre e o loop nunca sairia
           do await. Guardamos o resolve junto do id para
           soltar a espera e deixar o ciclo terminar. */
        const pending = new Set();

        const wait = (ms) =>
            new Promise((resolve) => {
                const entry = { resolve };

                entry.id = setTimeout(() => {
                    pending.delete(entry);
                    resolve();
                }, ms);

                pending.add(entry);
            });

        let alive = true;

        const patchLast = (patch) => {
            setRows((current) => {
                const copy = [...current];
                const target = copy.length - BUFFER - 1;

                copy[target] = { ...copy[target], ...patch };

                return copy;
            });
        };

        const cycle = async () => {
            while (alive) {
                const person = PEOPLE[nextPerson.current % PEOPLE.length];
                nextPerson.current += 1;

                // 1. o horário começa a ser reservado
                patchLast({ state: "incoming" });
                setAlert({ ...person, phase: "incoming" });

                await wait(1400);
                if (!alive) return;

                // 2. confirma — nome aparece, check entra
                patchLast({ state: "fresh", ...person });
                setAlert({ ...person, phase: "confirmed" });

                await wait(1800);
                if (!alive) return;

                // 3. assenta como concluído e o aviso sai
                patchLast({ state: "done" });
                setAlert(null);

                await wait(900);
                if (!alive) return;

                // 4. a lista sobe uma linha
                setShifting(true);

                await wait(620);
                if (!alive) return;

                // 5. descarta a linha que saiu por cima e
                //    repõe um horário livre embaixo
                setRows((current) => {
                    const copy = current.slice(1);

                    copy.push({
                        id: nextId.current,
                        time: formatTime(nextMinutes.current),
                        state: "open"
                    });

                    nextId.current += 1;
                    nextMinutes.current += STEP_MINUTES;

                    return copy;
                });

                setShifting(false);

                await wait(1200);
            }
        };

        cycle();

        return () => {
            alive = false;

            pending.forEach((entry) => {
                clearTimeout(entry.id);
                entry.resolve();
            });

            pending.clear();
        };
    }, [reduced]);

    const filled = rows
        .slice(0, VISIBLE)
        .filter((row) => row.state === "done" || row.state === "fresh").length;

    return (
        <div
            className="mk-stage"
            ref={stageRef}
            aria-hidden="true"
        >
            <div className="mk-scene">

                {/* Plano de fundo: a malha de horas que dá
                    a referência de profundidade. */}
                <div className="mk-plane mk-plane--grid">
                    {Array.from({ length: 7 }).map((_, index) => (
                        <span key={index} className="mk-gridline" />
                    ))}
                </div>


                {/* Plano principal: a agenda. */}
                <div className="mk-plane mk-plane--agenda">

                    <header className="mk-agenda__head">
                        <div>
                            <p className="mk-agenda__day">Quinta, 14</p>
                            <p className="mk-agenda__meta">Sua-Empresa</p>
                        </div>

                        <span className="mk-agenda__count">
                            {filled} de {VISIBLE}
                        </span>
                    </header>

                    <div className="mk-agenda__viewport">
                        <ul
                            className={
                                "mk-agenda__list" +
                                (shifting ? " is-shifting" : "")
                            }
                        >
                            {rows.map((row) => (
                                <li
                                    key={row.id}
                                    className={`mk-slot mk-slot--${row.state}`}
                                >
                                    <span className="mk-slot__time">
                                        {row.time}
                                    </span>

                                    <span className="mk-slot__body">
                                        {row.state === "open" && (
                                            <span className="mk-slot__open">
                                                Horário livre
                                            </span>
                                        )}

                                        {row.state === "incoming" && (
                                            <span className="mk-slot__open">
                                                Reservando…
                                            </span>
                                        )}

                                        {(row.state === "fresh" ||
                                            row.state === "done") && (
                                            <>
                                                <strong>{row.client}</strong>
                                                <small>{row.service}</small>
                                            </>
                                        )}
                                    </span>

                                    {(row.state === "fresh" ||
                                        row.state === "done") && (
                                        <Icon
                                            icon="solar:check-circle-bold"
                                            className="mk-slot__tick"
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>


                {/* Plano da frente: o aviso que acompanha a
                    reserva enquanto ela acontece. */}
                <div
                    className={
                        "mk-plane mk-plane--alert" +
                        (alert ? " is-visible" : "")
                    }
                >
                    <span className="mk-alert__pulse" />

                    <div>
                        <strong>
                            {alert?.phase === "confirmed"
                                ? "Agendamento confirmado"
                                : "Novo agendamento"}
                        </strong>

                        <small>
                            {alert
                                ? `${alert.client.split(" ")[0]} · ${alert.service}`
                                : ""}
                        </small>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AgendaScene;
