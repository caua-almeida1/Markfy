/* =========================================================
   MONITOR DE RETIRADA — SOM E VOZ

   Navegadores só tocam áudio depois de um gesto da pessoa:
   o botão "Iniciar monitor" chama unlockAudio().
   Tudo é opcional e falha em silêncio (TV sem áudio ou sem
   síntese de voz continua mostrando os números).
========================================================= */

let context = null;

const audio = () => {
    try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        context = context || new AudioCtor();
        return context;
    } catch {
        return null;
    }
};

export const unlockAudio = () => {
    const ctx = audio();
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
    /* algumas TVs só liberam a voz depois de uma fala no toque */
    try {
        if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    } catch {
        /* sem voz */
    }
};

/** Três notas de sino (dó, mi, sol), com decaimento longo. */
export const chime = () => {
    const ctx = audio();
    if (!ctx) return;
    try {
        [523.25, 659.25, 783.99].forEach((freq, index) => {
            const start = ctx.currentTime + index * 0.16;
            [1, 2.01].forEach((harmonic, layer) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = layer ? "sine" : "triangle";
                osc.frequency.value = freq * harmonic;
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(layer ? 0.06 : 0.22, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
                osc.connect(gain).connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 1.25);
            });
        });
    } catch {
        /* sem som */
    }
};

let voice = null;

const ptVoice = () => {
    if (voice) return voice;
    const voices = window.speechSynthesis?.getVoices?.() || [];
    voice = voices.find((item) => /pt[-_]BR/i.test(item.lang)) || voices.find((item) => /^pt/i.test(item.lang)) || null;
    return voice;
};

/** "Pedido 42, Ana. Pode retirar." — número lido como número. */
export const announce = (card) => {
    try {
        if (!window.speechSynthesis) return;
        const number = /^\d+$/.test(card.code) ? String(Number(card.code)) : card.code;
        const phrase = `Pedido ${number}${card.name ? `, ${card.name}` : ""}. Pode retirar.`;
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.lang = "pt-BR";
        const chosen = ptVoice();
        if (chosen) utterance.voice = chosen;
        utterance.rate = 0.95;
        /* espera o sino terminar */
        setTimeout(() => window.speechSynthesis.speak(utterance), 900);
    } catch {
        /* sem voz */
    }
};
