export interface Greeting {
  /** What Pepe says. */
  es: string;
  /** The gloss underneath, for an A2 reader who has not met the slang yet. */
  en: string;
  /** The same gloss for a Swedish interface. */
  sv: string;
}

/**
 * What Pepe says when you open the app.
 *
 * The splash always shows the same Pepe -- sitting, tongue out -- because the
 * native splash that precedes it is a single image baked into the build, and
 * any other pose would visibly swap at the handover. So every line here has to
 * work coming from a happy dog: lines about napping or feeling sad were left
 * out, and so was anything about a hat or mask he is not wearing.
 *
 * Two rules hold across the list. Anything addressed to *you* avoids gendered
 * adjectives, because Spanish would otherwise assume the reader's gender --
 * hence `imparable` and `fuerte` (invariant) and `estrella` (a noun used for
 * anyone) rather than `listo` or `bienvenido`. Anything Pepe says about
 * himself is masculine, since Pepe is el perro.
 */
export const GREETINGS: readonly Greeting[] = [
  // The everyday hellos.
  { es: '¡Órale!', en: 'Hey! / Wow!', sv: 'Hej! / Oj!' },
  { es: '¿Qué onda?', en: "What's up?", sv: 'Läget?' },
  { es: '¡Ándale pues!', en: 'Alright then!', sv: 'Nå, då kör vi!' },
  { es: '¡Hola, compa!', en: 'Hey, buddy!', sv: 'Tjena, kompis!' },
  { es: '¿Le entramos al jale?', en: 'Shall we get to work?', sv: 'Ska vi sätta igång?' },
  { es: '¡Aquí andamos!', en: 'Here we are!', sv: 'Här är vi!' },
  { es: '¡Qué gusto verte!', en: 'Good to see you!', sv: 'Kul att se dig!' },
  { es: '¡Qué bueno que volviste!', en: 'Good thing you came back!', sv: 'Bra att du kom tillbaka!' },
  { es: '¿Empezamos?', en: 'Shall we start?', sv: 'Ska vi börja?' },

  // Praise and hyperbole.
  { es: '¡Qué padre!', en: 'How cool!', sv: 'Vad coolt!' },
  { es: '¡Vientos!', en: 'Awesome!', sv: 'Grymt!' },
  { es: '¡Chido!', en: 'Cool!', sv: 'Coolt!' },
  { es: '¡Vas que vuelas!', en: "You're flying along!", sv: 'Du flyger fram!' },
  { es: '¡Te luciste!', en: 'You outdid yourself!', sv: 'Vad du glänste!' },
  { es: '¡Así se hace!', en: "That's how it's done!", sv: 'Så ska det gå till!' },
  { es: '¡Qué bárbaro!', en: 'Incredible!', sv: 'Otroligt!' },
  { es: '¡Estás imparable!', en: "You're unstoppable!", sv: 'Du är ostoppbar!' },
  { es: '¡Eres una estrella!', en: "You're a star!", sv: 'Du är en stjärna!' },
  {
    es: '¡Hablas mejor que mi primo!',
    en: 'You speak better than my cousin!',
    sv: 'Du pratar bättre än min kusin!',
  },

  // Lucha libre hype.
  { es: '¡A darle!', en: "Let's get to it!", sv: 'Nu kör vi!' },
  { es: '¡Échale ganas!', en: 'Give it your best!', sv: 'Ge järnet!' },
  { es: '¡Vámonos recio!', en: "Let's go hard!", sv: 'Nu kör vi hårt!' },
  { es: '¡Con todo!', en: 'All in!', sv: 'Fullt ös!' },
  { es: '¡Sin miedo!', en: 'No fear!', sv: 'Ingen rädsla!' },
  {
    es: '¡Eres más fuerte que el Santo!',
    en: "You're stronger than El Santo!",
    sv: 'Du är starkare än El Santo!',
  },
  { es: '¡Dos de tres caídas!', en: 'Two out of three falls!', sv: 'Två av tre fall!' },
  { es: '¡Llegó la estrella!', en: 'The star has arrived!', sv: 'Nu kom stjärnan!' },

  // Festive.
  { es: '¡Vámonos!', en: "Let's go!", sv: 'Nu kör vi!' },
  { es: '¡Arriba!', en: 'Yeah! / Let\'s go!', sv: 'Jippi! / Kör!' },
  { es: '¡Qué elegancia!', en: 'Such elegance!', sv: 'Vilken elegans!' },
  { es: '¡Puro México!', en: 'Pure Mexico!', sv: 'Äkta Mexiko!' },
  { es: '¡Ay, ay, ay!', en: 'Oh my!', sv: 'Oj, oj, oj!' },
  { es: '¡Que empiece la fiesta!', en: 'Let the party start!', sv: 'Nu börjar festen!' },
  { es: '¡Salud!', en: 'Cheers!', sv: 'Skål!' },
  { es: '¡Viva el español!', en: 'Long live Spanish!', sv: 'Leve spanskan!' },

  // Food, mostly tacos.
  { es: '¿Y mi taco?', en: "Where's my taco?", sv: 'Var är min taco?' },
  { es: 'Soñaba con tacos.', en: 'I was dreaming about tacos.', sv: 'Jag drömde om tacos.' },
  { es: '¿Me trajiste un taco?', en: 'Did you bring me a taco?', sv: 'Tog du med en taco åt mig?' },
  { es: 'Estaba soñando en español.', en: 'I was dreaming in Spanish.', sv: 'Jag drömde på spanska.' },

  // Glad you're back.
  { es: '¿Ya despertaste?', en: 'Are you awake yet?', sv: 'Är du vaken än?' },
  { es: '¿Ya es hora?', en: 'Is it time already?', sv: 'Är det redan dags?' },
  { es: '¿Dónde andabas?', en: 'Where have you been?', sv: 'Var har du varit?' },
  { es: 'Te extrañé.', en: 'I missed you.', sv: 'Jag saknade dig.' },
  {
    es: 'Llevo días esperándote.',
    en: "I've been waiting days for you.",
    sv: 'Jag har väntat på dig i dagar.',
  },
];
