/* ============================================================
   TAKTARTEN-CHALLENGE: Klassenspiel zur Stunde "Die Taktarten" (Kl. 5).
   Ohne Parameter = Lehrkraft (Beamer), ?raum=CODE = Schueler (QR-Code).
   Aufbau wie die Metrum-Challenge (metrum-spiel), sieben Teile:
     hoer    Hoerquiz (Folie 4-8, 14): der Beamer spielt einen Song, alle
             tippen 2/4, 3/4 oder 4/4.
     klopf   Eins-Klopfer: zu einem neuen Song oder einem Groove links auf
             die 1, rechts auf die anderen Zaehlzeiten klopfen - das Geraet
             erkennt daraus die Taktart.
     klick   Klick-Detektiv: der Beamer spielt Metronom, Schlagzeug oder
             Blaskapelle mit betonter 1 - welche Taktart?
     takt    Taktart eintragen (Aufgabe 2 und 6): Takte sind da, die
             Taktart fehlt - bei "Profi" vor jedem Takt eine andere.
     strich  Taktstriche setzen (Aufgabe 4): Luecken zwischen den Noten
             antippen, wo ein Taktstrich hingehoert.
     luecke  Fehlende Note (Aufgabe 5): "?" antippen, Notenwert waehlen.
     kobold  Der Notenkobold hat einen Takt verhext (Fehlersuche, Z2):
             den Takt antippen, der nicht zur Taktart passt.
     quiz    Taktarten-Quiz im Millionaer-Look (Merke + Quatsch-Antworten).

   Live-Daten im Firebase-Projekt greenboys-scoreboard unter rooms/ta-<CODE>
   (die Regeln geben rooms/$roomCode frei, ohne .validate - deshalb nur
   kleine, flache Daten; vergeben: mt- Metrum, zz- Rhythmus-Klassenspiel):
     lehrer          nur die Lehrkraft schreibt: phase ('lobby' | 'teil' |
                     'frage' | 'aufl' | 'ende'), nr, rundeNr, anzahl, art,
                     spiel, aufgabe (was die Kinder sehen duerfen - nie die
                     Loesung), start (Serverzeit), dauer (s), spieltBis
                     (Serverzeit, bis dahin hoeren alle nur zu), loesung
                     (erst in 'aufl'), wertung {id: {p, b, x, g, pl}},
                     entfernt {id: Zeitpunkt}
     spieler/<id>    {name, emoji, seit, on}
     antw/<spiel>_<nr>/<id>
                     {w, t}: w = Index (hoer, klick, kobold, quiz) oder Text
                     mit Kommas (takt, luecke: Wahl je "?"; strich: Nummern
                     der gesetzten Luecken; klopf: "e0,a512,a1030,e1540,..."
                     = Eins/andere + ms ab dem ersten Tipp, hoechstens 48);
                     t = Serverzeit der Abgabe.
   Gedacht als Abschluss-Ueberpruefung nach dem Arbeitsblatt: Die Notenzeilen
   sind neu (nicht vom Arbeitsblatt), die Songs der Stunde sind deshalb
   standardmaessig aus - neue Songs kommen ueber "Eigene Songs".
   Download pro Stunde: grob 8 MB bei 28 Kindern und ~30 Runden (obere
   Grenze) - jeder liest nur 'lehrer', die Lehrkraft dazu 'spieler' und die
   Antworten der laufenden Runde.

   Punkte (rechnet nur die Lehrkraft): je Runde 0-100 Grundpunkte, dazu ein
   Platzbonus 50/40/30/20/10 fuer die ersten fuenf Abgaben mit mindestens
   60 Grundpunkten. Teilaufgaben (mehrere "?", Taktstriche) zaehlen anteilig.
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getDatabase, ref, set, update, get, onValue, remove, serverTimestamp, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js';

const firebaseConfig = {
    apiKey: 'AIzaSyA8aYVFa8XbIwviC4iJDA46gK0rMfF97Ac',
    authDomain: 'greenboys-scoreboard.firebaseapp.com',
    databaseURL: 'https://greenboys-scoreboard-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'greenboys-scoreboard',
    storageBucket: 'greenboys-scoreboard.firebasestorage.app',
    messagingSenderId: '1059492482424',
    appId: '1:1059492482424:web:9b4ad8c62ba51a83f8cc8d'
};
const db = getDatabase(initializeApp(firebaseConfig));
const pfad = (code, rest) => `rooms/ta-${code}${rest ? '/' + rest : ''}`;

/* ---------- Inhalte der Stunde ---------- */
const TA = ['2/4', '3/4', '4/4'];
const TA_ZAEHLEN = ['1 2', '1 2 3', '1 2 3 4'];
const TA_SCHLAEGE = { '2/4': 2, '3/4': 3, '4/4': 4 };

// Hoerbeispiele aus dem Stundenordner (Ordner "Hoerbeispiele") - nur lokal in IndexedDB.
// such: Dateiname (klein) -> passt. Die Titel sehen die Kinder erst in der Aufloesung.
const SONGS = [
    { hb: 1, titel: 'Spielmannszug: Preußens Gloria', ta: '2/4', quelle: 'Folie 4 · HB 1', such: /^hb0?1\D/ },
    { hb: 2, titel: 'Provinz: Walzer', ta: '3/4', quelle: 'Folie 4 · HB 2', such: /^hb0?2\D/ },
    { hb: 3, titel: 'Michael Jackson: Billie Jean', ta: '4/4', quelle: 'Folie 4 · HB 3', such: /^hb0?3\D/ },
    { hb: 4, titel: 'Beethoven: Ode an die Freude', ta: '4/4', quelle: 'Folie 6 · HB 4', such: /^hb0?4\D/ },
    { hb: 5, titel: 'Klangbeispiel 1', ta: '3/4', quelle: 'Folie 8 · Hörquiz', such: /^quiz\s*0?1\D/ },
    { hb: 6, titel: 'Klangbeispiel 2', ta: '2/4', quelle: 'Folie 8 · Hörquiz', such: /^quiz\s*0?2\D/ },
    { hb: 7, titel: 'Klangbeispiel 3', ta: '4/4', quelle: 'Folie 8 · Hörquiz', such: /^quiz\s*0?3\D/ },
    { hb: 8, titel: 'Klangbeispiel 4', ta: '3/4', quelle: 'Folie 8 · Hörquiz', such: /^quiz\s*0?4\D/ },
    { hb: 9, titel: 'Lady Gaga & Bruno Mars: Die With A Smile', ta: '3/4', quelle: 'Folie 2 · Einstieg A', such: /^einstieg\s*a\b/ },
    { hb: 10, titel: 'Charlie Puth: Boy', ta: '4/4', quelle: 'Folie 2 · Einstieg B', such: /^einstieg\s*b\b/ },
    { hb: 11, titel: 'Rhythmus a', ta: '4/4', quelle: 'Folie 7 · Aufgabe 2a', such: /^aufgabe\s*4\s*a\b/ },
    { hb: 12, titel: 'Rhythmus b', ta: '3/4', quelle: 'Folie 7 · Aufgabe 2b', such: /^aufgabe\s*4\s*b\b/ },
    { hb: 13, titel: 'Rhythmus c', ta: '4/4', quelle: 'Folie 7 · Aufgabe 2c', such: /^aufgabe\s*4\s*c\b/ },
    { hb: 14, titel: 'Rhythmus d', ta: '2/4', quelle: 'Folie 7 · Aufgabe 2d', such: /^aufgabe\s*4\s*d\b/ }
];

// Klick-Detektiv: drei Klaenge, die betonte 1 klingt jeweils anders
const KLAENGE = { metronom: 'Metronom', schlagzeug: 'Schlagzeug', blaskapelle: 'Blaskapelle' };

/* Notenzeilen. Kuerzel wie in der Rhythmus-Werkstatt (noten.js). Ein Takt =
   ein Text "V-V-AA". Keine punktierten Noten (Toms Vorgabe fuer Klasse 5).
   takt:   t = Taktart fuer alle Takte (nur vorne ein "?"), oder
           w = Taktart je Takt + f = welche Takte ein "?" bekommen (Profi).
   luecke: "?X" = hier fehlt die Note X.
   kobold: f = Nummer des verhexten Takts (0 = erster). */
const TAKT = [
    { t: '3/4', b: ['V-V-V', 'H-V', 'AA-V-V', 'V-H'] },
    { t: '4/4', b: ['V-V-H', 'AA-AA-V-V', 'H-H', 'G'] },
    { t: '2/4', b: ['V-V', 'AA-V', 'H', 'V-V'] },
    { t: '3/4', b: ['AA-AA-V', 'V-H', 'V-V-V', 'H-V'] },
    { t: '4/4', b: ['H-V-V', 'V-AA-AA-V', 'V-V-V-V', 'G'] },
    { t: '2/4', b: ['AA-AA', 'H', 'V-AA', 'H'] },
    { w: ['4/4', '3/4', '2/4', '3/4'], f: [1, 2, 3], b: ['V-V-V-V', 'V-V-V', 'V-V', 'H-V'] },
    { w: ['4/4', '2/4', '3/4', '4/4'], f: [1, 2, 3], b: ['G', 'V-V', 'AA-AA-V', 'V-V-V-V'] },
    { w: ['3/4', '2/4', '4/4', '2/4'], f: [0, 1, 2, 3], b: ['V-AA-V', 'H', 'H-V-V', 'AA-V'] },
    { w: ['3/4', '4/4', '2/4', '3/4'], f: [0, 1, 2, 3], b: ['V-H', 'V-V-V-V', 'AA-AA', 'H-V'] }
];
const STRICH = [
    { t: '3/4', b: ['V-V-V', 'H-V', 'V-AA-V', 'V-H'] },
    { t: '2/4', b: ['V-V', 'H', 'AA-V', 'AA-AA', 'V-Vp'] },
    { t: '4/4', b: ['V-V-H', 'AA-AA-V-V', 'G', 'V-Vp-AA-V'] },
    { t: '3/4', b: ['H-V', 'AA-AA-V', 'V-H', 'V-V-V', 'AA-V-V'] },
    { t: '2/4', b: ['AA-AA', 'V-V', 'H', 'V-AA', 'AA-V', 'H'] },
    { t: '4/4', b: ['H-H', 'V-AA-H', 'AA-AA-AA-AA', 'V-H-V'] },
    { t: '3/4', b: ['V-V-V', 'AA-AA-AA', 'H-V', 'V-H'] },
    { t: '4/4', b: ['V-V-V-V', 'H-AA-V', 'V-H-V', 'G'] }
];
const LUECKE = [
    { t: '4/4', b: ['V-V-?V-V', 'H-V-V', 'AA-AA-?H', 'G'] },
    { t: '3/4', b: ['V-V-V', '?H-V', 'AA-V-V', 'V-?H'] },
    { t: '2/4', b: ['V-?V', 'H', 'AA-AA', '?H'] },
    { t: '4/4', b: ['?G', 'V-V-H', 'AA-V-?V-V', 'H-H'] },
    { t: '3/4', b: ['H-?V', 'AA-AA-AA', 'V-?H', 'V-V-V'] },
    { t: '4/4', b: ['?H-V-V', 'V-V-V-V', 'H-?H', 'V-AA-H'] },
    { t: '2/4', b: ['AA-?V', 'V-V', '?H', 'V-AA'] },
    { t: '3/4', b: ['?V-H', 'V-V-V', 'H-?V', 'AA-?V-V'] }
];
const LUECKE_WAHL = ['G', 'H', 'V', 'A'];
const LUECKE_NAME = { G: 'Ganze', H: 'Halbe', V: 'Viertel', A: 'Achtel' };
const KOBOLD = [
    { t: '3/4', b: ['V-V-V', 'H-V', 'V-V-V-V', 'H-V'], f: 2 },
    { t: '2/4', b: ['V-V', 'AA-AA', 'H-V', 'V-V'], f: 2 },
    { t: '4/4', b: ['V-V-H', 'G', 'H-V', 'AA-AA-V-V'], f: 2 },
    { t: '3/4', b: ['V-H', 'H-V', 'AA-V-V', 'H-H'], f: 3 },
    { t: '4/4', b: ['AA-V-H', 'H-V-V', 'V-V-V-V-V', 'H-H'], f: 2 },
    { t: '2/4', b: ['V-AA', 'H', 'V-V-V', 'AA-V'], f: 2 }
];
// Erste Antwort ist jeweils die richtige, gemischt wird beim Raum oeffnen
const QUIZ = [
    { frage: 'Wodurch wird ein Takt vorne und hinten begrenzt?', antworten: ['Durch Taktstriche.', 'Durch Bindestriche.', 'Durch Zebrastreifen.', 'Durch den Schlussstrich unter der Mathe-Aufgabe.'] },
    { frage: 'Wo steht die Taktart?', antworten: ['Am Anfang des Stückes.', 'Am Ende des Stückes.', 'Auf der Rückseite des Notenblatts.', 'Im Kleingedruckten.'] },
    { frage: 'Was sagt die obere Zahl einer Taktart?', antworten: ['Wie viele Grundschläge ein Takt hat.', 'Wie laut man spielen soll.', 'Wie viele Musiker mitspielen.', 'Die Hausnummer des Komponisten.'] },
    { frage: 'Was sagt die untere Zahl im 3/4-Takt?', antworten: ['Wir zählen in Vierteln.', 'Das Stück dauert 4 Minuten.', 'Vier Leute müssen dazu tanzen.', 'Man braucht vier Instrumente.'] },
    { frage: 'Welche Zählzeit ist im Takt betont?', antworten: ['Die 1.', 'Die 2.', 'Immer die letzte.', 'Die, bei der der Lehrer niest.'] },
    { frage: 'Zu welchem Tanz passt der 3/4-Takt?', antworten: ['Walzer', 'Marsch', 'Breakdance', 'Pogo'] },
    { frage: 'Ein Marsch steht meistens im …', antworten: ['2/4-Takt.', '3/4-Takt.', '5/4-Takt.', 'Schneckentempo.'] },
    { frage: 'Wie viele Viertel passen in einen 4/4-Takt?', antworten: ['4', '3', '2', '44'] },
    { frage: 'Welche Note füllt allein einen ganzen 4/4-Takt?', antworten: ['Die Ganze.', 'Die Halbe.', 'Die Achtel.', 'Die Kobold-Note.'] },
    { frage: '„We Will Rock You“: stampf – stampf – klatsch – Pause. Welche Taktart?', antworten: ['4/4-Takt', '3/4-Takt', '2/4-Takt', 'Gar keine, das ist nur Lärm.'] },
    { frage: 'Ein Pinguin watschelt: links – rechts – links – rechts. Welche Taktart passt am besten?', antworten: ['2/4-Takt', '3/4-Takt', '7/8-Takt', 'Pinguine haben keinen Takt.'] }
];

