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
    level: string;
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
    filter: { all: string; due: string; known: string; tricky: string };
    emptyNone: string;
    emptyFilter: string;
    listen: (es: string) => string;
  };
  settings: {
    title: string;
    language: string;
    languageHint: string;
    sound: string;
    soundHint: string;
    effects: string;
    effectsHint: string;
    about: (words: number) => string;
    back: string;
  };
}

const es: Strings = {
  tabs: { home: 'Inicio', progress: 'Progreso', words: 'Palabras', settings: 'Ajustes' },
  home: {
    waiting: (n) => `¡Órale! Tienes ${n} ${n === 1 ? 'palabra esperándote' : 'palabras esperándote'}.`,
    caughtUp: 'Todo al día. ¿Quieres aprender palabras nuevas?',
    level: 'NIVEL 1',
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
    filter: { all: 'Todas', due: 'Por repasar', known: 'Conocidas', tricky: 'Se te atragantan' },
    emptyNone: 'Todavía no has practicado ninguna palabra.',
    emptyFilter: 'Nada aquí por ahora.',
    listen: (w) => `Escuchar ${w}`,
  },
  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    languageHint: 'El idioma de la app y de las traducciones.',
    sound: 'Sonido',
    soundHint: 'La vibración sigue funcionando aunque lo apagues.',
    effects: 'Efectos y vibración',
    effectsHint: 'Los sonidos de acierto y error. La voz siempre se oye.',
    about: (n) => `${n} palabras en español mexicano. Pepe es un perro callejero de la Ciudad de México.`,
    back: 'Volver',
  },
};

const sv: Strings = {
  tabs: { home: 'Hem', progress: 'Framsteg', words: 'Ord', settings: 'Inställningar' },
  home: {
    waiting: (n) => `¡Órale! Du har ${n} ord som väntar.`,
    caughtUp: 'Allt är klart. Vill du lära dig nya ord?',
    level: 'NIVÅ 1',
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
    filter: { all: 'Alla', due: 'Att repetera', known: 'Kända', tricky: 'Svåra' },
    emptyNone: 'Du har inte övat på något ord än.',
    emptyFilter: 'Inget här just nu.',
    listen: (w) => `Lyssna på ${w}`,
  },
  settings: {
    title: 'Inställningar',
    language: 'Språk',
    languageHint: 'Appens språk och översättningarna i frågorna.',
    sound: 'Ljud',
    soundHint: 'Vibrationen fungerar även när ljudet är av.',
    effects: 'Ljudeffekter och vibration',
    effectsHint: 'Pling när det är rätt, surr när det är fel. Rösten hörs alltid.',
    about: (n) => `${n} ord på mexikansk spanska. Pepe är en gatuhund från Mexico City.`,
    back: 'Tillbaka',
  },
};

const en: Strings = {
  tabs: { home: 'Home', progress: 'Progress', words: 'Words', settings: 'Settings' },
  home: {
    waiting: (n) => `¡Órale! You have ${n} ${n === 1 ? 'word' : 'words'} waiting.`,
    caughtUp: 'All caught up. Want to learn some new words?',
    level: 'LEVEL 1',
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
    filter: { all: 'All', due: 'To review', known: 'Known', tricky: 'Tricky' },
    emptyNone: 'You have not practised any words yet.',
    emptyFilter: 'Nothing here for now.',
    listen: (w) => `Listen to ${w}`,
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    languageHint: 'The app language and the translations in questions.',
    sound: 'Sound',
    soundHint: 'Vibration still works when sound is off.',
    effects: 'Sound effects and vibration',
    effectsHint: 'The right and wrong sounds. The voice is always heard.',
    about: (n) => `${n} words of Mexican Spanish. Pepe is a street dog from Mexico City.`,
    back: 'Back',
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
