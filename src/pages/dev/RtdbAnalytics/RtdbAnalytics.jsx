import React, {
    useEffect,
    useState,
    useSyncExternalStore
} from "react";

import {
    subscribeToMeter,
    getMeterSnapshot,
    resetMeter,
    isMeterInstalled
} from "../../../devtools/rtdbMeter";

import "./rtdb-analytics.css";

/*
============================================================
PAINEL DE CONSUMO DO REALTIME DATABASE
============================================================

Tela de desenvolvimento.

Mostra, ao vivo, quantos bytes cada caminho e cada tela
baixaram do Realtime Database nesta sessão.

Não lê nem grava nada no banco: os números vêm do medidor
em src/devtools/rtdbMeter.js, que conta os bytes que já
passaram pelo WebSocket.
============================================================
*/

const formatBytes = (bytes) => {

    if (!bytes) return "0 B";

    const units = ["B", "KB", "MB", "GB"];

    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {

        value /= 1024;
        unit += 1;

    }

    const decimals =
        unit === 0
            ? 0
            : value >= 100
                ? 0
                : value >= 10
                    ? 1
                    : 2;

    return `${value.toFixed(decimals)} ${units[unit]}`;

};

const formatDuration = (ms) => {

    const seconds = Math.floor(ms / 1000);

    const minutes = Math.floor(seconds / 60);

    if (minutes < 1) return `${seconds}s`;

    return `${minutes}min ${seconds % 60}s`;

};

const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString("pt-BR");

/*
 * O snapshot é recriado a cada aviso do medidor, então o
 * useSyncExternalStore precisa de um cache para não entrar
 * em laço infinito comparando objetos novos.
 */

let cachedVersion = 0;
let cachedSnapshot = null;

const getSnapshot = () => {

    if (!cachedSnapshot) {

        cachedSnapshot = getMeterSnapshot();

    }

    return cachedSnapshot;

};

const subscribe = (onChange) =>
    subscribeToMeter(() => {

        cachedVersion += 1;
        cachedSnapshot = getMeterSnapshot();

        onChange();

    });

/*
============================================================
BARRAS
============================================================

Uma série só, comparando magnitude entre categorias:
barras horizontais ordenadas, hue único, sem legenda
(o título já diz o que é).
============================================================
*/

const BarList = ({ rows, total }) => {

    const max = Math.max(
        0,
        ...rows.map((row) => row.value)
    );

    return (

        <div className="rtdb-bars">

            {rows.map((row) => {

                const share =
                    total > 0
                        ? (row.value / total) * 100
                        : 0;

                const width =
                    max > 0
                        ? Math.max((row.value / max) * 100, 1)
                        : 0;

                return (

                    <div
                        className="rtdb-bar-row"
                        key={row.key}
                        title={`${row.key} — ${formatBytes(row.value)} (${share.toFixed(1)}%)`}
                    >

                        <div className="rtdb-bar-main">

                            <span className="rtdb-bar-label">
                                {row.key}
                            </span>

                            <div className="rtdb-bar-track">

                                <div
                                    className="rtdb-bar-fill"
                                    style={{
                                        width: `${width}%`
                                    }}
                                />

                            </div>

                        </div>

                        <div className="rtdb-bar-value">

                            {formatBytes(row.value)}

                            <span className="rtdb-bar-sub">
                                {share.toFixed(1)}% · {row.count}x
                            </span>

                        </div>

                    </div>

                );

            })}

        </div>

    );

};