const TEILE = ['hoer', 'klopf', 'klick', 'takt', 'strich', 'luecke', 'kobold', 'quiz'];
const TEIL_INFO = {
    hoer: { name: 'Hörquiz', icon: 'fa-headphones', folie: 'neue Songs', runden: 5, text: 'Hört den Song, findet die betonte 1 und zählt bis zur nächsten. Dann tippt ihr: 2/4, 3/4 oder 4/4?' },
    klopf: { name: 'Eins-Klopfer', icon: 'fa-hand-back-fist', folie: 'Song oder Groove', runden: 3, text: 'Klopft mit: links auf die betonte 1, rechts auf alle anderen Zählzeiten. Euer Gerät erkennt, welche Taktart ihr klopft – und wie gleichmäßig.' },
    klick: { name: 'Klick-Detektiv', icon: 'fa-user-secret', folie: 'Metronom & Co.', runden: 3, text: 'Metronom, Schlagzeug oder Blaskapelle – irgendwo versteckt sich die betonte 1. Erst zuhören, dann tippen.' },
    takt: { name: 'Taktart eintragen', icon: 'fa-pen', folie: 'wie Aufgabe 2 + 6', runden: 4, text: 'Zählt die Viertel in jedem Takt. Tippt auf das „?“ und wählt die Taktart. Bei Profi-Zeilen wechselt sie!' },
    strich: { name: 'Taktstriche setzen', icon: 'fa-grip-lines-vertical', folie: 'wie Aufgabe 4', runden: 4, text: 'Die Taktart steht vorne. Zählt mit und tippt zwischen die Noten, wo ein Taktstrich hingehört.' },
    luecke: { name: 'Fehlende Note', icon: 'fa-puzzle-piece', folie: 'wie Aufgabe 5', runden: 4, text: 'Bei jedem „?“ fehlt eine Note. Zählt, was schon da ist – welcher Notenwert macht den Takt voll?' },
    kobold: { name: 'Der Notenkobold', icon: 'fa-ghost', folie: 'Fehlersuche', runden: 3, text: 'Der Notenkobold 👺 hat einen Takt verhext – er passt nicht zur Taktart. Findet ihn und tippt ihn an!' },
    quiz: { name: 'Taktarten-Millionär', icon: 'fa-sack-dollar', folie: 'Merke', runden: 6, text: 'Fragen zum Merke-Kasten – und ein paar Quatsch-Antworten. Tippt die richtige Antwort, je schneller, desto mehr Punkte.' }
};
// hoeren = Sekunden, die der Song im Hoerquiz und beim Eins-Klopfer erst laeuft, bevor die Kinder tippen koennen
const ZEIT_STANDARD = { hoer: 30, klopf: 40, klick: 20, takt: 45, strich: 60, luecke: 45, kobold: 40, quiz: 20, hoeren: 10 };

/* ---------- Noten ---------- */
const dauerVon = (code) => (RHYTHMUS_NACH_CODE[code] || { dauer: 0 }).dauer;
const taktDauer = (takt) => takt.split('-').reduce((s, c) => s + dauerVon(c.replace('?', '')), 0);

// Eine Note (Baustein) als SVG - immer gleich hoch, damit alle Koepfe auf einer Linie stehen
const NB_OBEN = HALS_OBEN - 9, NB_HOEHE = 68;
const svgCache = {};
function notenSvg(code) {
    if (svgCache[code]) return svgCache[code];
    const b = bausteinAusKuerzel(code);
    if (!b) return '';
    const r = bausteinTeileZeichnen(b, 16, 'currentColor');
    const von = r.inkVon - 8, w = r.inkBis + 8 - von;
    return (svgCache[code] = `<svg class="nb" viewBox="${von} ${NB_OBEN} ${w} ${NB_HOEHE}" style="width:calc(var(--nh) * ${(w / NB_HOEHE).toFixed(3)})" aria-label="${esc(b.wort)}">
        <line x1="${von}" x2="${von + w}" y1="${LINIE_Y}" y2="${LINIE_Y}" stroke="currentColor" stroke-width="1.2" opacity=".55"/>${r.teile.join('')}</svg>`);
}
const taHtml = (t, kl = '') => { const [o, u] = String(t).split('/'); return `<span class="z z-ta ${kl}"><b>${esc(o)}</b><b>${esc(u)}</b></span>`; };
const strichHtml = (kl = '') => `<span class="z z-strich ${kl}"></span>`;
const endeHtml = () => '<span class="z z-ende"></span>';

/* Eine Notenzeile je Rundenart. s = Zustand (Wahl des Kindes, aktive Luecke,
   Loesung zeigen ...). Interaktive Stellen tragen data-Attribute:
   data-frage (takt: "?"), data-luecke (luecke), data-gap (strich), data-takt (kobold). */
function zeileHtml(r, s = {}) {
    const teile = [];
    if (r.art === 'takt') {
        let f = 0;
        r.b.forEach((takt, i) => {
            const z = r.zeig[i];
            if (z === '?') {
                const k = f++, wahl = s.wahl ? s.wahl[k] : -1;
                if (s.loesung) teile.push(taHtml(r.w[i], wahl === undefined || wahl < 0 ? 'loes' : TA[wahl] === r.w[i] ? 'ok' : 'falsch'));
                else teile.push(wahl >= 0 ? `<span class="z z-ta frage gewaehlt ${s.aktiv === k ? 'aktiv' : ''}" data-frage="${k}"><b>${TA[wahl].split('/')[0]}</b><b>4</b></span>`
                    : `<span class="z z-ta frage ${s.aktiv === k ? 'aktiv' : ''}" data-frage="${k}"><b>?</b></span>`);
            } else if (z) teile.push(taHtml(z, 'grau'));
            teile.push(`<span class="z-takt">${takt.split('-').map(notenSvg).join('')}</span>`);
            teile.push(i < r.b.length - 1 ? strichHtml() : endeHtml());
        });
    } else if (r.art === 'strich') {
        teile.push(taHtml(r.t));
        const an = s.striche || new Set(), soll = new Set(s.soll || []);
        r.c.forEach((code, k) => {
            teile.push(notenSvg(code));
            if (k === r.c.length - 1) return;
            let kl = an.has(k) ? 'an' : '';
            if (s.loesung) kl = soll.has(k) ? (s.mitWahl && !an.has(k) ? 'fehlt' : 'ok') : an.has(k) ? 'falsch' : '';
            teile.push(`<span class="z z-gap ${kl}" data-gap="${k}"></span>`);
        });
        teile.push(endeHtml());
    } else if (r.art === 'luecke') {
        teile.push(taHtml(r.t));
        let f = 0;
        r.b.forEach((takt, i) => {
            teile.push(`<span class="z-takt">${takt.split('-').map((c, j) => {
                if (!c.startsWith('?')) return notenSvg(c);
                const k = f++, wahl = s.wahl ? s.wahl[k] : -1;
                if (s.loesung) {
                    const soll = s.soll[k], kl = wahl === undefined || wahl < 0 ? 'loes' : LUECKE_WAHL[wahl] === soll ? 'ok' : 'falsch';
                    return `<span class="z z-luecke ${kl}">${notenSvg(soll)}</span>`;
                }
                return `<span class="z z-luecke ${s.aktiv === k ? 'aktiv' : ''}" data-luecke="${k}">${wahl >= 0 ? notenSvg(LUECKE_WAHL[wahl]) : '<b>?</b>'}</span>`;
            }).join('')}</span>`);
            teile.push(i < r.b.length - 1 ? strichHtml() : endeHtml());
        });
    } else if (r.art === 'kobold') {
        teile.push(taHtml(r.t));
        r.b.forEach((takt, i) => {
            let kl = s.wahl === i ? 'gewaehlt' : '';
            if (s.loesung) kl = i === s.falsch ? 'verhext' : s.wahl === i ? 'falsch' : '';
            teile.push(`<span class="z-takt tippbar ${kl}" data-takt="${i}">${takt.split('-').map(notenSvg).join('')}${s.loesung && i === s.falsch ? `<span class="kobold-marke">👺 ${s.schlaege} Schläge</span>` : ''}</span>`);
            teile.push(i < r.b.length - 1 ? strichHtml() : endeHtml());
        });
    }
    return `<div class="zeile ${s.gross ? 'gross' : ''} ${s.loesung ? 'loesung' : ''}">${teile.join('')}</div>`;
}

/* ---------- Punkte ---------- */
const PUNKTE_PLATZ = [50, 40, 30, 20, 10];   // Bonus fuer die ersten Abgaben ...
const PUNKTE_BONUS_AB = 60;                    // ... mit mindestens so vielen Grundpunkten
const fuenfer = (x) => Math.max(0, Math.min(100, Math.round(x / 5) * 5));
const liste = (w) => String(w ?? '').split(',').filter(x => x !== '').map(Number);
/* Eins-Klopfer: Tipps "e…" (Eins) und "a…" (andere) mit ms. Zwischen zwei
   Einsen liegt ein Takt; so viele Tipps er hat, so viele Schlaege hat er.
   Grundpunkte = Anteil der Takte mit der richtigen Schlagzahl x Menge (ab 3
   Takten voll) x (60 % + 40 % Gleichmaessigkeit). Gleichmaessig: mittlere
   Abweichung der Tipp-Abstaende vom Median bis 8 % = voll, ab 35 % = nichts. */
function klopfBasis(ta, w) {
    const tipps = String(w ?? '').split(',').filter(Boolean).map(x => ({ k: x[0], t: Number(x.slice(1)) }));
    const eins = tipps.map((x, i) => (x.k === 'e' ? i : -1)).filter(i => i >= 0);
    const takte = eins.slice(1).map((e, i) => e - eins[i]);
    if (takte.length < 2) return { b: 0, erkannt: null, gleich: 0, takte: takte.length };
    const zahl = {};
    takte.forEach(n => { zahl[n] = (zahl[n] || 0) + 1; });
    const oft = Number(Object.keys(zahl).sort((a, b) => zahl[b] - zahl[a])[0]);
    const abst = tipps.slice(1).map((x, i) => x.t - tipps[i].t).filter(d => d > 0);
    const m = abst.slice().sort((a, b) => a - b)[Math.floor(abst.length / 2)] || 1;
    const abw = abst.reduce((s, d) => s + Math.abs(d - m), 0) / Math.max(1, abst.length) / m;
    const gleich = abw <= 0.08 ? 1 : abw >= 0.35 ? 0 : (0.35 - abw) / 0.27;
    const anteil = takte.filter(n => n === TA_SCHLAEGE[ta]).length / takte.length;
    return { b: fuenfer(100 * anteil * Math.min(1, takte.length / 3) * (0.6 + 0.4 * gleich)), erkannt: oft >= 2 && oft <= 4 ? `${oft}/4` : `${oft} Schläge`, gleich: Math.round(gleich * 100), takte: takte.length };
}
function indexBasis(richtig, w) { return { b: Number(w) === richtig ? 100 : 0 }; }
// Mehrere "?": jedes richtige zaehlt anteilig
function mehrBasis(soll, w) {
    const ist = liste(w);
    const n = soll.filter((x, k) => ist[k] === x).length;
    return { b: fuenfer(100 * n / soll.length), n };
}
// Taktstriche: richtige minus falsche, geteilt durch die Zahl der noetigen Striche
function strichBasis(soll, w) {
    const ist = new Set(liste(w)), s = new Set(soll);
    const richtig = [...ist].filter(k => s.has(k)).length, falsch = ist.size - richtig;
    return { b: fuenfer(100 * (richtig - falsch) / s.size), richtig, falsch };
}

/* ---------- Kleinkram ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lesen = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const schreiben = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } };
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const zufall = (n, z) => Array.from({ length: n }, () => z[Math.floor(Math.random() * z.length)]).join('');
const EMOJIS = ['🥁', '🎸', '🎹', '🎺', '🎷', '🎻', '🪇', '🎤', '🦊', '🐼', '🐸', '🦄', '🐙', '🚀', '⚡', '🌈'];
const ABCD = ['A', 'B', 'C', 'D'];
function zeigen(id, an) { $(id).classList.toggle('hidden', !an); }
function toast(text, art) {
    const el = document.createElement('div');
    el.className = 'toast' + (art ? ' ' + art : '');
    el.textContent = text;
    $('toast-bereich').appendChild(el);
    setTimeout(() => el.remove(), 3200);
}
function mischen(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
// n zufaellige aus der Liste, in der urspruenglichen Reihenfolge (leichte Zeilen zuerst)
const ziehen = (arr, n) => mischen(arr.length).slice(0, Math.min(n, arr.length)).sort((a, b) => a - b).map(i => arr[i]);

let zeitVersatz = 0;   // Serverzeit - Geraetezeit
onValue(ref(db, '.info/serverTimeOffset'), s => { zeitVersatz = s.val() || 0; });
const jetzt = () => Date.now() + zeitVersatz;
onValue(ref(db, '.info/connected'), s => {
    const el = $('verbindung');
    el.classList.toggle('an', !!s.val());
    el.title = s.val() ? 'Verbunden' : 'Keine Verbindung';
    // Kind war kurz weg (WLAN, Sperrbildschirm): wieder als verbunden melden
    if (s.val() && sDrin) sPraesenz();   // Callback kommt erst nach dem Laden des Moduls
});

/* ---------- Audio (Klick-Detektiv) ----------
   Safari bleibt stumm, solange der Kontext nicht aus einem Klick heraus
   gestartet wurde - deshalb holt jeder Knopf, der spielt, audio() zuerst. */
