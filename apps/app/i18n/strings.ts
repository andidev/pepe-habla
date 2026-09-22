import type { AppLanguage } from '@pepe/core';

/**
 * Every word of interface copy, in each app language.
 *
 * An interface rather than a loose object, so a key missing from one language
 * is a compile error instead of a blank label. Pepe's own lines — ¡Vamos!,
 * the greetings — stay Spanish in every language: they are his voice.
 */
export interface Strings {
  tabs: { home: string; progress: string; words: string; settings: string };
  home: {
    waiting: (due: number) => string;
    caughtUp: string;
    known: string;
    due: string;
    total: string;
  };
  session: {
    exit: string;
    task: { recognise: string; produce: string; picture: string; repair: string };
    listenAgain: string;
    tryAgain: string;
    correct: string;
    tapToContinue: string;
  };
  summary: {
    title: string;
    firstTry: (right: number, total: number) => string;
    wholeSession: (right: number, total: number) => string;
    toReview: string;
    backTomorrow: string;
    anotherRound: string;
    doneForToday: string;
    switchTo: (track: string) => string;
  };
  stats: {
    title: string;
    streakLabel: (days: number) => string;
    streakDays: (days: number) => string;
    streakCaption: (days: number) => string;
    known: string;
    thisWeek: string;
    accuracy: string;
    vocabulary: string;
    practisedOf: (practised: number, total: number) => string;
    knownAndDue: (known: number, due: number) => string;
    tricky: string;
    trickyHint: string;
    emptyTitle: string;
    emptyBody: string;
    photoLabel: string;
    photoTitle: string;
    photoCaption: string;
  };
  words: {
    title: string;
    practisedOf: (practised: number, total: number) => string;
    filter: { all: string; due: string; known: string; tricky: string; track: string; theme: string };
    emptyNone: string;
    emptyFilter: string;
    listen: (es: string) => string;
  };
  track: { words: string; grammar: string };
  level: {
    line: (level: number, name: string) => string;
    desc: { words: readonly string[]; grammar: readonly string[] };
    dominadas: (done: number, total: number) => string;
    next: (name: string) => string;
  };
  theme: Record<string, string>;
  settings: {
    title: string;
    language: string;
    languageHint: string;
    sound: string;
    soundHint: string;
    effects: string;
    effectsHint: string;
    reminder: string;
    reminderHint: string;
    reminderDenied: string;
    reminderOpenSettings: string;
    about: (words: number) => string;
    back: string;
  };
  /** The morning notification. Written here, fired from notifications.ts. */
  notification: {
    /** Pepe's own voice — Spanish in every language, like the greetings. */
    title: string;
    streak: (due: number, streak: number) => string;
    due: (due: number) => string;
    streakOnly: (streak: number) => string;
    fresh: string;
  };
}