const RtdbAnalytics = () => {

    const snapshot = useSyncExternalStore(
        subscribe,
        getSnapshot
    );

    const [showTable, setShowTable] = useState(false);

    const [, forceTick] = useState(0);

    /*
     * O tempo decorrido precisa andar mesmo quando não
     * chega nenhum byte novo.
     */

    useEffect(() => {

        const timer = setInterval(
            () => forceTick(value => value + 1),
            1000
        );

        return () => clearInterval(timer);

    }, []);

    const installed = isMeterInstalled();

    const elapsedMs = Date.now() - snapshot.startedAt;

    const ratePerMin =
        elapsedMs > 0
            ? (snapshot.totalDown / elapsedMs) * 60000
            : 0;

    const pathRows = snapshot.paths
        .slice(0, 18)
        .map(entry => ({
            key: entry.path,
            value: entry.down,
            count: entry.count
        }));

    const routeRows = snapshot.routes
        .slice(0, 12)
        .map(entry => ({
            key: entry.route,
            value: entry.down,
            count: entry.count
        }));

    const heaviest = snapshot.paths[0];

    return (

        <div className="rtdb-root">

            <div className="rtdb-shell">

                {/* ================= CABEÇALHO ================= */}

                <header className="rtdb-header">

                    <div>

                        <h1 className="rtdb-title">
                            Consumo do Realtime Database
                        </h1>

                        <p className="rtdb-subtitle">
                            Bytes medidos no WebSocket desta aba, ao
                            vivo. Nada é lido nem gravado no banco,
                            então esta tela não gera download.
                        </p>

                    </div>

                    <div className="rtdb-actions">

                        <button
                            type="button"
                            className="rtdb-button"
                            aria-pressed={showTable}
                            onClick={() => setShowTable(value => !value)}
                        >
                            {showTable ? "Ver gráficos" : "Ver tabela"}
                        </button>

                        <button
                            type="button"
                            className="rtdb-button"
                            onClick={() => resetMeter()}
                        >
                            Zerar
                        </button>

                    </div>

                </header>

                {/* ================= AVISOS ================= */}

                {!installed && (

                    <div className="rtdb-notice rtdb-notice-critical">

                        <span>

                            <strong>O medidor não está ativo.</strong>{" "}
                            Ele só é instalado em desenvolvimento
                            (<code>npm start</code>) e precisa estar
                            carregado antes do Firebase abrir a conexão.
                            Recarregue a página com F5 — uma navegação
                            interna não reinstala o medidor.

                        </span>

                    </div>

                )}

                {installed && snapshot.totalDown === 0 && (

                    <div className="rtdb-notice">

                        <span>

                            <strong>Nenhum byte medido ainda.</strong>{" "}
                            Navegue pelas telas do app nesta mesma aba e
                            volte. A contagem sobrevive ao recarregar,
                            então dá para chegar aqui digitando o
                            endereço. Só o botão Zerar apaga.

                        </span>

                    </div>

                )}

                {snapshot.truncatedPaths && (

                    <div className="rtdb-notice">

                        <span>

                            <strong>Muitos caminhos distintos.</strong>{" "}
                            O medidor parou de registrar novos caminhos
                            para não consumir memória. Os totais
                            continuam corretos.

                        </span>

                    </div>

                )}

                {/* ================= TILES ================= */}

                <section className="rtdb-tiles">

                    <div className="rtdb-tile">

                        <p className="rtdb-tile-label">Baixado</p>

                        <p className="rtdb-tile-value">
                            {formatBytes(snapshot.totalDown)}
                        </p>

                        <p className="rtdb-tile-hint">
                            {snapshot.framesDown} quadros
                        </p>

                    </div>

                    <div className="rtdb-tile">

                        <p className="rtdb-tile-label">Enviado</p>

                        <p className="rtdb-tile-value">
                            {formatBytes(snapshot.totalUp)}
                        </p>

                        <p className="rtdb-tile-hint">
                            {snapshot.framesUp} quadros
                        </p>

                    </div>

                    <div className="rtdb-tile">

                        <p className="rtdb-tile-label">Ritmo</p>

                        <p className="rtdb-tile-value">
                            {formatBytes(ratePerMin)}
                        </p>

                        <p className="rtdb-tile-hint">
                            por minuto · sessão de{" "}
                            {formatDuration(elapsedMs)}
                        </p>

                    </div>

                    <div className="rtdb-tile">

                        <p className="rtdb-tile-label">Caminho mais pesado</p>

                        <p className="rtdb-tile-value">
                            {heaviest
                                ? formatBytes(heaviest.down)
                                : "—"}
                        </p>

                        <p className="rtdb-tile-hint rtdb-mono">
                            {heaviest ? heaviest.path : "sem dados"}
                        </p>

                    </div>

                </section>

                {showTable ? (

                    /* ================= TABELA ================= */

                    <section className="rtdb-section">

                        <div className="rtdb-section-head">

                            <h2 className="rtdb-section-title">
                                Todos os caminhos
                            </h2>

                            <p className="rtdb-section-note">
                                Identificadores agrupados como
                                <code> $id</code>
                            </p>

                        </div>

                        {snapshot.paths.length === 0 ? (

                            <p className="rtdb-empty">
                                Nada medido ainda.
                            </p>

                        ) : (

                            <div className="rtdb-table-wrap">

                                <table className="rtdb-table">

                                    <thead>
                                        <tr>
                                            <th>Caminho</th>
                                            <th>Baixado</th>
                                            <th>Enviado</th>
                                            <th>Vezes</th>
                                            <th>Tipo</th>
                                            <th>1ª tela</th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {snapshot.paths.map(entry => (

                                            <tr key={entry.path}>

                                                <td className="rtdb-mono">
                                                    {entry.path}
                                                </td>

                                                <td className="rtdb-num">
                                                    {formatBytes(entry.down)}
                                                </td>

                                                <td className="rtdb-num">
                                                    {formatBytes(entry.up)}
                                                </td>

                                                <td className="rtdb-num">
                                                    {entry.count}
                                                </td>

                                                <td>
                                                    {entry.kinds.map(
                                                        ([kind]) => (
                                                            <span
                                                                className="rtdb-tag"
                                                                key={kind}
                                                            >
                                                                {kind}
                                                            </span>
                                                        )
                                                    )}
                                                </td>

                                                <td className="rtdb-mono">
                                                    {entry.firstRoute}
                                                </td>

                                            </tr>

                                        ))}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </section>

                ) : (

                    <>

                        {/* ============ POR CAMINHO ============ */}

                        <section className="rtdb-section">

                            <div className="rtdb-section-head">

                                <h2 className="rtdb-section-title">
                                    Bytes baixados por caminho
                                </h2>

                                <p className="rtdb-section-note">
                                    18 maiores · identificadores
                                    agrupados como <code>$id</code>
                                </p>

                            </div>

                            {pathRows.length === 0 ? (

                                <p className="rtdb-empty">
                                    Nada medido ainda.
                                </p>

                            ) : (

                                <BarList
                                    rows={pathRows}
                                    total={snapshot.totalDown}
                                />

                            )}

                        </section>

                        {/* ============ POR TELA ============ */}

                        <section className="rtdb-section">

                            <div className="rtdb-section-head">

                                <h2 className="rtdb-section-title">
                                    Bytes baixados por tela
                                </h2>

                                <p className="rtdb-section-note">
                                    tela aberta no momento em que o
                                    dado chegou
                                </p>

                            </div>

                            {routeRows.length === 0 ? (

                                <p className="rtdb-empty">
                                    Nada medido ainda.
                                </p>

                            ) : (

                                <BarList
                                    rows={routeRows}
                                    total={snapshot.totalDown}
                                />

                            )}

                        </section>

                        {/* ============ ÚLTIMOS EVENTOS ============ */}

                        <section className="rtdb-section">

                            <div className="rtdb-section-head">

                                <h2 className="rtdb-section-title">
                                    Últimas chegadas
                                </h2>

                                <p className="rtdb-section-note">
                                    mais recentes primeiro
                                </p>

                            </div>

                            {snapshot.events.length === 0 ? (

                                <p className="rtdb-empty">
                                    Nada medido ainda.
                                </p>

                            ) : (

                                <div className="rtdb-table-wrap">

                                    <table className="rtdb-table">

                                        <thead>
                                            <tr>
                                                <th>Hora</th>
                                                <th>Caminho</th>
                                                <th>Tamanho</th>
                                                <th>Tipo</th>
                                                <th>Tela</th>
                                            </tr>
                                        </thead>

                                        <tbody>

                                            {snapshot.events
                                                .slice(0, 40)
                                                .map((event, index) => (

                                                    <tr
                                                        key={`${event.at}-${index}`}
                                                    >

                                                        <td>
                                                            {formatTime(event.at)}
                                                        </td>

                                                        <td className="rtdb-mono">
                                                            {event.path}
                                                        </td>

                                                        <td className="rtdb-num">
                                                            {formatBytes(event.bytes)}
                                                        </td>

                                                        <td>
                                                            <span className="rtdb-tag">
                                                                {event.kind}
                                                            </span>
                                                        </td>

                                                        <td className="rtdb-mono">
                                                            {event.route}
                                                        </td>

                                                    </tr>

                                                ))}

                                        </tbody>

                                    </table>

                                </div>

                            )}

                        </section>

                    </>

                )}

                {/* ================= RODAPÉ ================= */}

                <p className="rtdb-section-note">
                    Overhead de protocolo não atribuído a nenhum
                    caminho (handshake, autenticação, keep-alive):{" "}
                    {formatBytes(snapshot.overheadDown)}.
                    Para os bytes reais faturados, use{" "}
                    <code>firebase database:profile</code>.
                </p>

            </div>

        </div>

    );

};

export default RtdbAnalytics;