let ctx = null, rauschen = null, ausgang = null;   // ausgang: Bus des laufenden Vorspiels
const ziel = (c) => ausgang || c.destination;
function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}
function klick(zeit, betont) {
    const c = audio(), o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.value = betont ? 1760 : 1100;
    g.gain.setValueAtTime(0.0001, zeit);
    g.gain.exponentialRampToValueAtTime(betont ? 0.7 : 0.3, zeit + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.06);
    o.connect(g).connect(ziel(c));
    o.start(zeit); o.stop(zeit + 0.08);
}
function klatsch(zeit, laut = 1) {
    const c = audio();
    if (!rauschen) {
        rauschen = c.createBuffer(1, Math.floor(c.sampleRate * 0.25), c.sampleRate);
        const d = rauschen.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, zeit);
    [0, 0.011, 0.022].forEach(v => {
        g.gain.setValueAtTime(1.4 * laut, zeit + v);
        g.gain.exponentialRampToValueAtTime(0.25 * laut, zeit + v + 0.009);
    });
    g.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.2);
    const q = c.createBufferSource();
    q.buffer = rauschen;
    q.connect(f).connect(g).connect(ziel(c));
    q.start(zeit); q.stop(zeit + 0.25);
}
// Grosse Trommel: Sinus, der schnell nach unten rutscht
function bumm(zeit) {
    const c = audio(), o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, zeit);
    o.frequency.exponentialRampToValueAtTime(45, zeit + 0.18);
    g.gain.setValueAtTime(0.0001, zeit);
    g.gain.exponentialRampToValueAtTime(1, zeit + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.35);
    o.connect(g).connect(ziel(c));
    o.start(zeit); o.stop(zeit + 0.4);
}
// Blaskapelle: Tuba "Umm" auf der 1, Blech-"Pa" auf den anderen Schlaegen
function ton(zeit, frequenzen, typ, laut, dauer) {
    const c = audio(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = typ === 'sawtooth' ? 1800 : 900;
    g.gain.setValueAtTime(0.0001, zeit);
    g.gain.exponentialRampToValueAtTime(laut, zeit + 0.02);
    g.gain.exponentialRampToValueAtTime(laut * 0.6, zeit + dauer * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
    f.connect(g).connect(ziel(c));
    frequenzen.forEach(fr => {
        const o = c.createOscillator();
        o.type = typ; o.frequency.value = fr;
        o.connect(f); o.start(zeit); o.stop(zeit + dauer + 0.02);
    });
}
/* Klick-Detektiv: so viele Takte, dass man die 1 sicher findet, mit
   betonter 1 je nach Klang. onSchlag(i) meldet jeden Schlag fuer das
   Blinken am Beamer - alle Schlaege gleich, sonst verraet das Bild die 1.
   Gibt die Dauer in ms zurueck. */
let vorspielTimer = [];
function klickVorspielen(r, onSchlag, takteFest) {
    vorspielStopp();
    const c = audio(), s = 60 / r.bpm, n = TA_SCHLAEGE[r.ta], takte = takteFest || (n === 2 ? 6 : 4);
    ausgang = c.createGain();
    ausgang.connect(c.destination);
    const t0 = c.currentTime + 0.3, gesamt = n * takte;
    for (let b = 0; b < gesamt; b++) {
        const zeit = t0 + b * s, eins = b % n === 0, takt = Math.floor(b / n);
        if (r.klang === 'schlagzeug') { if (eins) bumm(zeit); else klatsch(zeit, 0.55); }
        else if (r.klang === 'blaskapelle') {
            // D-Dur: Takt fuer Takt Tonika (D) und Dominante (A), der Akkord immer passend zum Tuba-Ton
            const d = takt % 2 === 0;
            if (eins) ton(zeit, [d ? 73.42 : 55], 'triangle', 0.9, s * 0.8);
            else ton(zeit, d ? [293.66, 369.99, 440] : [277.18, 329.63, 440], 'sawtooth', 0.08, s * 0.35);
        } else klick(zeit, eins);
    }
    const versatz = (t0 - c.currentTime) * 1000;
    for (let b = 0; b < gesamt; b++) vorspielTimer.push(setTimeout(() => onSchlag && onSchlag(b), versatz + b * s * 1000));
    const dauer = versatz + gesamt * s * 1000 + 200;
    vorspielTimer.push(setTimeout(() => onSchlag && onSchlag(-1), dauer));
    return dauer;
}
function vorspielStopp() {
    vorspielTimer.forEach(clearTimeout); vorspielTimer = [];
    // schon geplante Toene (Groove beim Eins-Klopfer) verstummen lassen
    if (ausgang && ctx) { const a = ausgang; a.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => a.disconnect(), 400); }
    ausgang = null;
}
// Groove fuer den Eins-Klopfer: so viele Takte, dass er die ganze Runde laeuft
const grooveTakte = (r) => Math.min(96, Math.ceil((L.zeiten.hoeren + L.zeiten.klopf + 15) * r.bpm / 60 / TA_SCHLAEGE[r.ta]));

/* ---------- Hoerbeispiele (nur lokal, IndexedDB) ---------- */
function idb() {
    return new Promise((res, rej) => {
        const r = indexedDB.open('taktarten-challenge', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('hb');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}
async function hbSpeichern(key, wert) {
    const d = await idb();
    await new Promise((res, rej) => {
        const tx = d.transaction('hb', 'readwrite');
        tx.objectStore('hb').put(wert, key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
}
async function hbAlle() {
    try {
        const d = await idb();
        return await new Promise((res) => {
            const aus = {}, st = d.transaction('hb').objectStore('hb');
            const r = st.openCursor();
            r.onsuccess = () => { const c = r.result; if (c) { aus[c.key] = c.value; c.continue(); } else res(aus); };
            r.onerror = () => res(aus);
        });
    } catch (e) { return {}; }
}
/* Eigene Songs liegen im selben Speicher unter Schluesseln "e-xxxxxx"
   (die Songs der Stunde unter 1-14): {blob, name, titel, ta, seit}. */
async function hbAendern(key, felder) {
    const d = await idb();
    await new Promise((res, rej) => {
        const tx = d.transaction('hb', 'readwrite'), st = tx.objectStore('hb');
        const r = st.get(key);
        r.onsuccess = () => { if (r.result) st.put(Object.assign(r.result, felder), key); };
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
}
async function hbLoeschen(key) {
    const d = await idb();
    await new Promise((res, rej) => {
        const tx = d.transaction('hb', 'readwrite');
        tx.objectStore('hb').delete(key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
}
// Abgewaehlte Songs (Schluessel als Text), lokal gemerkt
// Songs der Stunde kennen die Kinder schon - fuer die Ueberpruefung standardmaessig aus
const hbAus = () => new Set(lesen('ta-hb-aus', SONGS.map(x => String(x.hb))));
function hbAusSetzen(key, aus) {
    const s = hbAus();
    if (aus) s.add(String(key)); else s.delete(String(key));
    schreiben('ta-hb-aus', [...s]);
}

/* ============================================================
   LEHRKRAFT
   ============================================================ */
const L = {
    code: null, spiel: null, plan: [], pos: -1, phase: 'lobby',
    gesamt: {}, spieler: {}, antw: {}, entfernt: {},
    zeiten: Object.assign({}, ZEIT_STANDARD, lesen('ta-zeiten', {})),
    auto: lesen('ta-auto', true),
    start: 0, dauer: 0, letzte: null, hb: {}, hbUrl: {}
};
let lSpielerAbo = null, lAntwAbo = null, lTimer = null, lEndeGeplant = null;
const song = new Audio();
song.preload = 'auto';

function lSichern() {
    schreiben('ta-lehrer', { code: L.code, spiel: L.spiel, plan: L.plan, pos: L.pos, phase: L.phase, gesamt: L.gesamt, entfernt: L.entfernt, letzte: L.letzte, start: L.start, dauer: L.dauer, zeit: Date.now() });
}

/* Spielart: 'alle' = ganze Challenge (Teile per Haekchen, Rundenzahl je Teil
   fest, nur die Songs einstellbar) oder 'einzeln' = nur ein Teil mit
   waehlbarer Rundenzahl (ta-einzeln = Teil, ta-runden = Runden, 99 = alle). */
const modus = () => lesen('ta-modus', 'alle');
const einzelTeil = () => lesen('ta-einzeln', 'hoer');
const RUNDEN_STUFEN = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 99];
const SONG_STUFEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 99];
const einzelRunden = () => lesen('ta-runden', 8);
const songZahl = () => lesen('ta-songzahl', 5);
const teileAn = () => lesen('ta-bloecke', TEILE);

// Pool fuer das Hoerquiz: angehakte Songs der Stunde (auch ohne geladene Datei - dann ueber die Folie) und angehakte eigene mit Taktart
function songPool() {
    const aus = hbAus();
    const fest = SONGS.filter(s => !aus.has(String(s.hb))).map(s => ({ hb: s.hb, titel: s.titel, ta: s.ta, quelle: s.quelle }));
    const eigene = eigeneSongs().filter(([k, v]) => !aus.has(k) && TA.includes(v.ta))
        .map(([k, v]) => ({ hb: k, titel: v.titel || v.name, ta: v.ta, quelle: 'eigener Song' }));
    return fest.concat(eigene);
}

function teilRunden(teil, n, ohne) {
    if (teil === 'hoer' || teil === 'klopf') {
        const pool = songPool().filter(x => !(ohne || new Set()).has(String(x.hb)));
        const songs = mischen(pool.length).slice(0, Math.min(n, pool.length)).map(i => Object.assign({ art: teil }, pool[i]));
        if (teil === 'hoer') return songs;
        // Fehlen Songs, spielt das Spiel selbst einen Groove (Taktart, Klang, Tempo zufaellig)
        const k = Object.keys(KLAENGE), ta = mischen(3).concat(mischen(3), mischen(3), mischen(3), mischen(3)).map(i => TA[i]);
        for (let i = songs.length; i < Math.min(n, 15); i++) {
            songs.push({ art: 'klopf', titel: `Groove: ${KLAENGE[k[i % k.length]]}`, ta: ta[i], klang: k[i % k.length], bpm: 84 + 4 * Math.floor(Math.random() * 10), quelle: 'Groove' });
        }
        return songs;
    }
    if (teil === 'klick') {
        // Jede Taktart kommt dran, Klaenge reihum, Tempo zufaellig 80-140
        const k = Object.keys(KLAENGE), ta = [];
        n = Math.min(n, 30);   // "alle" gibt es hier nicht - die Runden sind ausgedacht
        while (ta.length < n) mischen(3).forEach(i => ta.push(TA[i]));
        const start = Math.floor(Math.random() * k.length);
        return ta.slice(0, n).map((t, i) => ({ art: 'klick', ta: t, klang: k[(start + i) % k.length], bpm: 80 + 4 * Math.floor(Math.random() * 16) }));
    }
    if (teil === 'takt') {
        // Erst Zeilen mit einer Taktart, dann die Profi-Zeilen mit Wechsel
        const einfach = TAKT.filter(x => x.t), profi = TAKT.filter(x => x.w);
        const np = Math.min(profi.length, Math.floor(n / 2)), ne = Math.min(einfach.length, n - np);
        return ziehen(einfach, ne).concat(ziehen(profi, Math.min(profi.length, n - ne))).map(x => {
            const w = x.w || x.b.map(() => x.t);
            const zeig = x.w ? x.w.map((t, i) => (x.f.includes(i) ? '?' : t)) : x.b.map((_, i) => (i === 0 ? '?' : ''));
            return { art: 'takt', b: x.b, w, zeig, profi: !!x.w };
        });
    }
    if (teil === 'strich') {
        return ziehen(STRICH, n).map(x => {
            const c = [], soll = [];
            x.b.forEach((takt, i) => { takt.split('-').forEach(k => c.push(k)); if (i < x.b.length - 1) soll.push(c.length - 1); });
            return { art: 'strich', t: x.t, c, soll };
        });
    }
    if (teil === 'luecke') {
        return ziehen(LUECKE, n).map(x => {
            const soll = [];
            x.b.forEach(takt => takt.split('-').forEach(k => { if (k.startsWith('?')) soll.push(k.slice(1)); }));
            return { art: 'luecke', t: x.t, b: x.b, soll };
        });
    }
    if (teil === 'kobold') {
        return ziehen(KOBOLD, n).map(x => ({ art: 'kobold', t: x.t, b: x.b, falsch: x.f, schlaege: taktDauer(x.b[x.f]) }));
    }
    return mischen(QUIZ.length).slice(0, Math.min(n, QUIZ.length)).map(i => {
        const q = QUIZ[i], ord = mischen(q.antworten.length);
        return { art: 'quiz', frage: q.frage, antworten: ord.map(k => q.antworten[k]), richtig: ord.indexOf(0) };
    });
}
function planBauen() {
    const an = modus() === 'einzeln' ? [einzelTeil()] : TEILE.filter(t => teileAn().includes(t));
    const plan = [];
    an.forEach(teil => {
        const n = modus() === 'einzeln' ? einzelRunden() : teil === 'hoer' ? songZahl() : TEIL_INFO[teil].runden;
        // Eins-Klopfer nimmt Songs, die nicht schon im Hoerquiz dran waren
        const runden = teilRunden(teil, n, new Set(plan.filter(r => r.art === 'hoer').map(r => String(r.hb))));
        if (!runden.length) return;
        plan.push({ art: 'teil', teil });
        runden.forEach((r, i) => plan.push(Object.assign(r, { k: i + 1, n: runden.length })));
    });
    return plan;
}
const spielRunden = () => L.plan.filter(r => r.art !== 'teil');
function rundenNr(pos) { return L.plan.slice(0, pos + 1).filter(r => r.art !== 'teil').length; }

function lModusZeigen() {
    const m = modus(), an = teileAn(), einzeln = einzelTeil();
    document.querySelectorAll('[data-modus]').forEach(b => b.classList.toggle('an', b.dataset.modus === m));
    $('l-bloecke').innerHTML = TEILE.map(t => {
        const i = TEIL_INFO[t];
        const anzahl = t === 'hoer' ? 'Songs aus dem Pool' : `${i.runden} Runden`;
        return `<label class="block-wahl"><input type="${m === 'einzeln' ? 'radio' : 'checkbox'}" name="teil" data-block="${t}" ${(m === 'einzeln' ? einzeln === t : an.includes(t)) ? 'checked' : ''}>
            <span><b><i class="fa-solid ${i.icon}"></i> ${esc(i.name)}</b><small>${esc(i.folie)}${m === 'einzeln' ? '' : ' · ' + anzahl} – ${esc(i.text)}</small></span></label>`;
    }).join('');
    $('l-modus-info').textContent = m === 'einzeln'
        ? 'Nur ein Teil: wähle den Teil und darunter, wie viele Runden.'
        : 'Raum öffnen, die Klasse scannt den QR-Code und gibt ihren Namen ein. Danach die angehakten Teile nacheinander:';
    lRundenwahlZeigen();
}
function lRundenwahlZeigen() {
    const m = modus();
    let info;
    if (m === 'einzeln') {
        const t = einzelTeil(), n = einzelRunden(), r = teilRunden(t, n);
        $('l-zahl-name').textContent = 'Runden';
        $('l-zahl-wert').textContent = n >= 99 ? 'alle' : n;
        info = `= ${r.length} Runden ${esc(TEIL_INFO[t].name)}` + (n < 99 && r.length < n ? ` – nur ${r.length} vorhanden` : '');
    } else {
        const n = songZahl(), pool = songPool().length;
        $('l-zahl-name').textContent = 'Songs im Hörquiz';
        $('l-zahl-wert').textContent = n >= 99 ? 'alle' : n;
        const gesamt = TEILE.filter(t => teileAn().includes(t)).reduce((s, t) => s + (t === 'hoer' ? Math.min(n, pool) : teilRunden(t, TEIL_INFO[t].runden).length), 0);
        info = `= ${Math.min(n, pool)} von ${pool} Songs im Pool · ${gesamt} Runden insgesamt` + (pool ? '' : ' – fürs Hörquiz unten neue Songs hinzufügen (sonst fällt es weg)');
    }
    $('l-zahl-info').textContent = info;
}

function regelnHtml() {
    return `<ul class="regel-liste">
        <li><b>Hörquiz, Klick-Detektiv, Kobold, Millionär:</b> richtig = 100 Punkte.</li>
        <li><b>Eins-Klopfer:</b> jeder Takt mit der richtigen Zahl an Schlägen zählt, gleichmäßiges Klopfen gibt den Rest (alles richtig und gleichmäßig = 100, ab 3 Takten).</li>
        <li><b>Taktart eintragen, fehlende Note:</b> jedes richtige „?“ zählt anteilig (2 von 4 richtig = 50).</li>
        <li><b>Taktstriche:</b> richtige Striche minus falsche, geteilt durch die nötigen Striche (alle richtig = 100).</li>
        <li><b>Platzbonus:</b> Die ersten fünf, die mit mindestens 60 Punkten abgeben, bekommen +50 / +40 / +30 / +20 / +10.</li>
    </ul>`;
}

const eigeneSongs = () => Object.entries(L.hb).filter(([k]) => String(k).startsWith('e-'))
    .sort((a, b) => (a[1].seit || 0) - (b[1].seit || 0));
async function lHbAnzeigen() {
    L.hb = await hbAlle();
    Object.values(L.hbUrl).forEach(u => URL.revokeObjectURL(u));
    L.hbUrl = {};
    Object.entries(L.hb).forEach(([k, v]) => { L.hbUrl[k] = URL.createObjectURL(v.blob); });
    const aus = hbAus();
    $('l-hb-liste').innerHTML = SONGS.map(s => {
        const da = !!L.hb[s.hb];
        return `<label class="hb ${da ? 'da' : ''}" title="${da ? 'geladen' : 'nicht geladen – dann über die Folie abspielen'}">
            <input type="checkbox" data-hb-an="${s.hb}" ${aus.has(String(s.hb)) ? '' : 'checked'}>
            <i class="fa-solid ${da ? 'fa-circle-check' : 'fa-circle'}"></i> ${esc(s.titel)} <small>${s.ta} · ${esc(s.quelle)}</small></label>`;
    }).join('');
    lEigeneZeigen();
}
function lEigeneZeigen() {
    const aus = hbAus(), eigene = eigeneSongs();
    $('l-eigene-liste').innerHTML = eigene.length ? eigene.map(([k, v]) => `<div class="eigene-zeile" data-eigen="${esc(k)}">
            <input type="checkbox" data-hb-an="${esc(k)}" ${aus.has(k) ? '' : 'checked'} title="Kommt im Spiel vor">
            <button type="button" class="btn klein" data-hoeren="${esc(k)}" title="Vorhören"><i class="fa-solid ${song.dataset.key === k && !song.paused ? 'fa-pause' : 'fa-play'}"></i></button>
            <input type="text" class="feld titel" data-feld="titel" value="${esc(v.titel || '')}" placeholder="Interpret: Titel" maxlength="60">
            <select class="feld" data-feld="ta"><option value="">Taktart?</option>${TA.map(t => `<option ${v.ta === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <button type="button" class="btn klein" data-loeschen="${esc(k)}" title="Song entfernen"><i class="fa-solid fa-trash"></i></button>
            ${TA.includes(v.ta) ? '' : '<span class="eigene-info"><span class="warnung">Taktart fehlt – kommt sonst nicht ins Spiel</span></span>'}
        </div>`).join('') : '<p class="hinweis klein" style="margin:.4rem 0 0;">Noch keine eigenen Songs.</p>';
    lRundenwahlZeigen();   // Pool-Groesse haengt an Haekchen und Taktart
}
async function lEigeneHinzufuegen(dateien) {
    let n = 0;
    for (const d of dateien) {
        const key = 'e-' + zufall(8, 'abcdefghijkmnpqrstuvwxyz23456789');
        // Taktart aus dem Dateinamen ("… 3-4 c+.mp3"), Titel ohne Endung, Klammern, "c+" und Taktart
        const m = d.name.match(/(?:^|[^0-9])([234])\s*[-\/_]\s*4(?![0-9])/);
        const ta = m ? `${m[1]}/4` : '';
        const titel = d.name.replace(/\.[a-z0-9]+$/i, '').replace(/[\(\[][^\)\]]*[\)\]]/g, '').replace(/\bc\+/g, '')
            .replace(/[\s_-]*[234]\s*[-\/]\s*4(?![0-9])/g, '').replace(/^\d{1,2}[\s._-]+/, '')
            .replace(/[\s_-]+$/, '').replace(/_/g, ' ').replace(/\s+-\s+/, ': ').replace(/\s+/g, ' ').trim().slice(0, 60);
        await hbSpeichern(key, { blob: d, name: d.name, titel, ta, seit: Date.now() });
        n++;
    }
    await lHbAnzeigen();
    toast(`${n} Song${n === 1 ? '' : 's'} hinzugefügt – Taktart prüfen!`);
}
function lEigeneEreignis(e) {
    const hoeren = e.target.closest('[data-hoeren]');
    if (hoeren) {
        const k = hoeren.dataset.hoeren;
        if (song.dataset.key === k && !song.paused) song.pause();
        else { songLaden(k, L.hbUrl[k]); song.play().catch(() => { }); }
        setTimeout(lEigeneZeigen, 50);
        return;
    }
    const loeschen = e.target.closest('[data-loeschen]');
    if (loeschen && confirm('Diesen Song aus der Liste entfernen?')) {
        const k = loeschen.dataset.loeschen;
        if (song.dataset.key === k) song.pause();
        hbLoeschen(k).then(lHbAnzeigen);
    }
}
// Dateien aus dem Ordner "Hoerbeispiele" den Songs der Stunde zuordnen (Dateiname), den Rest ueberspringen
async function lHbWaehlen(dateien) {
    let n = 0;
    const uebrig = [];
    for (const d of dateien) {
        const name = d.name.toLowerCase().trim();
        const s = SONGS.find(x => x.such.test(name));
        if (s) { await hbSpeichern(s.hb, { blob: d, name: d.name }); n++; } else uebrig.push(d.name);
    }
    await lHbAnzeigen();
    toast(`${n} Hörbeispiel${n === 1 ? '' : 'e'} gespeichert` + (uebrig.length ? ` · ${uebrig.length} übersprungen (z. B. Tanz-Songs) – die gehen als „Eigene Songs“` : ''));
}

function qrMalen(feld, url, groesse) {
    $(feld).innerHTML = '';
    new QRCode($(feld), { text: url, width: groesse, height: groesse, correctLevel: QRCode.CorrectLevel.M });
}
const schuelerUrl = () => `${location.origin}${location.pathname}?raum=${L.code}`;

async function lRaumOeffnen(weiter) {
    audio();
    if (weiter) {
        Object.assign(L, weiter);
    } else {
        // Ein vergessener Raum (nicht "Schliessen" gedrueckt) bliebe sonst fuer immer in der Datenbank
        const alt = lesen('ta-lehrer', null);
        if (alt && alt.code) remove(ref(db, pfad(alt.code))).catch(() => { });
        L.code = zufall(4, CODE_ZEICHEN);
        L.spiel = zufall(4, CODE_ZEICHEN);
        L.plan = planBauen();
        if (!spielRunden().length) { toast('Bitte mindestens einen Teil wählen (Hörquiz: Songs anhaken)', 'fehler'); return; }
        L.pos = -1; L.phase = 'lobby'; L.gesamt = {}; L.entfernt = {}; L.letzte = null;
    }
    try {
        await update(ref(db, pfad(L.code, 'lehrer')), { phase: L.phase, nr: L.pos, anzahl: spielRunden().length, spiel: L.spiel, entfernt: L.entfernt });
    } catch (e) {
        toast('Keine Verbindung zur Datenbank – Raum nicht geöffnet', 'fehler');
        return;
    }
    lSichern();
    zeigen('l-start', false); zeigen('l-raum', true);
    $('l-code').textContent = L.code;
    qrMalen('l-qr', schuelerUrl(), 520);
    $('l-url').textContent = schuelerUrl().replace(/^https?:\/\//, '');
    lZeitenZeigen();
    if (lSpielerAbo) lSpielerAbo();
    lSpielerAbo = onValue(ref(db, pfad(L.code, 'spieler')), s => {
        L.spieler = s.val() || {};
        // Entfernte bleiben draussen - ausser sie sind danach bewusst neu beigetreten (seit > Zeitpunkt des Entfernens)
        Object.keys(L.entfernt).forEach(id => {
            const sp = L.spieler[id], t = L.entfernt[id];
            if (sp && sp.name && typeof t === 'number' && sp.seit > t) {
                delete L.entfernt[id];
                update(ref(db, pfad(L.code, 'lehrer/entfernt')), { [id]: null }).catch(() => { });
                lSichern();
            } else delete L.spieler[id];
        });
        // Reste ohne Namen (z. B. ein spaetes onDisconnect nach dem Entfernen) ignorieren
        Object.keys(L.spieler).forEach(id => { if (!L.spieler[id] || !L.spieler[id].name) delete L.spieler[id]; });
        lSpielerZeigen();
        lAbgabeZeigen();
        if ($('l-spieler-dialog').open) lSpielerListe();
        if (L.phase === 'aufl' || L.phase === 'ende') lZeichnen();
    });
    if (L.phase === 'frage' && L.pos >= 0) lAntwortenAbo();
    lZeichnen();
}

// on === false: Geraet hat die Verbindung verloren (onDisconnect beim Kind)
const istWeg = (id) => L.spieler[id] && L.spieler[id].on === false;
const aktive = () => Object.keys(L.spieler).filter(id => !istWeg(id));
function lSpielerZeigen() {
    const ids = Object.keys(L.spieler), weg = ids.filter(istWeg).length;
    $('l-anzahl').textContent = ids.length ? `${ids.length} dabei${weg ? ` · ${weg} ohne Verbindung` : ''}` : 'Noch niemand da …';
    $('l-namen').innerHTML = ids.map(id => `<button type="button" class="name ${istWeg(id) ? 'weg' : ''}" data-raus="${esc(id)}" title="${istWeg(id) ? 'Keine Verbindung · ' : ''}Antippen zum Entfernen">${esc(L.spieler[id].emoji)} ${esc(L.spieler[id].name)}</button>`).join('');
    $('l-spieler-zahl').textContent = ids.length;
    $('l-weg-zahl').textContent = weg ? `${weg} weg` : '';
    zeigen('l-weg-zahl', weg > 0);
}
// Ein Schreibvorgang fuer alle: aus spieler loeschen und in lehrer/entfernt eintragen
async function lEntfernen(ids, frage = true) {
    ids = ids.filter(id => L.spieler[id]);
    if (!ids.length) return;
    const namen = ids.map(id => L.spieler[id].name);
    if (frage && !confirm(ids.length === 1 ? `${namen[0]} aus dem Raum entfernen?` : `${ids.length} Kinder entfernen?\n${namen.join(', ')}`)) return;
    const u = {};
    const t = jetzt();
    ids.forEach(id => { u[`spieler/${id}`] = null; u[`lehrer/entfernt/${id}`] = t; L.entfernt[id] = t; delete L.spieler[id]; });
    try { await update(ref(db, pfad(L.code)), u); } catch (e) { toast('Entfernen hat nicht geklappt', 'fehler'); return; }
    lSichern();
    lSpielerZeigen(); lAbgabeZeigen();
    if ($('l-spieler-dialog').open) lSpielerListe();
    lAlleFertigPruefen();
}
function lSpielerListe() {
    const ids = Object.keys(L.spieler).sort((a, b) => (istWeg(b) - istWeg(a)) || L.spieler[a].name.localeCompare(L.spieler[b].name, 'de'));
    const gewaehlt = new Set([...document.querySelectorAll('[data-wahl]:checked')].map(c => c.dataset.wahl));
    $('l-spieler-liste').innerHTML = ids.length ? ids.map(id => `<label class="spieler-zeile ${istWeg(id) ? 'weg' : ''}">
        <input type="checkbox" data-wahl="${esc(id)}" ${gewaehlt.has(id) ? 'checked' : ''}>
        <span class="punkt-status" title="${istWeg(id) ? 'keine Verbindung' : 'verbunden'}"></span>
        <span class="n">${esc(L.spieler[id].emoji)} ${esc(L.spieler[id].name)}</span>
        <span class="p">${L.gesamt[id] || 0} Pkt</span>
        <button type="button" class="btn klein" data-raus-sofort="${esc(id)}" title="Sofort entfernen"><i class="fa-solid fa-xmark"></i></button>
    </label>`).join('') : '<p class="hinweis">Niemand im Raum.</p>';
    lWahlZaehlen();
}
function lWahlZaehlen() {
    const n = document.querySelectorAll('[data-wahl]:checked').length;
    $('l-raus-btn').disabled = !n;
    $('l-raus-btn').innerHTML = `<i class="fa-solid fa-user-xmark"></i> ${n ? n + ' ' : ''}Ausgewählte entfernen`;
}
function lSpielerDialog() {
    lSpielerListe();
    if (!$('l-spieler-dialog').open) $('l-spieler-dialog').showModal();
}
// Haben alle verbundenen Kinder abgegeben? Dann Runde aufloesen (auch nach dem Entfernen) -
// nur mit "Auto weiter", sonst loest die Lehrkraft selbst auf
function lAlleFertigPruefen() {
    const ids = aktive();
    if (L.auto && L.phase === 'frage' && ids.length && ids.every(id => L.antw[id]) && !lEndeGeplant) {
        lEndeGeplant = setTimeout(() => { lEndeGeplant = null; if (L.phase === 'frage') lAufloesen(); }, 900);
    }
}

function lAutoKnopf() {
    const b = $('l-auto-btn');
    b.classList.toggle('an', L.auto);
    b.setAttribute('aria-pressed', L.auto);
    b.innerHTML = `<i class="fa-solid ${L.auto ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> Auto weiter`;
}

function lAntwortenAbo() {
    if (lAntwAbo) lAntwAbo();
    L.antw = {};
    lAntwAbo = onValue(ref(db, pfad(L.code, `antw/${L.spiel}_${L.pos}`)), s => {
        L.antw = s.val() || {};
        Object.keys(L.entfernt).forEach(id => delete L.antw[id]);
        lAbgabeZeigen();
        lAlleFertigPruefen();
    });
}
function lAbgabeZeigen() {
    if (L.phase !== 'frage') return;
    // Kinder ohne Verbindung zaehlen nicht mit - auf sie wartet die Runde nicht
    const ids = Object.keys(L.spieler), mit = aktive(), fertig = mit.filter(id => L.antw[id]), weg = ids.length - mit.length;
    $('l-abgabe-text').textContent = `${fertig.length} / ${mit.length} abgegeben${weg ? ` · ${weg} ohne Verbindung` : ''}`;
    $('l-abgabe-balken').style.width = mit.length ? `${fertig.length / mit.length * 100}%` : '0';
    $('l-abgabe-namen').innerHTML = ids.map(id => `<button type="button" class="name ${istWeg(id) ? 'weg' : L.antw[id] ? 'fertig' : 'offen'}" data-raus="${esc(id)}" title="${istWeg(id) ? 'Keine Verbindung · ' : ''}Antippen zum Entfernen">${esc(L.spieler[id].emoji)} ${esc(L.spieler[id].name)}</button>`).join('');
}

/* ---------- Ablauf ---------- */
// Was die Kinder sehen duerfen - ohne Loesung
function aufgabeVon(r) {
    if (r.art === 'hoer' || r.art === 'klopf') return { k: r.k, n: r.n };
    if (r.art === 'klick') return { klang: KLAENGE[r.klang], bpm: r.bpm };
    if (r.art === 'takt') return { b: r.b, zeig: r.zeig };
    if (r.art === 'strich') return { t: r.t, c: r.c.join('-') };
    if (r.art === 'luecke') return { t: r.t, b: r.b.map(takt => takt.split('-').map(c => (c.startsWith('?') ? '?' : c)).join('-')) };
    if (r.art === 'kobold') return { t: r.t, b: r.b };
    return { frage: r.frage, antworten: r.antworten };
}
// Rundenobjekt fuer zeileHtml aus der oeffentlichen Aufgabe (Kind) - Luecken als "?V" mit Platzhalter
function rundeAusAufgabe(art, a) {
    if (art === 'takt') return { art, b: a.b || [], zeig: a.zeig || [], w: [] };
    if (art === 'strich') return { art, t: a.t, c: String(a.c || '').split('-') };
    if (art === 'luecke') return { art, t: a.t, b: (a.b || []).map(takt => takt.replace(/\?/g, '?V')) };
    return { art, t: a.t, b: a.b || [] };
}

async function lGeheZu(pos) {
    clearTimeout(lEndeGeplant); lEndeGeplant = null;
    vorspielStopp(); songStopp();
    if (pos >= L.plan.length) return lEnde();
    L.pos = pos;
    const r = L.plan[pos];
    if (r.art === 'teil') {
        L.phase = 'teil';
        await update(ref(db, pfad(L.code, 'lehrer')), { phase: 'teil', nr: pos, art: r.teil, aufgabe: null, loesung: null, wertung: null, spieltBis: null, start: null, dauer: null });
        lSichern();
        return lZeichnen();
    }
    L.phase = 'frage';
    L.dauer = L.zeiten[r.art];
    lAntwortenAbo();
    // Song noch im Klick starten - Safari blockt play() nach einem await
    if ((r.art === 'hoer' || r.art === 'klopf') && r.hb) songStart(r.hb);
    if (r.art === 'klopf' && !r.hb) klickVorspielen(r, null, grooveTakte(r));
    // Erst zuhoeren: Hoerquiz ein paar Sekunden, Klick-Detektiv bis das Vorspiel vorbei ist
    let spieltBis = null;
    if ((r.art === 'hoer' || r.art === 'klopf') && L.zeiten.hoeren > 0) spieltBis = jetzt() + L.zeiten.hoeren * 1000;
    if (r.art === 'klick') spieltBis = jetzt() + klickVorspielen(r, lSchlagZeigen);
    L.start = spieltBis || jetzt();
    await update(ref(db, pfad(L.code, 'lehrer')), {
        phase: 'frage', nr: pos, rundeNr: rundenNr(pos), art: r.art, aufgabe: aufgabeVon(r), loesung: null, wertung: null,
        start: L.start, dauer: L.dauer, spieltBis
    });
    lSichern();
    lZeichnen();
}
async function lNochmalVorspielen() {
    const r = L.plan[L.pos];
    if (!r || r.art !== 'klick' || L.phase !== 'frage') return;
    const bis = jetzt() + klickVorspielen(r, lSchlagZeigen);
    // Zeit verlaengert sich um das erneute Vorspielen
    L.start = Math.max(L.start, bis);
    await update(ref(db, pfad(L.code, 'lehrer')), { spieltBis: bis, start: L.start });
    lSichern();
}
// Blinken im Takt der Klicks - jeder Schlag gleich, damit man die 1 nur hoert
function lSchlagZeigen(i) {
    const el = $('l-blink');
    if (!el) return;
    el.classList.remove('an'); void el.offsetWidth;
    if (i >= 0) el.classList.add('an');
    const st = $('l-klick-status');
    if (st) st.innerHTML = i >= 0 ? '<i class="fa-solid fa-ear-listen"></i> Hört genau hin …' : '<i class="fa-solid fa-hand-pointer"></i> Jetzt tippen: welche Taktart?';
}

function basisVon(r, w) {
    if (r.art === 'hoer' || r.art === 'klick') return indexBasis(TA.indexOf(r.ta), w);
    if (r.art === 'klopf') return klopfBasis(r.ta, w);
    if (r.art === 'quiz') return indexBasis(r.richtig, w);
    if (r.art === 'kobold') return indexBasis(r.falsch, w);
    if (r.art === 'takt') return mehrBasis(r.zeig.map((z, i) => (z === '?' ? TA.indexOf(r.w[i]) : null)).filter(x => x !== null), w);
    if (r.art === 'luecke') return mehrBasis(r.soll.map(c => LUECKE_WAHL.indexOf(c)), w);
    return strichBasis(r.soll, w);
}
function loesungVon(r) {
    if (r.art === 'hoer' || r.art === 'klopf') return { ta: r.ta, titel: r.titel };
    if (r.art === 'klick') return { ta: r.ta };
    if (r.art === 'takt') return { w: r.w };
    if (r.art === 'strich') return { soll: r.soll.join(',') };
    if (r.art === 'luecke') return { soll: r.soll };
    if (r.art === 'kobold') return { falsch: r.falsch, schlaege: r.schlaege };
    return { richtig: r.richtig };
}

async function lAufloesen() {
    if (L.phase !== 'frage') return;
    clearTimeout(lEndeGeplant); lEndeGeplant = null;
    vorspielStopp();
    songAusblenden();
    const r = L.plan[L.pos];
    // Antworten noch einmal frisch holen - der Listener kann eine Abgabe der letzten Millisekunden verpassen
    try { const s = await get(ref(db, pfad(L.code, `antw/${L.spiel}_${L.pos}`))); L.antw = s.val() || {}; } catch (e) { /* Listener-Stand nehmen */ }
    Object.keys(L.entfernt).forEach(id => delete L.antw[id]);
    const zeilen = Object.keys(L.antw).map(id => Object.assign({ id, w: L.antw[id].w, t: L.antw[id].t || 0 }, basisVon(r, L.antw[id].w)));
    zeilen.filter(z => z.b >= PUNKTE_BONUS_AB).sort((a, b) => a.t - b.t).forEach((z, i) => { z.x = PUNKTE_PLATZ[i] || 0; z.platz = i + 1; });
    zeilen.forEach(z => {
        z.x = z.x || 0;
        z.p = z.b + z.x;
        L.gesamt[z.id] = (L.gesamt[z.id] || 0) + z.p;
    });
    const plaetze = lPlaetze(), wertung = {};
    Object.keys(L.spieler).forEach(id => {
        const z = zeilen.find(q => q.id === id);
        wertung[id] = { p: z ? z.p : 0, b: z ? z.b : 0, x: z ? z.x : 0, g: L.gesamt[id] || 0, pl: plaetze[id] || 0 };
    });
    const loesung = loesungVon(r);
    L.phase = 'aufl';
    L.letzte = { zeilen, loesung };
    await update(ref(db, pfad(L.code, 'lehrer')), { phase: 'aufl', loesung, wertung, spieltBis: null });
    lSichern();
    lZeichnen();
}
function lPlaetze() {
    const ids = Object.keys(L.spieler);
    const sortiert = ids.slice().sort((a, b) => (L.gesamt[b] || 0) - (L.gesamt[a] || 0));
    const pl = {};
    sortiert.forEach((id, i) => {
        const vorher = sortiert[i - 1];
        pl[id] = i > 0 && (L.gesamt[vorher] || 0) === (L.gesamt[id] || 0) ? pl[vorher] : i + 1;
    });
    return pl;
}
async function lEnde() {
    songStopp(); vorspielStopp();
    L.phase = 'ende';
    const plaetze = lPlaetze(), wertung = {};
    Object.keys(L.spieler).forEach(id => { wertung[id] = { p: 0, b: 0, x: 0, g: L.gesamt[id] || 0, pl: plaetze[id] || 0 }; });
    await update(ref(db, pfad(L.code, 'lehrer')), { phase: 'ende', wertung, aufgabe: null, loesung: null, spieltBis: null });
    lSichern();
    lZeichnen();
}
async function lNochmal() {
    if (!confirm('Neues Spiel mit denselben Namen starten? Die Punkte beginnen wieder bei 0.')) return;
    L.spiel = zufall(4, CODE_ZEICHEN);
    L.plan = planBauen();
    L.gesamt = {}; L.letzte = null; L.pos = -1; L.phase = 'lobby';
    await update(ref(db, pfad(L.code, 'lehrer')), { phase: 'lobby', nr: -1, spiel: L.spiel, anzahl: spielRunden().length, wertung: null, aufgabe: null, loesung: null });
    lSichern();
    lZeichnen();
}
async function lSchliessen() {
    if (!confirm('Raum schließen? Die Kinder fliegen raus, der Spielstand ist weg.')) return;
    songStopp(); vorspielStopp();
    if (lSpielerAbo) lSpielerAbo();
    if (lAntwAbo) lAntwAbo();
    lSpielerAbo = lAntwAbo = null;
    try { await remove(ref(db, pfad(L.code))); } catch (e) { /* egal */ }
    try { localStorage.removeItem('ta-lehrer'); } catch (e) { /* egal */ }
    L.code = null;
    zeigen('l-raum', false); zeigen('l-start', true);
    $('l-weiter-raum-btn').classList.add('hidden');
}

/* ---------- Song am Beamer ---------- */
let songFade = null;
function songStart(hb) {
    songStopp();
    const url = L.hbUrl[hb];
    if (!url) return;
    songLaden(hb, url);
    song.play().catch(() => toast('Song startet nicht – bitte ▶ drücken', 'fehler'));
    lSongKnopf();
}
// Eigene Songs sind meist ganze Titel: ab 0:30 starten, damit kein langes Intro ohne Beat laeuft
function songLaden(key, url) {
    song.src = url;
    song.dataset.key = String(key);
    song.dataset.ab = String(key).startsWith('e-') ? '30' : '0';
    song.volume = 1;
    song.addEventListener('loadedmetadata', () => { if (song.duration > 90) song.currentTime = Number(song.dataset.ab); }, { once: true });
}
const songAnfang = () => (song.duration > 90 ? Number(song.dataset.ab || 0) : 0);
function songStopp() {
    clearInterval(songFade); songFade = null;
    song.pause();
    lSongKnopf();
}
function songAusblenden() {
    if (song.paused) return;
    clearInterval(songFade);
    songFade = setInterval(() => {
        song.volume = Math.max(0, song.volume - 0.08);
        if (song.volume <= 0) songStopp();
    }, 80);
}
function lSongKnopf() {
    const k = $('l-song-btn');
    if (k) k.innerHTML = song.paused ? '<i class="fa-solid fa-play"></i> Song abspielen' : '<i class="fa-solid fa-pause"></i> Pause';
}
song.addEventListener('play', lSongKnopf);
song.addEventListener('pause', lSongKnopf);

/* ---------- Zeichnen (Beamer) ---------- */
function lZeichnen() {
    ['l-lobby', 'l-teil', 'l-runde', 'l-aufl', 'l-ende'].forEach(id => zeigen(id, false));
    lSongsImSpielZeigen();
    const r = L.plan[L.pos];
    const gesamtRunden = spielRunden().length;
    clearInterval(lTimer);
    zeigen('l-timer', false);
    if (L.phase === 'lobby') {
        $('l-phase-info').textContent = `${gesamtRunden} Runden`;
        zeigen('l-lobby', true);
        lSpielerZeigen();
        return;
    }
    if (L.phase === 'ende') {
        $('l-phase-info').textContent = 'Spiel vorbei';
        zeigen('l-ende', true);
        lEndeZeigen();
        return;
    }
    if (L.phase === 'teil') {
        const t = TEIL_INFO[r.teil];
        const n = L.plan.filter(x => x.art === r.teil).length;
        const fehlt = L.plan.filter(x => x.art === r.teil && (x.art === 'hoer' || x.art === 'klopf') && x.hb && !L.hbUrl[x.hb]).length;
        $('l-phase-info').textContent = t.name;
        $('l-teil-inhalt').innerHTML = `<div class="teil-icon"><i class="fa-solid ${t.icon}"></i></div>
            <div class="teil-folie">${esc(t.folie)} · ${n} Runden</div>
            <h2>${esc(t.name)}</h2><p>${esc(t.text)}</p>
            ${fehlt ? `<p class="hinweis warnung"><i class="fa-solid fa-triangle-exclamation"></i> ${fehlt} Hörbeispiel(e) nicht geladen – dann über die Folie abspielen.</p>` : ''}`;
        zeigen('l-teil', true);
        return;
    }
    $('l-phase-info').textContent = `${TEIL_INFO[r.art].name} · Runde ${rundenNr(L.pos)} von ${gesamtRunden}`;
    if (L.phase === 'frage') {
        zeigen('l-runde', true);
        $('l-runde-inhalt').innerHTML = lRundeHtml(r);
        const knoepfe = [];
        if (r.art === 'klopf' && !r.hb) knoepfe.push('<button type="button" class="btn" id="l-groove-neu"><i class="fa-solid fa-backward-step"></i> Groove von vorn</button>');
        if (r.art === 'hoer' || (r.art === 'klopf' && r.hb)) knoepfe.push(`<button type="button" class="btn" id="l-song-btn" ${L.hbUrl[r.hb] ? '' : 'disabled title="Hörbeispiel nicht geladen"'}></button>`,
            `<button type="button" class="btn" id="l-song-neu" ${L.hbUrl[r.hb] ? '' : 'disabled'} title="Song von vorn"><i class="fa-solid fa-backward-step"></i></button>`);
        if (r.art === 'klick') knoepfe.push('<button type="button" class="btn" id="l-vorspielen-btn"><i class="fa-solid fa-repeat"></i> Nochmal vorspielen</button>');
        $('l-runde-knoepfe').innerHTML = knoepfe.join('');
        lSongKnopf();
        lAbgabeZeigen();
        zeigen('l-timer', true);
        const tick = () => {
            const rest = Math.ceil((L.start + L.dauer * 1000 - jetzt()) / 1000);
            const vorspiel = jetzt() < L.start;
            $('l-timer').textContent = vorspiel ? '🎧' : Math.max(0, rest);
            const txt = $('l-hoer-text');
            if (txt) txt.innerHTML = vorspiel ? `🎧 Erst zuhören … Tippen geht in ${Math.ceil((L.start - jetzt()) / 1000)} s los`
                : 'Findet die betonte 1 und zählt bis zur nächsten – dann tippen!';
            $('l-timer').classList.toggle('knapp', !vorspiel && rest <= 5);
            if (!vorspiel && rest <= 0 && L.phase === 'frage') { clearInterval(lTimer); lAufloesen(); }
        };
        tick();
        lTimer = setInterval(tick, 250);
        return;
    }
    if (L.phase === 'aufl') {
        zeigen('l-aufl', true);
        lAufloesungZeigen(r);
        const naechste = L.plan[L.pos + 1];
        $('l-weiter-btn').innerHTML = !naechste ? '<i class="fa-solid fa-trophy"></i> Endstand'
            : naechste.art === 'teil' ? `<i class="fa-solid fa-forward"></i> Weiter: ${esc(TEIL_INFO[naechste.teil].name)}`
                : '<i class="fa-solid fa-forward"></i> Nächste Runde';
        $('l-aufl-knoepfe').innerHTML = r.art === 'klick' ? '<button type="button" class="btn" id="l-aufl-hoeren"><i class="fa-solid fa-volume-high"></i> Nochmal hören</button>'
            : (r.art === 'hoer' || r.art === 'klopf') && L.hbUrl[r.hb] ? '<button type="button" class="btn" id="l-song-btn"></button>' : '';
        lSongKnopf();
    }
}

const AUFTRAG = {
    takt: (r) => r.profi ? 'Profi: Die Taktart wechselt! Welche Taktart gehört vor jeden Takt mit „?“' : 'Welche Taktart gehört an den Anfang?',
    strich: () => 'Wo gehören die Taktstriche hin?',
    luecke: (r) => r.soll.length > 1 ? `Hier fehlen ${r.soll.length} Noten. Welche Notenwerte machen die Takte voll?` : 'Welcher Notenwert macht den Takt voll?',
    kobold: () => '👺 Welchen Takt hat der Notenkobold verhext?'
};
function lRundeHtml(r) {
    const kopf = `<div class="buehne-klein">${esc(TEIL_INFO[r.art].name)} · ${r.k} von ${r.n}</div>`;
    if (r.art === 'hoer') {
        return `<div class="buehne">${kopf}
            <div class="buehne-titel"><i class="fa-solid fa-headphones"></i> Welche Taktart hörst du?</div>
            <div class="puls"><span></span></div>
            <div class="ta-tafel">${TA.map((t, k) => `<span>${t}<small>${TA_ZAEHLEN[k]}</small></span>`).join('')}</div>
            <p class="buehne-text" id="l-hoer-text"></p>
        </div>`;
    }
    if (r.art === 'klopf') {
        return `<div class="buehne">${kopf}
            <div class="buehne-titel"><i class="fa-solid fa-hand-back-fist"></i> Klopft mit!</div>
            <div class="klopf-tafel"><span class="eins">1<small>links</small></span><span class="rest">2 3 4<small>rechts</small></span></div>
            <p class="buehne-text" id="l-hoer-text"></p>
        </div>`;
    }
    if (r.art === 'klick') {
        return `<div class="buehne">${kopf}
            <div class="buehne-titel" id="l-klick-status"><i class="fa-solid fa-ear-listen"></i> Hört genau hin …</div>
            <div class="blink-feld"><span class="blink" id="l-blink">${r.klang === 'blaskapelle' ? '🎺' : r.klang === 'schlagzeug' ? '🥁' : '⏱️'}</span></div>
            <p class="buehne-text">${esc(KLAENGE[r.klang])} · ${r.bpm} bpm – wo ist die betonte 1? Zählt bis zur nächsten!</p>
        </div>`;
    }
    if (r.art === 'quiz') {
        return `<div class="wwm"><div class="wwm-haupt">
            <div class="wwm-frage">${esc(r.frage)}</div>
            <div class="wwm-antworten">${r.antworten.map((a, k) => `<div class="wwm-a"><b>${ABCD[k]}:</b> ${esc(a)}</div>`).join('')}</div>
        </div></div>`;
    }
    return `<div class="buehne">${kopf}<div class="buehne-titel klein">${esc(AUFTRAG[r.art](r))}</div>${zeileHtml(r, { gross: true })}</div>`;
}

function spName(id) {
    const sp = L.spieler[id];
    return sp ? `${esc(sp.emoji)} ${esc(sp.name)}` : '<span class="hinweis">(weg)</span>';
}
// Wie viele haben was getippt - fuer Antworten mit einem Index
function verteilung(optionen, zeilen, richtig) {
    const zahl = optionen.map((_, k) => zeilen.filter(z => Number(z.w) === k).length);
    const max = Math.max(1, ...zahl);
    return `<div class="wwm-antworten verteilung">${optionen.map((a, k) => `<div class="wwm-a ${k === richtig ? 'richtig' : 'falsch'}">
        ${a}<span class="wwm-zahl"><i style="width:${zahl[k] / max * 100}%"></i>${zahl[k]}</span></div>`).join('')}</div>`;
}
function lAufloesungZeigen(r) {
    const { zeilen = [] } = L.letzte || {};
    let kopf;
    if (r.art === 'hoer' || r.art === 'klick' || r.art === 'klopf') {
        const unter = r.art !== 'klick' ? `${esc(r.titel)} <small>${r.quelle === 'Groove' ? r.bpm + ' bpm' : esc(r.quelle || '')}</small>` : `${esc(KLAENGE[r.klang])} · ${r.bpm} bpm`;
        kopf = `<div class="loesung-kopf"><div class="buehne-klein">${unter}</div>
            <div class="riesig">${r.ta}<small>-Takt</small></div><div class="zaehlen">${TA_ZAEHLEN[TA.indexOf(r.ta)].split(' ').map((z, i) => `<b class="${i ? '' : 'eins'}">${z}</b>`).join('')}</div></div>
            ${verteilung(TA.map(t => `<b>${t}</b>`), r.art === 'klopf' ? zeilen.map(z => ({ w: TA.indexOf(z.erkannt) })) : zeilen, TA.indexOf(r.ta))}`;
    } else if (r.art === 'quiz') {
        kopf = `<div class="wwm"><div class="wwm-haupt"><div class="wwm-frage">${esc(r.frage)}</div>
            ${verteilung(r.antworten.map((a, k) => `<b>${ABCD[k]}:</b> ${esc(a)}`), zeilen, r.richtig)}</div></div>`;
    } else {
        const s = { gross: true, loesung: true };
        if (r.art === 'strich') s.soll = r.soll;
        if (r.art === 'luecke') s.soll = r.soll;
        if (r.art === 'kobold') { s.falsch = r.falsch; s.schlaege = r.schlaege; }
        let erkl = '';
        if (r.art === 'kobold') erkl = `${r.t} heißt ${TA_SCHLAEGE[r.t]} Viertel pro Takt – der verhexte Takt hat ${r.schlaege}.`;
        if (r.art === 'strich') erkl = `${r.t}: nach je ${TA_SCHLAEGE[r.t]} Vierteln ein Taktstrich.`;
        if (r.art === 'luecke') erkl = r.soll.map(c => LUECKE_NAME[c]).join(' · ');
        if (r.art === 'takt') erkl = r.b.map(b => `${taktDauer(b)} Viertel`).join(' · ');
        const richtig = zeilen.filter(z => z.b >= 100).length;
        kopf = `<div class="loesung-kopf"><div class="buehne-klein">${esc(TEIL_INFO[r.art].name)} · Lösung</div>${zeileHtml(r, s)}
            <p class="buehne-text">${esc(erkl)}</p><p class="hinweis">${richtig} von ${zeilen.length} alles richtig</p></div>`;
    }
    $('l-loesung').innerHTML = kopf;

    const wert = (z) => {
        if (r.art === 'hoer' || r.art === 'klick') return `${TA[Number(z.w)] || '?'} ${z.b ? '✅' : '❌'}`;
        if (r.art === 'klopf') return z.erkannt ? `${z.erkannt} ${z.erkannt === r.ta ? '✅' : '❌'} <small>${z.gleich} % gleichmäßig</small>` : 'zu wenig Takte';
        if (r.art === 'quiz') return `${ABCD[Number(z.w)] || '?'} ${z.b ? '✅' : '❌'}`;
        if (r.art === 'kobold') return `Takt ${Number(z.w) + 1} ${z.b ? '✅' : '❌'}`;
        if (r.art === 'strich') return `${z.richtig} richtig${z.falsch ? `, ${z.falsch} falsch` : ''}`;
        return `${z.n} von ${r.art === 'takt' ? r.zeig.filter(x => x === '?').length : r.soll.length}`;
    };
    const sortiert = zeilen.slice().sort((a, b) => b.p - a.p || a.t - b.t);
    const ohne = Object.keys(L.spieler).filter(id => !zeilen.find(z => z.id === id));
    $('l-rundenliste').innerHTML = `<ol class="liste">${sortiert.map(z => `<li>
        <span class="n">${spName(z.id)}</span><span class="w">${wert(z)}</span>
        <span class="p">+${z.p}${z.x ? ` <small class="bonus">⚡${z.platz}.</small>` : ''}</span></li>`).join('')}
        ${ohne.map(id => `<li class="leer"><span class="n">${spName(id)}</span><span class="w">–</span><span class="p">0</span></li>`).join('')}</ol>`;
    $('l-gesamtliste').innerHTML = gesamtListe(8);
}
function gesamtListe(max) {
    const pl = lPlaetze();
    const ids = Object.keys(L.spieler).sort((a, b) => pl[a] - pl[b]);
    return `<ol class="liste gesamt">${ids.slice(0, max || ids.length).map(id => `<li><span class="pl">${pl[id]}.</span>
        <span class="n">${spName(id)}</span><span class="p">${L.gesamt[id] || 0}</span></li>`).join('')}</ol>`;
}
function lEndeZeigen() {
    const pl = lPlaetze();
    const ids = Object.keys(L.spieler).sort((a, b) => pl[a] - pl[b]);
    const top = [ids[1], ids[0], ids[2]];
    $('l-podest').innerHTML = top.map((id, k) => id ? `<div class="stufe s${[2, 1, 3][k]}">
        <div class="emoji">${esc(L.spieler[id].emoji)}</div><div class="nm">${esc(L.spieler[id].name)}</div>
        <div class="pk">${L.gesamt[id] || 0}</div><div class="block">${pl[id]}</div></div>` : '<div class="stufe leer"></div>').join('');
    $('l-endliste').innerHTML = gesamtListe();
}

/* ---------- Songs waehrend des Spiels nachlegen ----------
   Liste unter dem Spiel: Songs im Plan (gespielt / laeuft / kommt) und die
   uebrigen aus dem Pool zum Hinzufuegen. Neue Songs kommen ans Ende des
   Hoerquiz; ist das schon vorbei, direkt als naechste Runde. */
function lSongsImSpielZeigen() {
    if (!$('l-songs-im-spiel')) return;
    const imPlan = L.plan.map((r, k) => ({ r, k })).filter(x => x.r.art === 'hoer');
    const drin = new Set(imPlan.map(x => String(x.r.hb)));
    const frei = songPool().filter(s => !drin.has(String(s.hb)));
    const status = (k) => k < L.pos || (k === L.pos && L.phase !== 'frage') ? 'gespielt' : k === L.pos ? 'läuft' : 'kommt';
    $('l-songs-kurz').textContent = `(${imPlan.length} im Spiel · ${frei.length} weitere im Pool)`;
    $('l-songs-im-spiel').innerHTML = `
        <ol class="songs-plan">${imPlan.map(({ r, k }) => `<li class="${status(k)}">
            <span class="n">${esc(r.titel)}</span><span class="w">${r.ta}${L.hbUrl[r.hb] ? '' : ' · nicht geladen'}</span><span class="s">${status(k)}</span></li>`).join('') || '<li class="leer">Kein Hörquiz im Spiel</li>'}</ol>
        <div class="leiste" style="margin:.8rem 0 .4rem;">
            <b>Weitere Songs aus dem Pool</b>
            <button type="button" class="btn btn-primaer klein" data-song-zufall ${frei.length ? '' : 'disabled'}><i class="fa-solid fa-shuffle"></i> + zufälliger Song</button>
        </div>
        <div class="songs-frei">${frei.map(s => `<button type="button" class="btn klein" data-song-dazu="${esc(String(s.hb))}" title="Als nächsten freien Hörquiz-Song einreihen">
            <i class="fa-solid fa-plus"></i> ${esc(s.titel)} <small>${s.ta}</small></button>`).join('') || '<span class="hinweis klein">Alle Songs aus dem Pool sind schon im Spiel. Mehr Songs fügst du auf der Startseite unter „Eigene Songs“ hinzu.</span>'}</div>`;
}
async function lSongEinfuegen(hb) {
    const drin = new Set(L.plan.filter(r => r.art === 'hoer').map(r => String(r.hb)));
    const frei = songPool().filter(s => !drin.has(String(s.hb)));
    const s = hb === null ? frei[Math.floor(Math.random() * frei.length)] : frei.find(x => String(x.hb) === String(hb));
    if (!s) return;
    const runde = Object.assign({ art: 'hoer' }, s);
    const letzte = L.plan.map(r => r.art).lastIndexOf('hoer');
    let wo;
    if (letzte >= 0 && letzte >= L.pos) wo = letzte + 1;                 // Hoerquiz laeuft noch oder kommt noch
    else {
        wo = L.pos + 1;                                                   // Hoerquiz vorbei (oder nie da): direkt als naechste Runde
        if (letzte < 0) { L.plan.splice(wo, 0, { art: 'teil', teil: 'hoer' }); wo++; }
    }
    L.plan.splice(wo, 0, runde);
    // Hoerquiz-Runden neu durchzaehlen ("k von n")
    const hoer = L.plan.filter(r => r.art === 'hoer');
    hoer.forEach((r, i) => { r.k = i + 1; r.n = hoer.length; });
    try { await update(ref(db, pfad(L.code, 'lehrer')), { anzahl: spielRunden().length }); } catch (e) { /* Anzeige bei den Kindern ist nur Kosmetik */ }
    lSichern();
    toast(`„${s.titel}“ kommt als ${L.plan.slice(0, wo + 1).filter(r => r.art !== 'teil').length}. Runde dran`);
    // Laufende Runde nicht neu aufbauen (Song, Timer) - nur Kopfzeile, Liste und ggf. "Weiter"-Knopf
    if (L.phase === 'frage') {
        const r = L.plan[L.pos];
        $('l-phase-info').textContent = `${TEIL_INFO[r.art].name} · Runde ${rundenNr(L.pos)} von ${spielRunden().length}`;
        const kopf = document.querySelector('#l-runde-inhalt .buehne-klein');
        if (kopf && r.art === 'hoer') kopf.textContent = `${TEIL_INFO.hoer.name} · ${r.k} von ${r.n}`;
        lSongsImSpielZeigen();
    } else lZeichnen();
}

function lZeitenZeigen() {
    const arten = L.plan.length ? TEILE.filter(t => L.plan.some(r => r.art === t)) : TEILE;
    $('l-zeiten').innerHTML = arten.map(a => `<span class="stufen"><span class="stufen-name">${esc(TEIL_INFO[a].name)}</span>
        <button type="button" class="btn" data-zeit="${a}:-5">−</button><span class="stufen-wert">${L.zeiten[a]} s</span>
        <button type="button" class="btn" data-zeit="${a}:5">+</button></span>`).join('')
        + (arten.includes('hoer') || arten.includes('klopf') ? `<span class="stufen" title="So lange läuft der Song im Hörquiz, bevor die Kinder tippen können"><span class="stufen-name">Erst zuhören</span>
        <button type="button" class="btn" data-zeit="hoeren:-5">−</button><span class="stufen-wert">${L.zeiten.hoeren} s</span>
        <button type="button" class="btn" data-zeit="hoeren:5">+</button></span>` : '');
}

function vollbild() {
    const d = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else if (d.requestFullscreen) d.requestFullscreen().catch(() => toast('Vollbild ging nicht – im Browser-Menü „Vollbild“ wählen', 'fehler'));
    else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen();
}

function planText(r) {
    if (r.art === 'hoer' || r.art === 'klopf') return `${r.titel} (${r.ta}${r.bpm ? ' · ' + r.bpm + ' bpm' : ''})`;
    if (r.art === 'klick') return `${KLAENGE[r.klang]} · ${r.ta} · ${r.bpm} bpm`;
    if (r.art === 'quiz') return r.frage;
    if (r.art === 'takt') return `${r.profi ? 'Profi: ' : ''}${r.w.join(' · ')}`;
    return `${r.t} · ${(r.b || []).length || r.soll.length + 1} Takte`;
}

function lehrerStart() {
    zeigen('lehrer', true);
    $('l-regeln').innerHTML = regelnHtml();
    lModusZeigen();
    lHbAnzeigen();
    lZeitenZeigen();
    lAutoKnopf();
    const alt = lesen('ta-lehrer', null);
    if (alt && alt.code && Date.now() - alt.zeit < 4 * 3600 * 1000) {
        $('l-weiter-raum-btn').classList.remove('hidden');
        $('l-weiter-raum-btn').innerHTML = `<i class="fa-solid fa-rotate-right"></i> Raum ${esc(alt.code)} weiterführen`;
    }
    $('l-hb-datei').addEventListener('change', e => { if (e.target.files.length) lHbWaehlen([...e.target.files]); e.target.value = ''; });
    $('l-eigene-datei').addEventListener('change', e => { if (e.target.files.length) lEigeneHinzufuegen([...e.target.files]); e.target.value = ''; });
    // Haekchen (Song im Spiel ja/nein), Teile, Titel und Taktart eigener Songs sofort speichern
    document.addEventListener('change', e => {
        const an = e.target.closest('[data-hb-an]');
        if (an) { hbAusSetzen(an.dataset.hbAn, !an.checked); lRundenwahlZeigen(); }
        const block = e.target.closest('[data-block]');
        if (block) {
            if (modus() === 'einzeln') schreiben('ta-einzeln', block.dataset.block);
            else schreiben('ta-bloecke', [...document.querySelectorAll('[data-block]')].filter(c => c.checked).map(c => c.dataset.block));
            lRundenwahlZeigen();
        }
        const feld = e.target.closest('.eigene-zeile [data-feld]');
        if (feld) {
            const k = feld.closest('[data-eigen]').dataset.eigen, wert = feld.value.trim();
            hbAendern(k, { [feld.dataset.feld]: wert }).then(() => { L.hb[k][feld.dataset.feld] = wert; if (feld.dataset.feld === 'ta') lEigeneZeigen(); });
        }
        if (e.target.closest('[data-wahl]')) lWahlZaehlen();
    });
    song.addEventListener('ended', () => { if ($('l-start').offsetParent) lEigeneZeigen(); });
    // Tastatur am Beamer-Rechner: F = Vollbild, M = Mitspieler (nicht beim Tippen in ein Feld)
    document.addEventListener('keydown', e => {
        if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); vollbild(); }
        if ((e.key === 'm' || e.key === 'M') && L.code) { e.preventDefault(); lSpielerDialog(); }
    });
    const vollIcon = () => { $('l-voll-btn').innerHTML = `<i class="fa-solid ${document.fullscreenElement || document.webkitFullscreenElement ? 'fa-compress' : 'fa-expand'}"></i>`; };
    document.addEventListener('fullscreenchange', vollIcon);
    document.addEventListener('webkitfullscreenchange', vollIcon);
    $('l-oeffnen-btn').addEventListener('click', () => lRaumOeffnen(null));
    $('l-weiter-raum-btn').addEventListener('click', () => {
        const a = lesen('ta-lehrer', null);
        if (!a) return;
        // Eine unterbrochene Runde startet neu, statt mit abgelaufener Zeit weiterzulaufen
        // (bis dahin kurz die Lobby - deren Stand ist immer gueltig)
        const unterbrochen = a.phase === 'frage';
        lRaumOeffnen({ code: a.code, spiel: a.spiel, plan: a.plan, pos: a.pos, phase: unterbrochen ? 'lobby' : a.phase, gesamt: a.gesamt || {}, entfernt: a.entfernt || {}, letzte: a.letzte, start: a.start, dauer: a.dauer })
            .then(() => { if (unterbrochen && L.code) lGeheZu(a.pos); });
    });
    $('l-start-btn').addEventListener('click', () => {
        if (!Object.keys(L.spieler).length && !confirm('Noch niemand im Raum. Trotzdem starten?')) return;
        audio();
        lGeheZu(0);
    });
    $('l-teil-los').addEventListener('click', () => { audio(); lGeheZu(L.pos + 1); });
    $('l-beenden-btn').addEventListener('click', lAufloesen);
    $('l-weiter-btn').addEventListener('click', () => { audio(); lGeheZu(L.pos + 1); });
    $('l-nochmal-btn').addEventListener('click', lNochmal);
    $('l-schliessen-btn').addEventListener('click', lSchliessen);
    $('l-qr-btn').addEventListener('click', () => {
        qrMalen('l-qr-gross', schuelerUrl(), 640);
        $('l-url-gross').textContent = schuelerUrl().replace(/^https?:\/\//, '');
        $('l-qr-dialog').showModal();
    });
    $('l-plan-btn').addEventListener('click', () => {
        $('l-plan-liste').innerHTML = L.plan.map((r, k) => r.art === 'teil'
            ? `<div class="plan-teil"><i class="fa-solid ${TEIL_INFO[r.teil].icon}"></i> ${esc(TEIL_INFO[r.teil].name)}</div>`
            : `<button type="button" class="btn ${k === L.pos ? 'btn-primaer' : ''}" data-springe="${k}">${rundenNr(k)}. ${esc(planText(r))}</button>`).join('');
        $('l-plan-dialog').showModal();
    });
    document.addEventListener('click', e => {
        const t = e.target.closest('[data-schliessen]');
        if (t) t.closest('dialog').close();
        const sp = e.target.closest('[data-springe]');
        if (sp) { $('l-plan-dialog').close(); audio(); lGeheZu(Number(sp.dataset.springe)); }
        const raus = e.target.closest('[data-raus]');
        if (raus) lEntfernen([raus.dataset.raus]);
        const sofort = e.target.closest('[data-raus-sofort]');
        if (sofort) { e.preventDefault(); lEntfernen([sofort.dataset.rausSofort]); }
        const zf = e.target.closest('[data-zahl]');
        if (zf) {
            const einzeln = modus() === 'einzeln', stufen = einzeln ? RUNDEN_STUFEN : SONG_STUFEN, w = einzeln ? einzelRunden() : songZahl();
            const i = stufen.indexOf(w) >= 0 ? stufen.indexOf(w) : 5;
            schreiben(einzeln ? 'ta-runden' : 'ta-songzahl', stufen[Math.max(0, Math.min(stufen.length - 1, i + Number(zf.dataset.zahl)))]);
            lRundenwahlZeigen();
        }
        const mo = e.target.closest('[data-modus]');
        if (mo) { schreiben('ta-modus', mo.dataset.modus); lModusZeigen(); }
        const dazu = e.target.closest('[data-song-dazu]');
        if (dazu && L.code) lSongEinfuegen(dazu.dataset.songDazu);
        if (e.target.closest('[data-song-zufall]') && L.code) lSongEinfuegen(null);
        if (e.target.closest('#l-spieler-btn')) lSpielerDialog();
        if (e.target.closest('#l-voll-btn')) vollbild();
        if (e.target.closest('#l-auto-btn')) {
            L.auto = !L.auto;
            schreiben('ta-auto', L.auto);
            lAutoKnopf();
            lAlleFertigPruefen();
            if (!L.auto) { clearTimeout(lEndeGeplant); lEndeGeplant = null; }
        }
        if (e.target.closest('#l-wahl-alle')) { document.querySelectorAll('[data-wahl]').forEach(c => { c.checked = true; }); lWahlZaehlen(); }
        if (e.target.closest('#l-wahl-keine')) { document.querySelectorAll('[data-wahl]').forEach(c => { c.checked = false; }); lWahlZaehlen(); }
        if (e.target.closest('#l-wahl-weg')) { document.querySelectorAll('[data-wahl]').forEach(c => { c.checked = istWeg(c.dataset.wahl); }); lWahlZaehlen(); }
        if (e.target.closest('#l-raus-btn')) lEntfernen([...document.querySelectorAll('[data-wahl]:checked')].map(c => c.dataset.wahl));
        if (e.target.closest('[data-hoeren], [data-loeschen]')) lEigeneEreignis(e);
        const z = e.target.closest('[data-zeit]');
        if (z) {
            const [a, d] = z.dataset.zeit.split(':');
            L.zeiten[a] = a === 'hoeren' ? Math.max(0, Math.min(60, L.zeiten[a] + Number(d))) : Math.max(10, Math.min(180, L.zeiten[a] + Number(d)));
            schreiben('ta-zeiten', L.zeiten);
            lZeitenZeigen();
            const r = L.plan[L.pos];
            if (L.phase === 'frage' && r && r.art === a) {
                L.dauer = L.zeiten[a];
                update(ref(db, pfad(L.code, 'lehrer')), { dauer: L.dauer });
                lSichern();
            }
        }
        if (e.target.closest('#l-song-btn')) {
            if (song.paused) {
                const r = L.plan[L.pos];
                if (r && r.hb && song.dataset.key !== String(r.hb) && L.hbUrl[r.hb]) songLaden(r.hb, L.hbUrl[r.hb]);
                song.volume = 1; song.play().catch(() => { });
            } else song.pause();
        }
        if (e.target.closest('#l-song-neu')) { song.currentTime = songAnfang(); song.volume = 1; song.play().catch(() => { }); }
        if (e.target.closest('#l-vorspielen-btn')) lNochmalVorspielen();
        if (e.target.closest('#l-groove-neu')) { const r = L.plan[L.pos]; if (r && r.art === 'klopf') klickVorspielen(r, null, grooveTakte(r)); }
        if (e.target.closest('#l-aufl-hoeren')) {
            const r = L.plan[L.pos];
            if (r && r.art === 'klick') klickVorspielen(r, null);
        }
    });
}

/* ============================================================
   SCHUELER
   ============================================================ */
let sCode = (new URLSearchParams(location.search).get('raum') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
let geraet = lesen('ta-geraet', null);
if (!geraet) { geraet = zufall(10, 'abcdefghijkmnpqrstuvwxyz23456789'); schreiben('ta-geraet', geraet); }
let sEmoji = lesen('ta-emoji', EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
let sLehrerAbo = null, sStand = null, sDrin = false, sTimer = null, sHoerUhr = null;
let sAbgabe = {};            // runde -> eigene Abgabe (fuer Anzeige nach Reload)
let sRundeKey = null;
// Wahl in der laufenden Runde: Liste je "?" (takt, luecke), Set (strich), Zahl (kobold)
let sWahl = null, sAktiv = 0;

function sEmojisZeigen() {
    $('s-emojis').innerHTML = EMOJIS.map(e => `<button type="button" class="${e === sEmoji ? 'an' : ''}" data-emoji="${e}">${e}</button>`).join('');
}
async function sBeitreten() {
    if (!sCode) {
        sCode = $('s-code-eingabe').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (sCode.length < 4) { toast('Bitte den Raumcode eingeben', 'fehler'); return; }
    }
    const name = $('s-name').value.trim().replace(/\s+/g, ' ').slice(0, 12);
    if (!name) { toast('Bitte deinen Namen eingeben', 'fehler'); $('s-name').focus(); return; }
    try {
        const s = await get(ref(db, pfad(sCode, 'lehrer/phase')));
        if (!s.exists()) { toast('Diesen Raum gibt es nicht (mehr).', 'fehler'); return; }
        sBeitrittZeit = jetzt();
        await set(ref(db, pfad(sCode, `spieler/${geraet}`)), { name, emoji: sEmoji, seit: serverTimestamp(), on: true });
        sPraesenz();
    } catch (e) { toast('Keine Verbindung – nochmal versuchen', 'fehler'); return; }
    schreiben('ta-name', name); schreiben('ta-emoji', sEmoji); schreiben('ta-raum', sCode);
    sDrin = true;
    zeigen('s-beitritt', false); zeigen('s-spiel', true);
    sAbgabe = lesen('ta-abgabe-' + sCode, {});
    if (sLehrerAbo) sLehrerAbo();
    sLehrerAbo = onValue(ref(db, pfad(sCode, 'lehrer')), s => {
        const st = s.val();
        if (!st) { sRaus('Der Raum wurde geschlossen.'); return; }
        // entfernt[id] = Zeitpunkt des Entfernens; wer danach neu beitritt, ist wieder dabei
        const e = st.entfernt && st.entfernt[geraet];
        if (e === true || (typeof e === 'number' && e > sBeitrittZeit)) {
            try { localStorage.removeItem('ta-raum'); } catch (x) { /* egal */ }   // kein automatischer Wiederbeitritt
            sRaus('Du wurdest aus dem Raum genommen. Mit „Mitspielen“ kannst du neu beitreten.');
            return;
        }
        sStand = st;
        sZeichnen();
    });
}
/* Anwesenheit: on = true, und Firebase setzt on = false, sobald die
   Verbindung des Geraets abreisst (onDisconnect). Nach einem Wiederverbinden
   erneut melden (Listener auf .info/connected ganz oben). */
let sBeitrittZeit = 0;
function sPraesenz() {
    if (!sCode) return;
    const r = ref(db, pfad(sCode, `spieler/${geraet}/on`));
    onDisconnect(r).set(false).then(() => (sDrin ? set(r, true) : null)).catch(() => { });
}
function sRaus(text) {
    if (sCode) onDisconnect(ref(db, pfad(sCode, `spieler/${geraet}/on`))).cancel().catch(() => { });
    if (sLehrerAbo) sLehrerAbo();
    sLehrerAbo = null; sDrin = false; clearInterval(sTimer); clearInterval(sHoerUhr);
    zeigen('s-spiel', false); zeigen('s-beitritt', true);
    if (text) toast(text, 'fehler');
}

let sLetzteWertung = null;   // waehrend einer Runde ist lehrer.wertung leer - Kopf zeigt den letzten Stand
function sKopf() {
    if (sStand.wertung && sStand.wertung[geraet]) sLetzteWertung = sStand.wertung[geraet];
    if (sStand.phase === 'lobby') sLetzteWertung = null;
    const w = sLetzteWertung;
    const name = lesen('ta-name', '');
    $('s-stand').innerHTML = `<span>${esc(sEmoji)} <b>${esc(name)}</b></span>
        <span>${sStand.phase === 'frage' || sStand.phase === 'aufl' ? `Runde ${sStand.rundeNr || ''}/${sStand.anzahl || ''}` : ''}</span>
        <span id="s-zeit" class="s-zeit"></span>
        <span>${w ? `<b>${w.g}</b> Pkt · ${w.pl}.` : ''}</span>`;
}
function sZeichnen() {
    const st = sStand;
    clearInterval(sTimer); clearInterval(sHoerUhr);
    sKopf();
    const key = `${st.spiel}_${st.nr}`;
    const neu = key !== sRundeKey;
    const box = $('s-inhalt');
    box.className = 'karte s-mitte';
    if (st.phase === 'lobby') {
        box.innerHTML = `<div class="s-gross">Du bist drin! 🎉</div><p class="hinweis">Gleich geht’s los – schau zum Beamer.</p>
            <button type="button" class="link" id="s-anders">Anderen Namen wählen</button>`;
        sRundeKey = key;
        return;
    }
    if (st.phase === 'teil') {
        const t = TEIL_INFO[st.art] || {};
        box.innerHTML = `<div class="teil-icon klein"><i class="fa-solid ${t.icon}"></i></div><div class="s-gross">${esc(t.name)}</div><p class="hinweis">${esc(t.text)}</p>`;
        sRundeKey = key;
        return;
    }
    if (st.phase === 'ende') {
        const w = st.wertung && st.wertung[geraet];
        box.innerHTML = `<div class="s-gross">🏆 Spiel vorbei!</div>
            ${w ? `<div class="s-riesig">${w.pl}. Platz</div><p class="s-mittel">${w.g} Punkte</p>` : ''}
            <p class="hinweis">Danke fürs Mitspielen!</p>`;
        sRundeKey = key;
        return;
    }
    if (st.phase === 'frage') {
        if (neu) { sRundeKey = key; sWahl = null; sAktiv = 0; }
        if (sAbgabe[key] !== undefined) {
            box.innerHTML = `<div class="s-gross">✅ Abgegeben!</div><p class="hinweis">Warte auf die Auflösung …</p>`;
            sZeitTick();
            return;
        }
        if (st.art === 'hoer' || st.art === 'klick') sTaktartKnoepfe();
        else if (st.art === 'klopf') sKlopfZeigen(neu);
        else if (st.art === 'quiz') sQuizZeigen();
        else sNotenZeigen();
        sZeitTick();
        return;
    }
    if (st.phase === 'aufl') {
        sRundeKey = key;
        sErgebnisZeigen(key);
    }
}
function sZeitTick() {
    const st = sStand;
    const tick = () => {
        const el = $('s-zeit');
        if (!el || st.phase !== 'frage') return;
        if (st.spieltBis && jetzt() < st.spieltBis) { el.textContent = '🎧'; return; }
        const rest = Math.max(0, Math.ceil((st.start + st.dauer * 1000 - jetzt()) / 1000));
        el.textContent = `⏱ ${rest}`;
        el.classList.toggle('knapp', rest <= 5);
    };
    tick();
    sTimer = setInterval(tick, 250);
}
async function sAbgeben(w) {
    const st = sStand, key = `${st.spiel}_${st.nr}`;
    if (st.phase !== 'frage' || sAbgabe[key] !== undefined) return;
    if (st.spieltBis && jetzt() < st.spieltBis) return;
    sAbgabe[key] = w;
    schreiben('ta-abgabe-' + sCode, sAbgabe);
    try {
        await set(ref(db, pfad(sCode, `antw/${key}/${geraet}`)), { w, t: serverTimestamp() });
    } catch (e) {
        delete sAbgabe[key];
        toast('Abgabe hat nicht geklappt – nochmal!', 'fehler');
    }
    sZeichnen();
}

/* ----- Hoerquiz und Klick-Detektiv: 2/4, 3/4 oder 4/4 ----- */
function sTaktartKnoepfe() {
    const st = sStand, a = st.aufgabe || {};
    const kopf = st.art === 'hoer' ? `🎧 Hörbeispiel ${a.k || ''} von ${a.n || ''}` : `🕵️ ${esc(a.klang || 'Klick-Detektiv')}`;
    $('s-inhalt').className = 'karte s-mitte s-wwm';
    $('s-inhalt').innerHTML = `<div class="s-klein">${kopf}</div>
        <div class="s-gross" id="s-hoer-status"></div>
        <div class="s-antworten ta-knoepfe">${TA.map((t, k) => `<button type="button" class="wwm-knopf ta f${k}" data-antwort="${k}"><b>${t}</b><small>${TA_ZAEHLEN[k]}</small></button>`).join('')}</div>`;
    // Erst zuhoeren: Knoepfe gesperrt, bis die Lehrkraft-Vorgabe (spieltBis) vorbei ist
    const tick = () => {
        const el = $('s-hoer-status');
        if (!el) return clearInterval(sHoerUhr);
        const rest = st.spieltBis ? Math.ceil((st.spieltBis - jetzt()) / 1000) : 0;
        document.querySelector('.ta-knoepfe').classList.toggle('gesperrt', rest > 0);
        el.textContent = rest > 0 ? `🎧 erst zuhören … ${rest}` : 'Welche Taktart?';
        if (rest <= 0) clearInterval(sHoerUhr);
    };
    sHoerUhr = setInterval(tick, 250);
    tick();
}

/* ----- Eins-Klopfer: zwei Flaechen, links die 1, rechts die anderen Zaehlzeiten ----- */
let sKlopf = [];
function sKlopfText() {
    // Die letzten drei Takte als Zaehlzeiten: "1 2 3 | 1 2 3 | 1 2"
    const ab = sKlopf.findIndex(x => x.k === 'e');
    if (ab < 0) return sKlopf.length ? 'Fang mit der 1 an – links!' : 'Links die 1 · rechts der Rest';
    const takte = [];
    sKlopf.slice(ab).forEach(x => { if (x.k === 'e') takte.push([1]); else takte[takte.length - 1].push(takte[takte.length - 1].length + 1); });
    return takte.slice(-3).map(t => t.join(' ')).join('  |  ');
}
function sKlopfZeigen(neu) {
    const st = sStand, a = st.aufgabe || {};
    if (!neu && $('s-klopf-eins')) return;
    sKlopf = [];
    $('s-inhalt').className = 'karte s-mitte';
    $('s-inhalt').innerHTML = `<div class="s-klein">🥁 Eins-Klopfer · ${a.k || ''} von ${a.n || ''}</div>
        <div class="s-gross" id="s-klopf-status"></div>
        <div class="klopf-flaechen" id="s-klopf-flaechen">
            <button type="button" class="klopf-pad eins" id="s-klopf-eins"><b>1</b><small>betont</small></button>
            <button type="button" class="klopf-pad rest" id="s-klopf-rest"><b>2 3 4</b><small>die anderen</small></button>
        </div>
        <div class="klopf-zaehlen" id="s-klopf-zaehlen">${sKlopfText()}</div>
        <div class="leiste mitte">
            <button type="button" class="btn" id="s-klopf-neu"><i class="fa-solid fa-rotate-left"></i> Neu</button>
            <button type="button" class="btn btn-gross btn-primaer" id="s-klopf-ab" disabled><i class="fa-solid fa-check"></i> Abgeben</button>
        </div>`;
    const flaechen = $('s-klopf-flaechen');
    const tick = () => {
        if (!$('s-klopf-status')) return clearInterval(sHoerUhr);
        const rest = st.spieltBis ? Math.ceil((st.spieltBis - jetzt()) / 1000) : 0;
        flaechen.classList.toggle('gesperrt', rest > 0);
        $('s-klopf-status').textContent = rest > 0 ? `🎧 erst zuhören … ${rest}` : 'Klopf mit!';
        if (rest <= 0) clearInterval(sHoerUhr);
    };
    sHoerUhr = setInterval(tick, 250);
    tick();
    const klopf = (art) => (e) => {
        e.preventDefault();
        if (st.spieltBis && jetzt() < st.spieltBis) return;
        const t = e.timeStamp || performance.now();
        // Nach einer langen Pause neu anfangen, hoechstens 48 Tipps merken
        if (sKlopf.length && t - sKlopf[sKlopf.length - 1].t > 3000) sKlopf = [];
        sKlopf.push({ k: art, t });
        if (sKlopf.length > 48) sKlopf.shift();
        const pad = e.currentTarget;
        pad.classList.remove('blitz'); void pad.offsetWidth; pad.classList.add('blitz');
        $('s-klopf-zaehlen').textContent = sKlopfText();
        // Abgeben ab zwei vollen Takten (drei Einsen)
        $('s-klopf-ab').disabled = sKlopf.filter(x => x.k === 'e').length < 3;
    };
    $('s-klopf-eins').addEventListener('pointerdown', klopf('e'));
    $('s-klopf-rest').addEventListener('pointerdown', klopf('a'));
    $('s-klopf-neu').addEventListener('click', () => { sKlopf = []; $('s-klopf-zaehlen').textContent = sKlopfText(); $('s-klopf-ab').disabled = true; });
    $('s-klopf-ab').addEventListener('click', () => {
        const ab = sKlopf.findIndex(x => x.k === 'e');
        if (ab < 0) return;
        const t0 = sKlopf[ab].t;
        sAbgeben(sKlopf.slice(ab).map(x => x.k + Math.round(x.t - t0)).join(','));
    });
}

/* ----- Millionaer ----- */
function sQuizZeigen() {
    const a = sStand.aufgabe || {};
    $('s-inhalt').className = 'karte s-mitte s-wwm';
    $('s-inhalt').innerHTML = `<div class="s-klein">🏆 Taktarten-Millionär</div><div class="s-frage">${esc(a.frage || '')}</div>
        <div class="s-antworten">${(a.antworten || []).map((t, k) => `<button type="button" class="wwm-knopf f${k}" data-antwort="${k}"><b>${ABCD[k]}</b> ${esc(t)}</button>`).join('')}</div>`;
}

/* ----- Notenaufgaben: takt, strich, luecke, kobold ----- */
const S_AUFTRAG = {
    takt: 'Tippe auf ein „?“ und wähle unten die Taktart.',
    strich: 'Tippe zwischen die Noten, wo ein Taktstrich hingehört. Nochmal tippen = weg.',
    luecke: 'Tippe auf ein „?“ und wähle unten den Notenwert.',
    kobold: '👺 Tippe den Takt an, den der Kobold verhext hat.'
};
function sNotenZeigen() {
    const st = sStand, r = rundeAusAufgabe(st.art, st.aufgabe || {});
    const fragen = st.art === 'takt' ? r.zeig.filter(z => z === '?').length : st.art === 'luecke' ? r.b.join('-').split('?').length - 1 : 0;
    if (sWahl === null) sWahl = st.art === 'strich' ? new Set() : st.art === 'kobold' ? -1 : Array(fragen).fill(-1);
    const s = st.art === 'strich' ? { striche: sWahl } : { wahl: sWahl, aktiv: sAktiv };
    let wahlLeiste = '';
    if (st.art === 'takt') wahlLeiste = `<div class="wahl-leiste">${TA.map((t, k) => `<button type="button" class="btn wahl ${sWahl[sAktiv] === k ? 'an' : ''}" data-ta="${k}">${t}</button>`).join('')}</div>`;
    if (st.art === 'luecke') wahlLeiste = `<div class="wahl-leiste">${LUECKE_WAHL.map((c, k) => `<button type="button" class="btn wahl note ${sWahl[sAktiv] === k ? 'an' : ''}" data-nw="${k}" title="${LUECKE_NAME[c]}">${notenSvg(c)}<small>${LUECKE_NAME[c]}</small></button>`).join('')}</div>`;
    const fertig = st.art === 'strich' ? sWahl.size > 0 : st.art === 'kobold' ? sWahl >= 0 : sWahl.every(x => x >= 0);
    $('s-inhalt').className = 'karte s-mitte s-noten';
    $('s-inhalt').innerHTML = `<div class="s-klein">${esc(TEIL_INFO[st.art].name)}</div>
        <p class="hinweis klein" style="margin:0">${S_AUFTRAG[st.art]}</p>
        ${zeileHtml(r, s)}
        ${wahlLeiste}
        <button type="button" class="btn btn-gross btn-primaer" id="s-noten-ab" ${fertig ? '' : 'disabled'}><i class="fa-solid fa-check"></i> Abgeben</button>`;
}
function sNotenTipp(e) {
    const st = sStand;
    if (!st || st.phase !== 'frage' || !['takt', 'strich', 'luecke', 'kobold'].includes(st.art) || sAbgabe[`${st.spiel}_${st.nr}`] !== undefined) return;
    const t = e.target;
    const frage = t.closest('[data-frage], [data-luecke]');
    if (frage) { sAktiv = Number(frage.dataset.frage ?? frage.dataset.luecke); sNotenZeigen(); return; }
    const gap = t.closest('[data-gap]');
    if (gap && st.art === 'strich') { const k = Number(gap.dataset.gap); if (sWahl.has(k)) sWahl.delete(k); else sWahl.add(k); sNotenZeigen(); return; }
    const takt = t.closest('[data-takt]');
    if (takt && st.art === 'kobold') { sWahl = Number(takt.dataset.takt); sNotenZeigen(); return; }
    const wahl = t.closest('[data-ta], [data-nw]');
    if (wahl) {
        sWahl[sAktiv] = Number(wahl.dataset.ta ?? wahl.dataset.nw);
        // gleich zum naechsten offenen "?" springen
        const offen = sWahl.findIndex((x, k) => x < 0 && k !== sAktiv);
        if (offen >= 0) sAktiv = offen;
        sNotenZeigen();
        return;
    }
    if (t.closest('#s-noten-ab')) {
        const w = st.art === 'strich' ? [...sWahl].sort((a, b) => a - b).join(',') : st.art === 'kobold' ? sWahl : sWahl.join(',');
        sAbgeben(w);
    }
}

/* ----- Ergebnis ----- */
function sErgebnisZeigen(key) {
    const st = sStand, w = st.wertung && st.wertung[geraet], meine = sAbgabe[key], l = st.loesung || {};
    let detail = '';
    if (st.art === 'klopf') {
        const k = meine !== undefined ? klopfBasis(l.ta, meine) : null;
        detail = `<p class="s-mittel">Lösung: <b>${esc(l.ta)}-Takt</b></p>${l.titel ? `<p class="hinweis">${esc(l.titel)}</p>` : ''}
            ${k ? `<p class="hinweis">Du hast ${k.erkannt ? `einen <b>${esc(k.erkannt)}</b>-Takt` : 'zu wenig Takte'} geklopft${k.erkannt ? ` · ${k.gleich} % gleichmäßig` : ''}.</p>` : ''}`;
    } else if (st.art === 'hoer' || st.art === 'klick') {
        detail = `<p class="s-mittel">Lösung: <b>${esc(l.ta)}-Takt</b></p>${l.titel ? `<p class="hinweis">${esc(l.titel)}</p>` : ''}
            ${meine !== undefined && TA[Number(meine)] !== l.ta ? `<p class="hinweis">Du: ${TA[Number(meine)]}</p>` : ''}`;
    } else if (st.art === 'quiz') {
        const a = st.aufgabe || {};
        detail = `<p class="s-mittel">Richtig: <b>${ABCD[l.richtig]}</b> – ${esc((a.antworten || [])[l.richtig] || '')}</p>`;
    } else if (st.aufgabe) {
        const r = rundeAusAufgabe(st.art, st.aufgabe);
        const s = { loesung: true, mitWahl: meine !== undefined };
        if (st.art === 'takt') { r.w = l.w || []; s.wahl = liste(meine); }
        if (st.art === 'strich') { s.soll = liste(l.soll); s.striche = new Set(liste(meine)); }
        if (st.art === 'luecke') { s.soll = l.soll || []; s.wahl = liste(meine); }
        if (st.art === 'kobold') { s.falsch = l.falsch; s.schlaege = l.schlaege; s.wahl = meine === undefined ? -1 : Number(meine); }
        detail = zeileHtml(r, s) + (st.art === 'strich' ? '<p class="hinweis klein"><span class="leg-strich ok"></span> richtig <span class="leg-strich falsch"></span> falsch <span class="leg-strich fehlt"></span> fehlt</p>' : '');
    }
    const gut = w && w.p >= 100, mittel = w && w.p > 0;
    $('s-inhalt').className = 'karte s-mitte s-noten';
    $('s-inhalt').innerHTML = `
        <div class="s-riesig ${gut ? 'gut' : mittel ? 'mittel' : 'schlecht'}">${w ? '+' + w.p : '+0'}</div>
        ${w && w.x ? `<p class="s-mittel">${w.b} + ⚡ ${w.x} Platzbonus</p>` : ''}
        ${meine === undefined ? '<p class="hinweis">Diesmal keine Abgabe.</p>' : ''}
        ${detail}
        ${w ? `<p class="hinweis">Gesamt: <b>${w.g}</b> Punkte · Platz ${w.pl}</p>` : ''}`;
}

function schuelerStart() {
    zeigen('schueler', true);
    $('s-code').textContent = sCode || '';
    zeigen('s-code-feld', !sCode);
    $('s-name').value = lesen('ta-name', '');
    sEmojisZeigen();
    $('s-emojis').addEventListener('click', e => {
        const b = e.target.closest('[data-emoji]');
        if (b) { sEmoji = b.dataset.emoji; sEmojisZeigen(); }
    });
    $('s-los-btn').addEventListener('click', sBeitreten);
    $('s-name').addEventListener('keydown', e => { if (e.key === 'Enter') sBeitreten(); });
    // Notenaufgaben per pointerdown: reagiert auf dem iPad sofort, ohne Doppeltipp-Zoom
    $('s-inhalt').addEventListener('pointerdown', e => {
        if (e.target.closest('[data-frage], [data-luecke], [data-gap], [data-takt], [data-ta], [data-nw], #s-noten-ab')) { e.preventDefault(); sNotenTipp(e); }
    });
    $('s-inhalt').addEventListener('click', e => {
        const a = e.target.closest('[data-antwort]');
        if (a && !a.closest('.gesperrt')) {
            document.querySelectorAll('[data-antwort]').forEach(b => { b.disabled = true; b.classList.toggle('gewaehlt', b === a); });
            sAbgeben(Number(a.dataset.antwort));
        }
        if (e.target.closest('#s-anders')) {
            remove(ref(db, pfad(sCode, `spieler/${geraet}`))).catch(() => { });
            sRaus(null);
        }
    });
    // Gleicher Raum und Name schon bekannt: direkt wieder rein (Reload, Sperrbildschirm)
    if (sCode && lesen('ta-raum', '') === sCode && lesen('ta-name', '')) sBeitreten();
}

/* ---------- Start ---------- */
if (sCode || new URLSearchParams(location.search).has('raum')) schuelerStart();
else lehrerStart();