const es: Strings = {
  tabs: { home: 'Inicio', progress: 'Progreso', words: 'Palabras', settings: 'Ajustes' },
  home: {
    waiting: (n) => `¡Órale! Tienes ${n} ${n === 1 ? 'palabra esperándote' : 'palabras esperándote'}.`,
    caughtUp: 'Todo al día. ¿Quieres aprender palabras nuevas?',
    known: 'CONOCIDAS',
    due: 'POR REPASAR',
    total: 'EN TOTAL',
  },
  session: {
    exit: 'Salir de la ronda',
    task: {
      recognise: 'ESCOGE LA TRADUCCIÓN',
      produce: '¿CÓMO SE DICE?',
      picture: '¿QUÉ ES ESTO?',
      repair: 'OTRA VEZ, SIN PRISA',
    },
    listenAgain: 'Escuchar otra vez',
    tryAgain: '¡Otra vez!',
    correct: '¡Eso es!',
    tapToContinue: 'Toca en cualquier parte para seguir',
  },
  summary: {
    title: '¡Bien hecho!',
    firstTry: (r, t) => `${r} de ${t} correctas al primer intento`,
    wholeSession: (r, t) => `${r} de ${t} en toda la sesión`,
    toReview: 'PARA REPASAR',
    backTomorrow: 'Vuelven mañana.',
    anotherRound: '¿Otra ronda?',
    doneForToday: 'Terminar por hoy',
    switchTo: (track) => `¿Mejor ${track}?`,
  },
  stats: {
    title: 'Progreso',
    streakLabel: (d) => (d === 0 ? 'Sin racha todavía. Empieza hoy.' : `Racha de ${d} ${d === 1 ? 'día' : 'días'}`),
    streakDays: (d) => `${d} ${d === 1 ? 'día' : 'días'}`,
    streakCaption: (d) => (d === 0 ? 'Empieza hoy' : d === 1 ? 'seguido' : 'seguidos'),
    known: 'CONOCIDAS',
    thisWeek: 'ESTA SEMANA',
    accuracy: 'PRECISIÓN',
    vocabulary: 'Tu vocabulario',
    practisedOf: (p, t) => `${p} de ${t} palabras practicadas`,
    knownAndDue: (k, d) => `${k} conocidas · ${d} por repasar hoy`,
    tricky: 'Se te atragantan',
    trickyHint: 'Las que más fallas. Aquí está tu cuello de botella.',
    emptyTitle: 'Todavía nada que mostrar',
    emptyBody: 'Juega una ronda y aquí verás lo que sabes.',
    photoLabel: 'Fotografía del Pepe real, echado en el suelo',
    photoTitle: 'El Pepe de verdad',
    photoCaption: 'Perro callejero, Ciudad de México',
  },
  words: {
    title: 'Palabras',
    practisedOf: (p, t) => `${p} practicadas de ${t}`,
    filter: {
      all: 'Todas',
      due: 'Por repasar',
      known: 'Conocidas',
      tricky: 'Se te atragantan',
      track: 'Pista',
      theme: 'Tema',
    },
    emptyNone: 'Todavía no has practicado ninguna palabra.',
    emptyFilter: 'Nada aquí por ahora.',
    listen: (w) => `Escuchar ${w}`,
  },
  track: { words: 'Palabras', grammar: 'Gramática' },
  level: {
    line: (n, name) => `NIVEL ${n} · ${name}`,
    desc: {
      words: [
        'Las 200 palabras que más se oyen.',
        'La casa, la comida, el cuerpo, la familia.',
        'La calle: el transporte, el clima, la ciudad.',
        'Las compras, el dinero, la cocina, la ropa.',
        'El trabajo, la escuela, la salud.',
        'Viajes, servicios, trámites, tecnología.',
        'Opiniones, sentimientos, ideas.',
        'Cómo se habla de verdad en México.',
      ],
      grammar: [
        'El presente de los verbos de siempre.',
        'El pretérito: comí, fui, hice.',
        'El imperfecto, y cuándo usarlo.',
        'El futuro y el condicional.',
        'El subjuntivo y lo que lo pide.',
        'Dichos: acabar de, volver a, tener que.',
      ],
    },
    dominadas: (done, total) => `${done} de ${total} dominadas`,
    next: (name) => `Sigue: ${name}`,
  },
  theme: {
    comida: 'Comida',
    animales: 'Animales',
    casa: 'Casa',
    cuerpo: 'Cuerpo',
    ropa: 'Ropa',
    transporte: 'Transporte',
    trabajo: 'Trabajo',
    dinero: 'Dinero',
    salud: 'Salud',
    emociones: 'Emociones',
    tiempo: 'Tiempo',
    naturaleza: 'Naturaleza',
    ciudad: 'Ciudad',
    escuela: 'Escuela',
    tecnología: 'Tecnología',
    deporte: 'Deporte',
    música: 'Música',
    familia: 'Familia',
    cocina: 'Cocina',
    fiesta: 'Fiesta',
    viaje: 'Viaje',
    gobierno: 'Gobierno',
    negocios: 'Negocios',
    verbos: 'Verbos',
    conectores: 'Conectores',
    números: 'Números',
    saludos: 'Saludos',
    slang: 'Slang',
    presente: 'Presente',
    pretérito: 'Pretérito',
    imperfecto: 'Imperfecto',
    futuro: 'Futuro',
    subjuntivo: 'Subjuntivo',
    dichos: 'Dichos',
  },
  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    languageHint: 'El idioma de la app y de las traducciones.',
    sound: 'Sonido',
    soundHint: 'La vibración sigue funcionando aunque lo apagues.',
    effects: 'Efectos y vibración',
    effectsHint: 'Los sonidos de acierto y error. La voz siempre se oye.',
    reminder: 'Recordatorio',
    reminderHint: '¿A qué hora te despierta Pepe?',
    reminderDenied: 'Pepe no puede avisarte. Las notificaciones están apagadas para Pepe Habla en los ajustes del teléfono.',
    reminderOpenSettings: 'Abrir ajustes',
    about: (n) => `${n} palabras en español mexicano. Pepe es un perro callejero de la Ciudad de México.`,
    back: 'Volver',
  },
  notification: {
    title: '¡Órale!',
    streak: (n, d) =>
      `${n} ${n === 1 ? 'palabra' : 'palabras'} por repasar — no pierdas tu racha de ${d} ${d === 1 ? 'día' : 'días'}.`,
    due: (n) => `${n} ${n === 1 ? 'palabra te espera' : 'palabras te esperan'}. Pepe te extraña.`,
    streakOnly: (d) => `Nada que repasar, pero no rompas tu racha de ${d} ${d === 1 ? 'día' : 'días'}.`,
    fresh: 'Nada que repasar. ¿Aprendemos palabras nuevas?',
  },
};

