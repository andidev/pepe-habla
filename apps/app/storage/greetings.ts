import type { PoseName } from './vocabulary';

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
 * Paired to the pose rather than drawn from one pile: sleeping Pepe shouting
 * encouragement reads as a bug, while sleeping Pepe asking for five more
 * minutes reads as a joke. Each pose therefore gets lines only it could say.
 *
 * Two rules hold across the list. Anything addressed to *you* avoids gendered
 * adjectives, because Spanish would otherwise assume the reader's gender --
 * hence `imparable` and `fuerte` (invariant) and `estrella` (a noun used for
 * anyone) rather than `listo` or `bienvenido`. Anything Pepe says about
 * himself is masculine, since Pepe is el perro.
 *
 * Typed as Record<PoseName, ...>, so adding a pose without lines for it is a
 * compile error rather than a blank splash.
 */
export const GREETINGS: Record<PoseName, readonly Greeting[]> = {
  // Standing, neutral. The everyday hellos.
  idle: [
    { es: '¡Órale!', en: 'Hey! / Wow!', sv: 'Hej! / Oj!' },
    { es: '¿Qué onda?', en: "What's up?", sv: 'Läget?' },
    { es: '¡Ándale pues!', en: 'Alright then!', sv: 'Nå, då kör vi!' },
    { es: '¡Hola, compa!', en: 'Hey, buddy!', sv: 'Tjena, kompis!' },
    { es: '¿Le entramos al jale?', en: 'Shall we get to work?', sv: 'Ska vi sätta igång?' },
    { es: '¡Aquí andamos!', en: 'Here we are!', sv: 'Här är vi!' },
    { es: '¡Qué gusto verte!', en: 'Good to see you!', sv: 'Kul att se dig!' },
    { es: '¡Qué bueno que volviste!', en: 'Good thing you came back!', sv: 'Bra att du kom tillbaka!' },
    { es: '¿Empezamos?', en: 'Shall we start?', sv: 'Ska vi börja?' },
  ],

  // Sitting, tongue out, delighted. Praise and hyperbole.
  happy: [
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
  ],

  // Luchador Pepe: mask and cape. Everything here is lucha libre.
  excited: [
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
    { es: '¡Máscara contra cabellera!', en: 'Mask versus hair!', sv: 'Mask mot hår!' },
    { es: '¡Llegó la estrella!', en: 'The star has arrived!', sv: 'Nu kom stjärnan!' },
  ],

  // The big sombrero. Festive and a little grand.
  hero: [
    { es: '¡Vámonos!', en: "Let's go!", sv: 'Nu kör vi!' },
    { es: '¡Arriba!', en: 'Yeah! / Let\'s go!', sv: 'Jippi! / Kör!' },
    { es: '¡Qué elegancia!', en: 'Such elegance!', sv: 'Vilken elegans!' },
    { es: '¡Puro México!', en: 'Pure Mexico!', sv: 'Äkta Mexiko!' },
    { es: '¡Ay, ay, ay!', en: 'Oh my!', sv: 'Oj, oj, oj!' },
    { es: '¡Que empiece la fiesta!', en: 'Let the party start!', sv: 'Nu börjar festen!' },
    { es: '¡Salud!', en: 'Cheers!', sv: 'Skål!' },
    { es: '¡Viva el español!', en: 'Long live Spanish!', sv: 'Leve spanskan!' },
    { es: '¿Te gusta mi sombrero?', en: 'Do you like my hat?', sv: 'Gillar du min hatt?' },
  ],

  // Lying down, dozing. Reluctant, and mostly about food.
  sleeping: [
    { es: '¿Ya despertaste?', en: 'Are you awake yet?', sv: 'Är du vaken än?' },
    { es: 'Cinco minutos más...', en: 'Five more minutes...', sv: 'Fem minuter till...' },
    { es: '¿Y mi taco?', en: "Where's my taco?", sv: 'Var är min taco?' },
    { es: 'Soñaba con tacos.', en: 'I was dreaming about tacos.', sv: 'Jag drömde om tacos.' },
    { es: 'Despiértame para la comida.', en: 'Wake me up for lunch.', sv: 'Väck mig till lunch.' },
    { es: 'Una siestecita más.', en: 'One more little nap.', sv: 'En liten tupplur till.' },
    { es: 'Estaba soñando en español.', en: 'I was dreaming in Spanish.', sv: 'Jag drömde på spanska.' },
    { es: '¿Ya es hora?', en: 'Is it time already?', sv: 'Är det redan dags?' },
  ],

  // Curled up beside a calavera. Affectionate guilt, played for laughs.
  sad: [
    { es: '¿Dónde andabas?', en: 'Where have you been?', sv: 'Var har du varit?' },
    { es: 'Te extrañé.', en: 'I missed you.', sv: 'Jag saknade dig.' },
    {
      es: 'Pensé que ya no volvías.',
      en: "I thought you weren't coming back.",
      sv: 'Jag trodde du inte skulle komma tillbaka.',
    },
    { es: '¿Me trajiste un taco?', en: 'Did you bring me a taco?', sv: 'Tog du med en taco åt mig?' },
    { es: 'Ya no me dejes solo.', en: "Don't leave me on my own again.", sv: 'Lämna mig inte ensam igen.' },
    {
      es: 'Llevo días esperándote.',
      en: "I've been waiting days for you.",
      sv: 'Jag har väntat på dig i dagar.',
    },
    { es: 'Mi corazón estaba triste.', en: 'My heart was sad.', sv: 'Mitt hjärta var ledset.' },
  ],
};