const sv: Strings = {
  tabs: { home: 'Hem', progress: 'Framsteg', words: 'Ord', settings: 'Inställningar' },
  home: {
    waiting: (n) => `¡Órale! Du har ${n} ord som väntar.`,
    caughtUp: 'Allt är klart. Vill du lära dig nya ord?',
    known: 'KÄNDA',
    due: 'ATT REPETERA',
    total: 'TOTALT',
  },
  session: {
    exit: 'Avsluta rundan',
    task: {
      recognise: 'VÄLJ ÖVERSÄTTNINGEN',
      produce: 'HUR SÄGER MAN?',
      picture: 'VAD ÄR DETTA?',
      repair: 'EN GÅNG TILL, I LUGN OCH RO',
    },
    listenAgain: 'Lyssna igen',
    tryAgain: 'Försök igen!',
    correct: 'Helt rätt!',
    tapToContinue: 'Tryck var som helst för att fortsätta',
  },
  summary: {
    title: 'Bra jobbat!',
    firstTry: (r, t) => `${r} av ${t} rätt på första försöket`,
    wholeSession: (r, t) => `${r} av ${t} under hela passet`,
    toReview: 'ATT REPETERA',
    backTomorrow: 'De kommer tillbaka i morgon.',
    anotherRound: 'En runda till?',
    doneForToday: 'Klart för idag',
    switchTo: (track) => `Hellre ${track}?`,
  },
  stats: {
    title: 'Framsteg',
    streakLabel: (d) => (d === 0 ? 'Ingen svit än. Börja i dag.' : `En svit på ${d} ${d === 1 ? 'dag' : 'dagar'}`),
    streakDays: (d) => `${d} ${d === 1 ? 'dag' : 'dagar'}`,
    streakCaption: (d) => (d === 0 ? 'Börja i dag' : 'i rad'),
    known: 'KÄNDA',
    thisWeek: 'DENNA VECKA',
    accuracy: 'TRÄFFSÄKERHET',
    vocabulary: 'Ditt ordförråd',
    practisedOf: (p, t) => `${p} av ${t} ord övade`,
    knownAndDue: (k, d) => `${k} kända · ${d} att repetera i dag`,
    tricky: 'Svåra ord',
    trickyHint: 'De du missar oftast. Här sitter flaskhalsen.',
    emptyTitle: 'Inget att visa än',
    emptyBody: 'Spela en runda så ser du här vad du kan.',
    photoLabel: 'Foto av den riktiga Pepe som ligger på marken',
    photoTitle: 'Den riktiga Pepe',
    photoCaption: 'Gatuhund, Mexico City',
  },
  words: {
    title: 'Ord',
    practisedOf: (p, t) => `${p} av ${t} övade`,
    filter: {
      all: 'Alla',
      due: 'Att repetera',
      known: 'Kända',
      tricky: 'Svåra',
      track: 'Spår',
      theme: 'Tema',
    },
    emptyNone: 'Du har inte övat på något ord än.',
    emptyFilter: 'Inget här just nu.',
    listen: (w) => `Lyssna på ${w}`,
  },
  track: { words: 'Ord', grammar: 'Grammatik' },
  level: {
    line: (n, name) => `NIVÅ ${n} · ${name}`,
    desc: {
      words: [
        'De 200 ord du hör oftast.',
        'Hemmet, maten, kroppen, familjen.',
        'Gatan: transport, väder, staden.',
        'Handla, pengar, matlagning, kläder.',
        'Jobbet, skolan, hälsan.',
        'Resor, service, byråkrati, teknik.',
        'Åsikter, känslor, idéer.',
        'Så som man faktiskt pratar i Mexiko.',
      ],
      grammar: [
        'Presens av verben du använder varje dag.',
        'Preteritum: comí, fui, hice.',
        'Imperfekt, och när man använder det.',
        'Futurum och konditionalis.',
        'Konjunktiv, och vad som utlöser den.',
        'Fasta uttryck: acabar de, volver a, tener que.',
      ],
    },
    dominadas: (done, total) => `${done} av ${total} behärskade`,
    next: (name) => `Härnäst: ${name}`,
  },
  theme: {
    comida: 'Mat',
    animales: 'Djur',
    casa: 'Hemmet',
    cuerpo: 'Kroppen',
    ropa: 'Kläder',
    transporte: 'Transport',
    trabajo: 'Jobb',
    dinero: 'Pengar',
    salud: 'Hälsa',
    emociones: 'Känslor',
    tiempo: 'Tid',
    naturaleza: 'Natur',
    ciudad: 'Staden',
    escuela: 'Skolan',
    tecnología: 'Teknik',
    deporte: 'Sport',
    música: 'Musik',
    familia: 'Familjen',
    cocina: 'Matlagning',
    fiesta: 'Fest',
    viaje: 'Resor',
    gobierno: 'Myndigheter',
    negocios: 'Affärer',
    verbos: 'Verb',
    conectores: 'Bindeord',
    números: 'Siffror',
    saludos: 'Hälsningar',
    slang: 'Slang',
    presente: 'Presens',
    pretérito: 'Preteritum',
    imperfecto: 'Imperfekt',
    futuro: 'Futurum',
    subjuntivo: 'Konjunktiv',
    dichos: 'Fasta uttryck',
  },
  settings: {
    title: 'Inställningar',
    language: 'Språk',
    languageHint: 'Appens språk och översättningarna i frågorna.',
    sound: 'Ljud',
    soundHint: 'Vibrationen fungerar även när ljudet är av.',
    effects: 'Ljudeffekter och vibration',
    effectsHint: 'Pling när det är rätt, surr när det är fel. Rösten hörs alltid.',
    reminder: 'Påminnelse',
    reminderHint: 'När ska Pepe väcka dig?',
    reminderDenied: 'Pepe kan inte nå dig. Notiser är avstängda för Pepe Habla i telefonens inställningar.',
    reminderOpenSettings: 'Öppna inställningar',
    about: (n) => `${n} ord på mexikansk spanska. Pepe är en gatuhund från Mexico City.`,
    back: 'Tillbaka',
  },
  notification: {
    title: '¡Órale!',
    streak: (n, d) => `${n} ord att repetera — behåll din svit på ${d} ${d === 1 ? 'dag' : 'dagar'}.`,
    due: (n) => `${n} ord väntar. Pepe saknar dig.`,
    streakOnly: (d) => `Inget att repetera, men bryt inte din svit på ${d} ${d === 1 ? 'dag' : 'dagar'}.`,
    fresh: 'Inget att repetera. Ska vi lära oss nya ord?',
  },
};

const en: Strings = {
  tabs: { home: 'Home', progress: 'Progress', words: 'Words', settings: 'Settings' },
  home: {
    waiting: (n) => `¡Órale! You have ${n} ${n === 1 ? 'word' : 'words'} waiting.`,
    caughtUp: 'All caught up. Want to learn some new words?',
    known: 'KNOWN',
    due: 'TO REVIEW',
    total: 'IN TOTAL',
  },
  session: {
    exit: 'Leave the round',
    task: {
      recognise: 'PICK THE TRANSLATION',
      produce: 'HOW DO YOU SAY IT?',
      picture: 'WHAT IS THIS?',
      repair: 'ONE MORE TIME, NO RUSH',
    },
    listenAgain: 'Listen again',
    tryAgain: 'Try again!',
    correct: "That's it!",
    tapToContinue: 'Tap anywhere to continue',
  },
  summary: {
    title: 'Well done!',
    firstTry: (r, t) => `${r} of ${t} right first time`,
    wholeSession: (r, t) => `${r} of ${t} across the whole session`,
    toReview: 'TO REVIEW',
    backTomorrow: 'They come back tomorrow.',
    anotherRound: 'Another round?',
    doneForToday: 'Done for today',
    switchTo: (track) => `Try ${track} instead?`,
  },
  stats: {
    title: 'Progress',
    streakLabel: (d) => (d === 0 ? 'No streak yet. Start today.' : `A ${d}-day streak`),
    streakDays: (d) => `${d} ${d === 1 ? 'day' : 'days'}`,
    streakCaption: (d) => (d === 0 ? 'Start today' : 'in a row'),
    known: 'KNOWN',
    thisWeek: 'THIS WEEK',
    accuracy: 'ACCURACY',
    vocabulary: 'Your vocabulary',
    practisedOf: (p, t) => `${p} of ${t} words practised`,
    knownAndDue: (k, d) => `${k} known · ${d} to review today`,
    tricky: 'Tricky words',
    trickyHint: 'The ones you miss most. This is your bottleneck.',
    emptyTitle: 'Nothing to show yet',
    emptyBody: 'Play a round and you will see what you know here.',
    photoLabel: 'Photo of the real Pepe, lying on the ground',
    photoTitle: 'The real Pepe',
    photoCaption: 'Street dog, Mexico City',
  },
  words: {
    title: 'Words',
    practisedOf: (p, t) => `${p} of ${t} practised`,
    filter: {
      all: 'All',
      due: 'To review',
      known: 'Known',
      tricky: 'Tricky',
      track: 'Track',
      theme: 'Theme',
    },
    emptyNone: 'You have not practised any words yet.',
    emptyFilter: 'Nothing here for now.',
    listen: (w) => `Listen to ${w}`,
  },
  track: { words: 'Words', grammar: 'Grammar' },
  level: {
    line: (n, name) => `LEVEL ${n} · ${name}`,
    desc: {
      words: [
        'The 200 words you hear most.',
        'Home, food, the body, family.',
        'The street: transport, weather, the city.',
        'Shopping, money, cooking, clothes.',
        'Work, school, health.',
        'Travel, services, paperwork, technology.',
        'Opinions, feelings, ideas.',
        'How people actually talk in Mexico.',
      ],
      grammar: [
        'The present tense of the everyday verbs.',
        'The preterite: comí, fui, hice.',
        'The imperfect, and when to use it.',
        'The future and the conditional.',
        'The subjunctive, and what triggers it.',
        'Set phrases: acabar de, volver a, tener que.',
      ],
    },
    dominadas: (done, total) => `${done} of ${total} mastered`,
    next: (name) => `Next: ${name}`,
  },
  theme: {
    comida: 'Food',
    animales: 'Animals',
    casa: 'Home',
    cuerpo: 'Body',
    ropa: 'Clothes',
    transporte: 'Transport',
    trabajo: 'Work',
    dinero: 'Money',
    salud: 'Health',
    emociones: 'Feelings',
    tiempo: 'Time',
    naturaleza: 'Nature',
    ciudad: 'City',
    escuela: 'School',
    tecnología: 'Technology',
    deporte: 'Sport',
    música: 'Music',
    familia: 'Family',
    cocina: 'Cooking',
    fiesta: 'Parties',
    viaje: 'Travel',
    gobierno: 'Government',
    negocios: 'Business',
    verbos: 'Verbs',
    conectores: 'Connectives',
    números: 'Numbers',
    saludos: 'Greetings',
    slang: 'Slang',
    presente: 'Present',
    pretérito: 'Preterite',
    imperfecto: 'Imperfect',
    futuro: 'Future',
    subjuntivo: 'Subjunctive',
    dichos: 'Set phrases',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    languageHint: 'The app language and the translations in questions.',
    sound: 'Sound',
    soundHint: 'Vibration still works when sound is off.',
    effects: 'Sound effects and vibration',
    effectsHint: 'The right and wrong sounds. The voice is always heard.',
    reminder: 'Reminder',
    reminderHint: 'When should Pepe wake you?',
    reminderDenied: "Pepe can't reach you. Notifications are off for Pepe Habla in your phone's settings.",
    reminderOpenSettings: 'Open settings',
    about: (n) => `${n} words of Mexican Spanish. Pepe is a street dog from Mexico City.`,
    back: 'Back',
  },
  notification: {
    title: '¡Órale!',
    streak: (n, d) => `${n} ${n === 1 ? 'word is' : 'words are'} due — keep your ${d}-day streak.`,
    due: (n) => `${n} ${n === 1 ? 'word is' : 'words are'} waiting. Pepe misses you.`,
    streakOnly: (d) => `Nothing to review — but don't break your ${d}-day streak.`,
    fresh: 'Nothing due. Want to learn some new words?',
  },
};

export const STRINGS: Record<AppLanguage, Strings> = { sv, en, es };

/**
 * The language picker's rows. Each is written in its own language, never the
 * current one, so a learner who picks the wrong one can still find the way back.
 */
export const LANGUAGE_CHOICES: readonly { id: AppLanguage; name: string; detail: string }[] = [
  { id: 'sv', name: 'Svenska', detail: 'Frågor på svenska' },
  { id: 'en', name: 'English', detail: 'Questions in English' },
  { id: 'es', name: 'Español', detail: 'Todo en español · preguntas en inglés' },
];
